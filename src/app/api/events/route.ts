import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
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
    requireTransactionRef: e.requireTransactionRef ?? true,
    requireScreenshot: e.requireScreenshot ?? true,
    // Certificate
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

/** GET /api/events — list all events (admin only). */
export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const events = await db.event.findMany({
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

/** POST /api/events — create a new event (admin only). */
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { title, description, image, startDate, endDate, isActive, requireRegistration,
            paymentMethod, paymentAmount, paymentCurrency, paymentInstructions, upiId, upiLink, qrCodeUrl, requireTransactionRef, requireScreenshot,
            certEnabled, certTemplate, certIssueCondition, certPassingScore, certOrgName, certSigneeName, certSigneeTitle, certSigneeImage, certLogo } = body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
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

    const event = await db.event.create({
      data: {
        title: title.trim(),
        description: typeof description === "string" ? description : "",
        image: typeof image === "string" && image.trim() ? image.trim() : null,
        startDate: start,
        endDate: end,
        isActive: typeof isActive === "boolean" ? isActive : true,
        requireRegistration: typeof requireRegistration === "boolean" ? requireRegistration : false,
        // Payment
        paymentMethod: typeof paymentMethod === "string" ? paymentMethod : "FREE",
        paymentAmount: typeof paymentAmount === "number" ? paymentAmount : 0,
        paymentCurrency: typeof paymentCurrency === "string" ? paymentCurrency : "INR",
        paymentInstructions: typeof paymentInstructions === "string" ? paymentInstructions : null,
        upiId: typeof upiId === "string" ? upiId : null,
        upiLink: typeof upiLink === "string" ? upiLink : null,
        qrCodeUrl: typeof qrCodeUrl === "string" ? qrCodeUrl : null,
        requireTransactionRef: typeof requireTransactionRef === "boolean" ? requireTransactionRef : true,
        requireScreenshot: typeof requireScreenshot === "boolean" ? requireScreenshot : true,
        // Certificate
        certEnabled: typeof certEnabled === "boolean" ? certEnabled : false,
        certTemplate: typeof certTemplate === "string" ? certTemplate : "modern",
        certIssueCondition: typeof certIssueCondition === "string" ? certIssueCondition : "COMPLETED",
        certPassingScore: typeof certPassingScore === "number" ? certPassingScore : 60,
        certOrgName: typeof certOrgName === "string" ? certOrgName : null,
        certSigneeName: typeof certSigneeName === "string" ? certSigneeName : null,
        certSigneeTitle: typeof certSigneeTitle === "string" ? certSigneeTitle : null,
        certSigneeImage: typeof certSigneeImage === "string" ? certSigneeImage : null,
        certLogo: typeof certLogo === "string" ? certLogo : null,
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
    return NextResponse.json(toEventDto(event), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
