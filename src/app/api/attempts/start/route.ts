import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  shuffleArray,
  parseJsonArray,
  stringifyJson,
  getUserAgent,
} from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit: 20 quiz starts per minute per IP ──────────────────
    const ip = getClientIp(req);
    const rl = await rateLimit(`quiz:start:${ip}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // ── Rate limit: 10 quiz starts per minute per user ─────────────────
    const userRl = await rateLimit(`quiz:start:user:${session.user.id}`, 10, 60_000);
    if (!userRl.allowed) {
      return NextResponse.json(
        { error: "Too many quiz starts. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const quizLinkId = body?.quizLinkId as string | undefined;
    if (!quizLinkId || typeof quizLinkId !== "string") {
      return NextResponse.json(
        { error: "quizLinkId is required" },
        { status: 400 }
      );
    }

    const quizLink = await db.quizLink.findUnique({
      where: { id: quizLinkId },
      include: {
        event: {
          select: { id: true, title: true, description: true, organizationId: true },
        },
      },
    });

    if (!quizLink) {
      return NextResponse.json(
        { error: "Quiz link not found" },
        { status: 404 }
      );
    }

    if (!quizLink.isActive) {
      return NextResponse.json(
        { error: "This quiz link is no longer active" },
        { status: 403 }
      );
    }

    if (quizLink.expiresAt && quizLink.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This quiz link has expired" },
        { status: 403 }
      );
    }

    // Max attempts check
    if (quizLink.maxAttempts > 0) {
      const attemptCount = await db.quizAttempt.count({
        where: {
          userId: session.user.id,
          quizLinkId,
          status: {
            in: ["IN_PROGRESS", "COMPLETED", "TIMEOUT", "CHEAT_DETECTED"],
          },
        },
      });
      if (attemptCount >= quizLink.maxAttempts) {
        return NextResponse.json(
          {
            error: "Max attempts reached",
            attempts: attemptCount,
            maxAttempts: quizLink.maxAttempts,
          },
          { status: 409 }
        );
      }
    }

    // Registration gate — if the event requires registration and the user
    // has not yet registered, refuse to start and tell the client to register first.
    // If the event does NOT require registration, auto-create a registration
    // record so the participant shows up in the admin's registration list and
    // the participant dashboard shows the event.
    const fieldCount = await db.eventField.count({
      where: { eventId: quizLink.eventId },
    });
    if (quizLink.event && fieldCount > 0) {
      // Re-fetch the event's requireRegistration flag (the lightweight include
      // above only selected id/title/description).
      const event = await db.event.findUnique({
        where: { id: quizLink.eventId },
        select: {
          requireRegistration: true,
          // Payment enforcement — re-fetched together to avoid a second round-trip.
          paymentMethod: true,
        },
      });
      if (event?.requireRegistration) {
        const registration = await db.registration.findUnique({
          where: {
            eventId_userId: {
              eventId: quizLink.eventId,
              userId: session.user.id,
            },
          },
          select: { id: true, paymentStatus: true },
        });
        if (!registration) {
          return NextResponse.json(
            {
              error: "Registration required",
              code: "REGISTRATION_REQUIRED",
              eventId: quizLink.eventId,
            },
            { status: 403 }
          );
        }
        // Payment gate — for any paid event (MANUAL, RAZORPAY, STRIPE), the
        // registration must have paymentStatus = "COMPLETED" before the
        // participant can start. PENDING_VERIFICATION / REJECTED / NONE all
        // block the attempt. (Gateway flows are not wired yet, so all paid
        // events use the manual screenshot+approve path — this gate prevents
        // a participant on a paid event from starting without paying.)
        if (event.paymentMethod && event.paymentMethod !== "FREE") {
          if (registration.paymentStatus !== "COMPLETED") {
            return NextResponse.json(
              {
                error:
                  registration.paymentStatus === "PENDING_VERIFICATION"
                    ? "Your payment is pending verification. Please wait for the organizer to approve it."
                    : registration.paymentStatus === "REJECTED"
                      ? "Your payment was rejected. Please resubmit your payment proof."
                      : "Payment required before you can start the quiz.",
                code: "PAYMENT_REQUIRED",
                paymentStatus: registration.paymentStatus,
                eventId: quizLink.eventId,
              },
              { status: 403 }
            );
          }
        }
      }
    } else {
      // ── Auto-register for open events (no registration required) ───────
      // When the event does NOT require registration, auto-create a Registration
      // record so the participant appears in the admin's registration list and
      // the participant dashboard shows the event. This uses upsert so it's
      // idempotent — if already registered, it's a no-op.
      await db.registration.upsert({
        where: {
          eventId_userId: {
            eventId: quizLink.eventId,
            userId: session.user.id,
          },
        },
        update: {}, // no-op if already exists
        create: {
          eventId: quizLink.eventId,
          userId: session.user.id,
          data: JSON.stringify({ auto: true, method: "google_login" }),
          paymentStatus: "NONE",
        },
      });

      // Also auto-add as PARTICIPANT member of the org if not already a member.
      // This ensures the participant dashboard shows the event.
      const event = await db.event.findUnique({
        where: { id: quizLink.eventId },
        select: { organizationId: true },
      });
      if (event?.organizationId) {
        await db.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId: event.organizationId,
              userId: session.user.id,
            },
          },
          update: {},
          create: {
            organizationId: event.organizationId,
            userId: session.user.id,
            role: "PARTICIPANT",
            status: "ACTIVE",
          },
        }).catch(() => {});
      }
    }

    // ── Authorization ────────────────────────────────────────────────────
    // Access control for quiz attempts:
    //
    //   1. If the event REQUIRES registration (requireRegistration=true AND
    //      has EventFields), the registration gate above already enforces it.
    //      If the user has no registration, they get 403 "REGISTRATION_REQUIRED".
    //      If they have a registration but payment isn't complete, they get
    //      403 "PAYMENT_REQUIRED". If we reach here, they passed both gates.
    //
    //   2. If the event does NOT require registration (open quiz), any
    //      authenticated user can attempt it. The quiz link is a secret
    //      6-character random slug that controls access — knowing the link
    //      IS the authorization. No org membership needed because participants
    //      are external users who received the link from the organizer.
    //
    //   3. If the event has no organizationId (legacy/backward-compat), skip.
    //
    // This allows participants who log in via Google (from the quiz link) to
    // take open quizzes without being blocked by org-membership checks.

    // Fetch all questions for the event, ordered by `order` then createdAt
    const allQuestions = await db.question.findMany({
      where: { eventId: quizLink.eventId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    if (allQuestions.length === 0) {
      return NextResponse.json(
        { error: "This quiz has no questions yet" },
        { status: 400 }
      );
    }

    // ----- Pick N random questions if questionCount > 0 -----
    // If questionCount is 0 or > total available, use all questions.
    let selectedQuestions = allQuestions;
    if (
      quizLink.questionCount > 0 &&
      quizLink.questionCount < allQuestions.length
    ) {
      selectedQuestions = shuffleArray(allQuestions).slice(0, quizLink.questionCount);
    }

    // Shuffle question order if enabled
    const orderedQuestions = quizLink.shuffleQuestions
      ? shuffleArray(selectedQuestions)
      : selectedQuestions;

    const questionOrderIds = orderedQuestions.map((q) => q.id);

    // Create attempt
    const attempt = await db.quizAttempt.create({
      data: {
        userId: session.user.id,
        quizLinkId,
        eventId: quizLink.eventId,
        status: "IN_PROGRESS",
        questionOrder: stringifyJson(questionOrderIds),
        answers: null,
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
      },
    });

    // Build public questions (no correctAnswer / correctText).
    const publicQuestions = orderedQuestions.map((q, idx) => {
      let matchPairs: { left: string; right: string }[] | null = null;
      if (q.matchPairs) {
        try {
          const parsed = JSON.parse(q.matchPairs);
          matchPairs = Array.isArray(parsed) ? parsed : null;
        } catch {
          matchPairs = null;
        }
      }
      return {
        id: q.id,
        question: q.question,
        type: q.type ?? "MCQ",
        options: parseJsonArray<string>(q.options),
        matchPairs,
        codeLanguage: q.codeLanguage ?? null,
        marks: q.marks,
        negativeMarks: q.negativeMarks ?? 0,
        category: q.category ?? null,
        order: idx,
      };
    });

    const totalMarks = orderedQuestions.reduce((sum, q) => sum + q.marks, 0);

    return NextResponse.json({
      attemptId: attempt.id,
      questionOrder: questionOrderIds,
      questions: publicQuestions,
      timeLimit: quizLink.timeLimit,
      maxAttempts: quizLink.maxAttempts,
      totalQuestions: orderedQuestions.length,
      totalMarks,
      event: quizLink.event,
      requireFullscreen: quizLink.requireFullscreen,
      // Security config — the client activates each feature based on these.
      security: {
        autoSubmitOnExit: quizLink.autoSubmitOnExit,
        tabSwitchDetection: quizLink.tabSwitchDetection,
        copyPasteBlocking: quizLink.copyPasteBlocking,
        rightClickDisable: quizLink.rightClickDisable,
        keyboardShortcutBlocking: quizLink.keyboardShortcutBlocking,
        devtoolsDetection: quizLink.devtoolsDetection,
        antiScreenshot: quizLink.antiScreenshot,
        watermarkOverlay: quizLink.watermarkOverlay,
        aiProctor: quizLink.aiProctor,
        aiProctorFaceDetection: quizLink.aiProctorFaceDetection,
        aiProctorMultiFace: quizLink.aiProctorMultiFace,
        aiProctorLookAway: quizLink.aiProctorLookAway,
      },
      passThreshold: quizLink.passThreshold,
    });
  } catch (error) {
    console.error("[POST /api/attempts/start] error:", error);
    return NextResponse.json(
      { error: "Failed to start attempt" },
      { status: 500 }
    );
  }
}
