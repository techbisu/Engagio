import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import type { EventDto, PaymentMethod, CertTemplate, CertIssueCondition } from "@/types";

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

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
    requireTransactionRef: e.requireTransactionRef ?? true,
    requireScreenshot: e.requireScreenshot ?? true,
    certEnabled: e.certEnabled ?? false,
    certTemplate: (e.certTemplate ?? "modern") as CertTemplate,
    certIssueCondition: (e.certIssueCondition ?? "COMPLETED") as CertIssueCondition,
    certPassingScore: e.certPassingScore ?? 60,
    certOrgName: e.certOrgName ?? null,
    certSigneeName: e.certSigneeName ?? null,
    certSigneeTitle: e.certSigneeTitle ?? null,
    certSigneeImage: e.certSigneeImage ?? null,
    certLogo: e.certLogo ?? null,
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
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** PATCH /api/events/[id] — update an event (admin only). */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const body = await req.json();
    const { title, description, image, startDate, endDate, isActive, requireRegistration,
            paymentMethod, paymentAmount, paymentCurrency, paymentInstructions, upiId, upiLink, qrCodeUrl, requireTransactionRef, requireScreenshot,
            certEnabled, certTemplate, certIssueCondition, certPassingScore, certOrgName, certSigneeName, certSigneeTitle, certSigneeImage, certLogo } = body || {};

    const data: Record<string, unknown> = {};
    if (typeof title === "string" && title.trim()) data.title = title.trim();
    if (typeof description === "string") data.description = description;
    if (typeof image === "string") data.image = image.trim() || null;
    if (typeof isActive === "boolean") data.isActive = isActive;
    if (typeof requireRegistration === "boolean") data.requireRegistration = requireRegistration;
    // Payment
    if (typeof paymentMethod === "string") data.paymentMethod = paymentMethod;
    if (typeof paymentAmount === "number") data.paymentAmount = paymentAmount;
    if (typeof paymentCurrency === "string") data.paymentCurrency = paymentCurrency;
    if (typeof paymentInstructions === "string") data.paymentInstructions = paymentInstructions || null;
    if (typeof upiId === "string") data.upiId = upiId || null;
    if (typeof upiLink === "string") data.upiLink = upiLink || null;
    if (typeof qrCodeUrl === "string") data.qrCodeUrl = qrCodeUrl || null;
    if (typeof requireTransactionRef === "boolean") data.requireTransactionRef = requireTransactionRef;
    if (typeof requireScreenshot === "boolean") data.requireScreenshot = requireScreenshot;
    // Certificate
    if (typeof certEnabled === "boolean") data.certEnabled = certEnabled;
    if (typeof certTemplate === "string") data.certTemplate = certTemplate;
    if (typeof certIssueCondition === "string") data.certIssueCondition = certIssueCondition;
    if (typeof certPassingScore === "number") data.certPassingScore = certPassingScore;
    if (typeof certOrgName === "string") data.certOrgName = certOrgName || null;
    if (typeof certSigneeName === "string") data.certSigneeName = certSigneeName || null;
    if (typeof certSigneeTitle === "string") data.certSigneeTitle = certSigneeTitle || null;
    if (typeof certSigneeImage === "string") data.certSigneeImage = certSigneeImage || null;
    if (typeof certLogo === "string") data.certLogo = certLogo || null;

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
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** DELETE /api/events/[id] — delete an event (admin only). Cascades to children. */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    await db.event.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
