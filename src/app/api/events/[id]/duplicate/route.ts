import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requirePermission, ownsResource, auditLog } from "@/lib/tenant";
import type { EventDto, PaymentMethod, CertTemplate, CertIssueCondition } from "@/types";

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

/**
 * POST /api/events/[id]/duplicate — admin duplicates an event.
 *
 * Copies the event (new title = "Copy of [original title]", new slug auto-
 * generated) and ALL questions verbatim. Does NOT copy quiz links,
 * registrations, attempts, certificates, landing-page sections, gate passes,
 * or event fields — those start fresh on the duplicate.
 *
 * Returns the new event DTO (201 Created).
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "event.create");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const context = auth.ctx;

    // ── Soft-lock: a non-ACTIVE org cannot create events (duplicates count) ──
    const orgRow = await db.organization.findUnique({
      where: { id: context.orgId },
      select: { status: true },
    });
    if (orgRow && orgRow.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This organization is suspended and cannot create events." },
        { status: 403 }
      );
    }

    // ── Usage limit enforcement (server-side) ──
    const { checkUsageLimit } = await import("@/lib/usage");
    const usageCheck = await checkUsageLimit(context, "events");
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: usageCheck.reason, code: "USAGE_LIMIT_EXCEEDED" },
        { status: 403 }
      );
    }

    const { id } = await ctx.params;

    // Load the source event with its questions (for copying). We deliberately
    // do NOT include quizLinks/registrations/attempts/certificates — those
    // stay on the original and are NOT copied to the duplicate.
    const existing = await db.event.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: "asc" } },
      },
    });
    if (!existing || !ownsResource(existing, context)) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // ── Auto-generate a fresh unique slug (new slug = null at input → generated) ──
    // Same slug-generation logic as POST /api/events: slugify the title, then
    // append a 6-hex-char random suffix for uniqueness.
    const baseSlug = `copy-of-${existing.title}`
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const newSlug = `${baseSlug}-${randomBytes(3).toString("hex")}`;

    // ── Create the duplicate event + copy all questions in a transaction ──
    const created = await db.$transaction(async (tx) => {
      const newEvent = await tx.event.create({
        data: {
          title: `Copy of ${existing.title}`,
          description: existing.description,
          image: existing.image,
          startDate: existing.startDate,
          endDate: existing.endDate,
          isActive: existing.isActive,
          requireRegistration: existing.requireRegistration,
          organizationId: context.orgId,
          slug: newSlug,
          // Payment configuration — copied verbatim (no quiz links/registrations
          // to leak the original's payment state to participants).
          paymentMethod: existing.paymentMethod,
          paymentAmount: existing.paymentAmount,
          paymentCurrency: existing.paymentCurrency,
          paymentInstructions: existing.paymentInstructions,
          upiId: existing.upiId,
          upiLink: existing.upiLink,
          qrCodeUrl: existing.qrCodeUrl,
          // Don't carry over Cloudinary publicIds — those still belong to the
          // original event's assets. The URL still displays but we won't own it.
          qrCodePublicId: null,
          requireTransactionRef: existing.requireTransactionRef,
          requireScreenshot: existing.requireScreenshot,
          // Certificate configuration — copied verbatim.
          certEnabled: existing.certEnabled,
          certTemplate: existing.certTemplate,
          certIssueCondition: existing.certIssueCondition,
          certPassingScore: existing.certPassingScore,
          certAutoGenerate: existing.certAutoGenerate,
          certOrgName: existing.certOrgName,
          certSigneeName: existing.certSigneeName,
          certSigneeTitle: existing.certSigneeTitle,
          certSigneeImage: existing.certSigneeImage,
          certSigneeImagePublicId: null,
          certLogo: existing.certLogo,
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

      // Copy each question verbatim, preserving order/category/difficulty/etc.
      for (const q of existing.questions) {
        await tx.question.create({
          data: {
            eventId: newEvent.id,
            organizationId: context.orgId,
            question: q.question,
            type: q.type,
            options: q.options,
            correctAnswer: q.correctAnswer,
            correctText: q.correctText,
            matchPairs: q.matchPairs,
            codeLanguage: q.codeLanguage,
            marks: q.marks,
            negativeMarks: q.negativeMarks,
            category: q.category,
            order: q.order,
            explanation: q.explanation,
            imageUrl: q.imageUrl,
            imageUrlPublicId: null, // Don't own the original's Cloudinary asset.
            difficulty: q.difficulty,
            tags: q.tags,
          },
        });
      }

      return newEvent;
    });

    await auditLog(context, "EVENT_DUPLICATED", "Event", created.id, {
      sourceEventId: id,
      sourceEventTitle: existing.title,
      newTitle: created.title,
    });

    return NextResponse.json(toEventDto(created), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
