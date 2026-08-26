import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toQuizLinkDto } from "@/app/api/quiz-links/route";

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * GET /api/quiz-links/by-slug/[slug]
 *
 * Public route — anyone with the link (including unauthenticated users)
 * can read this metadata so the landing page can show event info before login.
 * Returns the full set of security toggles + questionCount + publishResults
 * + aiProctor sub-toggles so the client knows which features to activate.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { slug } = await ctx.params;
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const link = await db.quizLink.findUnique({
      where: { slug },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            image: true,
            requireRegistration: true,
            organization: { select: { slug: true } },
            // Payment config — surfaced so the participant's PaymentScreen
            // can render UPI ID / QR / amount without an extra round-trip.
            paymentMethod: true,
            paymentAmount: true,
            paymentCurrency: true,
            paymentInstructions: true,
            upiId: true,
            upiLink: true,
            qrCodeUrl: true,
            requireTransactionRef: true,
            requireScreenshot: true,
          },
        },
      },
    });

    if (!link) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }
    if (!link.isActive) {
      return NextResponse.json({ error: "This quiz is no longer active." }, { status: 404 });
    }
    const hasExpired = !!link.expiresAt && link.expiresAt.getTime() < Date.now();
    if (hasExpired) {
      return NextResponse.json({ error: "This quiz link has expired." }, { status: 404 });
    }

    const questionCount = await db.question.count({ where: { eventId: link.eventId } });
    const fieldCount = await db.eventField.count({ where: { eventId: link.eventId } });
    const requireRegistration = !!link.event?.requireRegistration && fieldCount > 0;

    return NextResponse.json({
      quizLink: toQuizLinkDto(link),
      eventSlug: link.event?.slug || null,
      orgSlug: link.event?.organization?.slug || null,
      event: link.event
        ? {
            id: link.event.id,
            title: link.event.title,
            description: link.event.description,
            image: link.event.image ?? null,
            // Payment configuration — exposed so the participant's PaymentScreen
            // can render UPI ID / QR / amount without an extra API call.
            paymentMethod: link.event.paymentMethod ?? "FREE",
            paymentAmount: link.event.paymentAmount ?? 0,
            paymentCurrency: link.event.paymentCurrency ?? "INR",
            paymentInstructions: link.event.paymentInstructions ?? null,
            upiId: link.event.upiId ?? null,
            upiLink: link.event.upiLink ?? null,
            qrCodeUrl: link.event.qrCodeUrl ?? null,
            requireTransactionRef: link.event.requireTransactionRef ?? true,
            requireScreenshot: link.event.requireScreenshot ?? true,
          }
        : null,
      questionCount,
      timeLimit: link.timeLimit,
      passThreshold: link.passThreshold,
      maxAttempts: link.maxAttempts,
      requireFullscreen: link.requireFullscreen,
      isActive: link.isActive,
      hasExpired,
      // Security config (mirrors quizLink fields — duplicated here so the
      // pre-quiz landing screen can read them in one flat object).
      security: {
        autoSubmitOnExit: link.autoSubmitOnExit,
        tabSwitchDetection: link.tabSwitchDetection,
        copyPasteBlocking: link.copyPasteBlocking,
        rightClickDisable: link.rightClickDisable,
        keyboardShortcutBlocking: link.keyboardShortcutBlocking,
        devtoolsDetection: link.devtoolsDetection,
        antiScreenshot: link.antiScreenshot,
        watermarkOverlay: link.watermarkOverlay,
        aiProctor: link.aiProctor,
        aiProctorFaceDetection: link.aiProctorFaceDetection,
        aiProctorMultiFace: link.aiProctorMultiFace,
        aiProctorLookAway: link.aiProctorLookAway,
      },
      quizLinkQuestionCount: link.questionCount,
      publishResults: link.publishResults,
      // Registration gate: if true, the caller must fill out the event's
      // registration form (GET /api/events/[id]/fields) before /attempts/start
      // will accept them.
      requireRegistration,
      fieldCount,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
