import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  shuffleArray,
  parseJsonArray,
  stringifyJson,
  getClientIp,
  getUserAgent,
} from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
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
          select: { id: true, title: true, description: true },
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
    const fieldCount = await db.eventField.count({
      where: { eventId: quizLink.eventId },
    });
    if (quizLink.event && fieldCount > 0) {
      // Re-fetch the event's requireRegistration flag (the lightweight include
      // above only selected id/title/description).
      const event = await db.event.findUnique({
        where: { id: quizLink.eventId },
        select: { requireRegistration: true },
      });
      if (event?.requireRegistration) {
        const registration = await db.registration.findUnique({
          where: {
            eventId_userId: {
              eventId: quizLink.eventId,
              userId: session.user.id,
            },
          },
          select: { id: true },
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
      }
    }

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
