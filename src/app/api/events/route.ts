import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { requireOrgRole, orgScope, auditLog, type TenantContext } from "@/lib/tenant";
import type { EventDto, PaymentMethod, CertTemplate, CertIssueCondition } from "@/types";

/** Check the session for an admin role. Returns true if the caller is an admin. */
async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

/** Map a Prisma Event row (with _count) to EventDto. */
function toEventDto(e: any): EventDto {
  return {
    id: e.id,
    title: e.title,
    slug: e.slug ?? null,
    description: e.description,
    image: e.image ?? null,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate.toISOString(),
    isActive: e.isActive,
    requireRegistration: e.requireRegistration ?? false,
    createdAt: e.createdAt.toISOString(),
    questionCount: e._count?.questions ?? 0,
    linkCount: e._count?.quizLinks ?? 0,
    attemptCount: e._count?.attempts ?? 0,
    registrationCount: e._count?.registrations ?? 0,
    fieldCount: e._count?.fields ?? 0,
    certificateCount: e._count?.certificates ?? 0,
    // Payment
    paymentMethod: (e.paymentMethod ?? "FREE") as PaymentMethod,
    paymentAmount: e.paymentAmount ?? 0,
    paymentCurrency: e.paymentCurrency ?? "INR",
    paymentInstructions: e.paymentInstructions ?? null,
    upiId: e.upiId ?? null,
    upiLink: e.upiLink ?? null,
    qrCodeUrl: e.qrCodeUrl ?? null,
    qrCodePublicId: e.qrCodePublicId ?? null,
    requireTransactionRef: e.requireTransactionRef ?? true,
    requireScreenshot: e.requireScreenshot ?? true,
    // Certificate
    certEnabled: e.certEnabled ?? false,
    certTemplate: (e.certTemplate ?? "modern") as CertTemplate,
    certIssueCondition: (e.certIssueCondition ?? "COMPLETED") as CertIssueCondition,
    certPassingScore: e.certPassingScore ?? 60,
    certAutoGenerate: e.certAutoGenerate ?? false,
    certOrgName: e.certOrgName ?? null,
    certSigneeName: e.certSigneeName ?? null,
    certSigneeTitle: e.certSigneeTitle ?? null,
    certSigneeImage: e.certSigneeImage ?? null,
    certSigneeImagePublicId: e.certSigneeImagePublicId ?? null,
    certLogo: e.certLogo ?? null,
    certLogoPublicId: e.certLogoPublicId ?? null,
  };
}

