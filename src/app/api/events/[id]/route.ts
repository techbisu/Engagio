import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { requirePermission, ownsResource } from "@/lib/tenant";
import { resolveImageValue, deleteFile } from "@/lib/storage";
import type { EventDto, PaymentMethod, CertTemplate, CertIssueCondition } from "@/types";

async function requireAuth(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user;
}

function toEventDto(e: any): EventDto {
  return {
    id: e.id,
    title: e.title,
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

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/events/[id] — fetch a single event (any authenticated user). */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const event = await db.event.findUnique({
      where: { id },
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
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(toEventDto(event));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/** PATCH /api/events/[id] — update an event (org-scoped admin). */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "event.update");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await ctx.params;
    const existing = await db.event.findUnique({ where: { id } });
    if (!existing || !ownsResource(existing, auth.ctx)) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const body = await req.json();
    const { title, description, image, startDate, endDate, isActive, requireRegistration,
            paymentMethod, paymentAmount, paymentCurrency, paymentInstructions, upiId, upiLink, qrCodeUrl, requireTransactionRef, requireScreenshot,
            certEnabled, certTemplate, certIssueCondition, certPassingScore, certAutoGenerate, certOrgName, certSigneeName, certSigneeTitle, certSigneeImage, certLogo } = body || {};

    const data: Record<string, unknown> = {};
    if (typeof title === "string" && title.trim()) data.title = title.trim();
    if (typeof description === "string") data.description = description;
    if (image !== undefined) {
      // Event hero image: handle string URL passthrough, data URL upload, or null to clear.
      const img = await resolveImageValue(image, null, {
        folder: "events/hero",
        transformation: "w_1200,h_525,c_fill,q_auto,f_auto",
      });
      data.image = img.url;
    }
    if (typeof isActive === "boolean") data.isActive = isActive;
    if (typeof requireRegistration === "boolean") data.requireRegistration = requireRegistration;
    // Payment
    if (typeof paymentMethod === "string") data.paymentMethod = paymentMethod;
    if (typeof paymentAmount === "number") data.paymentAmount = paymentAmount;
    if (typeof paymentCurrency === "string") data.paymentCurrency = paymentCurrency;
    if (typeof paymentInstructions === "string") data.paymentInstructions = paymentInstructions || null;
    if (typeof upiId === "string") data.upiId = upiId || null;
    if (typeof upiLink === "string") data.upiLink = upiLink || null;
    // QR code image: upload/clear/passthrough depending on the value shape.
    // - undefined  -> no change.
    // - null/""    -> delete the old Cloudinary asset + clear both fields.
    // - data:image/* -> upload (replacing the old asset) + store url + publicId.
    // - other string -> external URL passthrough (publicId kept for cleanup).
    if (qrCodeUrl !== undefined) {
      const qr = await resolveImageValue(qrCodeUrl, existing.qrCodePublicId ?? null, {
        folder: "events/qr",
        transformation: "w_400,h_400,c_fit,q_auto,f_auto",
      });
      data.qrCodeUrl = qr.url;
      data.qrCodePublicId = qr.publicId;
    }
    if (typeof requireTransactionRef === "boolean") data.requireTransactionRef = requireTransactionRef;
    if (typeof requireScreenshot === "boolean") data.requireScreenshot = requireScreenshot;
    // Certificate
    if (typeof certEnabled === "boolean") data.certEnabled = certEnabled;
    if (typeof certTemplate === "string") data.certTemplate = certTemplate;
    if (typeof certIssueCondition === "string") data.certIssueCondition = certIssueCondition;
    if (typeof certPassingScore === "number") data.certPassingScore = certPassingScore;
    if (typeof certAutoGenerate === "boolean") data.certAutoGenerate = certAutoGenerate;
    if (typeof certOrgName === "string") data.certOrgName = certOrgName || null;
    if (typeof certSigneeName === "string") data.certSigneeName = certSigneeName || null;
    if (typeof certSigneeTitle === "string") data.certSigneeTitle = certSigneeTitle || null;
    // Signee image: upload/clear/passthrough (see QR code above).
    if (certSigneeImage !== undefined) {
      const signee = await resolveImageValue(certSigneeImage, existing.certSigneeImagePublicId ?? null, {
        folder: "events/signatures",
        transformation: "w_400,h_200,c_fit,q_auto,f_auto",
      });
      data.certSigneeImage = signee.url;
      data.certSigneeImagePublicId = signee.publicId;
    }
    // Org logo: upload/clear/passthrough (see QR code above).
    if (certLogo !== undefined) {
      const logo = await resolveImageValue(certLogo, existing.certLogoPublicId ?? null, {
        folder: "events/logos",
        transformation: "w_300,h_300,c_fit,q_auto,f_auto",
      });
      data.certLogo = logo.url;
      data.certLogoPublicId = logo.publicId;
    }

    let start = existing.startDate;
    let end = existing.endDate;
    if (startDate !== undefined) {
      const parsed = new Date(startDate);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
      }
      start = parsed;
      data.startDate = parsed;
    }
    if (endDate !== undefined) {
      const parsed = new Date(endDate);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
      }
      end = parsed;
      data.endDate = parsed;
    }
    if (end < start) {
      return NextResponse.json(
        { error: "endDate must be on or after startDate" },
        { status: 400 }
      );
    }

    const updated = await db.event.update({
      where: { id },
      data,
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
    return NextResponse.json(toEventDto(updated));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/events/[id] — delete an event (org-scoped admin). Cascades to children. */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "event.delete");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await ctx.params;
    const existing = await db.event.findUnique({ where: { id } });
    if (!existing || !ownsResource(existing, auth.ctx)) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    // Best-effort: delete any Cloudinary assets owned by this event before
    // cascading the row delete. Failures are logged but don't block the delete.
    await Promise.all([
      deleteFile(existing.qrCodePublicId),
      deleteFile(existing.certSigneeImagePublicId),
      deleteFile(existing.certLogoPublicId),
    ]);
    await db.event.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