/** GET /api/events — list all events in the current organization (org-scoped). */
export async function GET(req: NextRequest) {
  try {
    // Use org context: requires EVENT_MANAGER role. Platform admins see all.
    const ctxResult = await requireOrgRole(req, "EVENT_MANAGER");
    let ctx: TenantContext;
    if ("error" in ctxResult) {
      // Fallback to legacy admin check for backward compat (single-tenant admins)
      if (!(await requireAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // Legacy admin without org membership — return empty (no org scope)
      return NextResponse.json([]);
    }
    ctx = ctxResult;

    const events = await db.event.findMany({
      where: orgScope(ctx),
      include: {
        _count: {
          select: {
            questions: true,
            attempts: true,
            quizLinks: true,
            registrations: true,
            fields: true,
            certificates: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const data = events.map(toEventDto);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** POST /api/events — create a new event in the current organization. */
export async function POST(req: NextRequest) {
  try {
    const ctxResult = await requireOrgRole(req, "EVENT_MANAGER");
    let ctx: TenantContext;
    if ("error" in ctxResult) {
      if (!(await requireAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.json({ error: "No organization context" }, { status: 403 });
    }
    ctx = ctxResult;

    // ── Usage limit enforcement (server-side) ──
    const { checkUsageLimit } = await import("@/lib/usage");
    const usageCheck = await checkUsageLimit(ctx, "events");
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: usageCheck.reason, code: "USAGE_LIMIT_EXCEEDED" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, description, image, startDate, endDate, isActive, requireRegistration,
            paymentMethod, paymentAmount, paymentCurrency, paymentInstructions, upiId, upiLink, qrCodeUrl, requireTransactionRef, requireScreenshot,
            certEnabled, certTemplate, certIssueCondition, certPassingScore, certAutoGenerate, certOrgName, certSigneeName, certSigneeTitle, certSigneeImage, certLogo,
            slug: customSlug } = body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Auto-generate slug from title if not provided
    let eventSlug = customSlug?.trim().toLowerCase() || "";
    if (!eventSlug) {
      eventSlug = title.trim().toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);
      // Add random suffix for uniqueness
      eventSlug += "-" + Math.random().toString(36).slice(2, 6);
    }
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid startDate or endDate" },
        { status: 400 }
      );
    }
    if (end < start) {
      return NextResponse.json(
        { error: "endDate must be on or after startDate" },
        { status: 400 }
      );
    }

    // Image fields — for JSON API (not FormData), just pass the string URL
    // directly. If it's a data URL (base64), keep it. If Cloudinary is
    // configured and it's a base64 image, upload it. Otherwise, store as-is.
    const qrCodeUrlResolved = typeof qrCodeUrl === "string" && qrCodeUrl.trim() ? qrCodeUrl.trim() : null;
    const certSigneeImageResolved = typeof certSigneeImage === "string" && certSigneeImage.trim() ? certSigneeImage.trim() : null;
    const certLogoResolved = typeof certLogo === "string" && certLogo.trim() ? certLogo.trim() : null;

    const event = await db.event.create({
      data: {
        title: title.trim(),
        description: typeof description === "string" ? description : "",
        image: typeof image === "string" && image.trim() ? image.trim() : null,
        startDate: start,
        endDate: end,
        isActive: typeof isActive === "boolean" ? isActive : true,
        requireRegistration: typeof requireRegistration === "boolean" ? requireRegistration : false,
        organizationId: ctx.orgId,
        slug: eventSlug,
        // Payment
        paymentMethod: typeof paymentMethod === "string" ? paymentMethod : "FREE",
        paymentAmount: typeof paymentAmount === "number" ? paymentAmount : 0,
        paymentCurrency: typeof paymentCurrency === "string" ? paymentCurrency : "INR",
        paymentInstructions: typeof paymentInstructions === "string" ? paymentInstructions : null,
        upiId: typeof upiId === "string" ? upiId : null,
        upiLink: typeof upiLink === "string" ? upiLink : null,
        qrCodeUrl: qrCodeUrlResolved,
        qrCodePublicId: null,
        requireTransactionRef: typeof requireTransactionRef === "boolean" ? requireTransactionRef : true,
        requireScreenshot: typeof requireScreenshot === "boolean" ? requireScreenshot : true,
        // Certificate
        certEnabled: typeof certEnabled === "boolean" ? certEnabled : false,
        certTemplate: typeof certTemplate === "string" ? certTemplate : "modern",
        certIssueCondition: typeof certIssueCondition === "string" ? certIssueCondition : "COMPLETED",
        certPassingScore: typeof certPassingScore === "number" ? certPassingScore : 60,
        certAutoGenerate: typeof certAutoGenerate === "boolean" ? certAutoGenerate : false,
        certOrgName: typeof certOrgName === "string" ? certOrgName : null,
        certSigneeName: typeof certSigneeName === "string" ? certSigneeName : null,
        certSigneeTitle: typeof certSigneeTitle === "string" ? certSigneeTitle : null,
        certSigneeImage: certSigneeImageResolved,
        certSigneeImagePublicId: null,
        certLogo: certLogoResolved,
        certLogoPublicId: null,
      },
      include: {
        _count: {
          select: {
            questions: true,
            attempts: true,
            quizLinks: true,
            registrations: true,
            fields: true,
            certificates: true,
          },
        },
      },
    });
    await auditLog(ctx, "EVENT_CREATED", "Event", event.id, { title: title.trim() });
    return NextResponse.json(toEventDto(event), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
