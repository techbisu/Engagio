import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseJsonArray, stringifyJson } from "@/lib/utils";

interface SubmitBody {
  attemptId?: string;
  answers?: Record<string, number>;
  tabSwitches?: number;
  fullscreenExits?: number;
  copyAttempts?: number;
  rightClicks?: number;
  timeTaken?: number;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as SubmitBody;
    const {
      attemptId,
      answers,
      tabSwitches = 0,
      fullscreenExits = 0,
      copyAttempts = 0,
      rightClicks = 0,
      timeTaken = 0,
    } = body;

    if (!attemptId || typeof attemptId !== "string") {
      return NextResponse.json(
        { error: "attemptId is required" },
        { status: 400 }
      );
    }

    const attempt = await db.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quizLink: {
          select: {
            id: true,
            timeLimit: true,
            passThreshold: true,
            showResults: true,
            requireFullscreen: true,
            eventId: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    if (attempt.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(
        {
          error: "Attempt already submitted",
          status: attempt.status,
          score: attempt.score,
          totalMarks: attempt.totalMarks,
          percentage: attempt.percentage,
          passed: attempt.passed,
          timeTaken: attempt.timeTaken,
          showResults: attempt.quizLink.showResults,
        },
        { status: 409 }
      );
    }

    // Resolve answers map
    const answerMap: Record<string, number> =
      answers && typeof answers === "object" ? answers : {};

    // Load the questions in the stored order
    const questionOrder = parseJsonArray<string>(attempt.questionOrder);
    const questions =
      questionOrder.length > 0
        ? await db.question.findMany({
            where: { id: { in: questionOrder } },
          })
        : await db.question.findMany({
            where: { eventId: attempt.eventId },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          });

    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions = questionOrder
      .map((qid) => questionMap.get(qid))
      .filter(Boolean) as typeof questions;

    // Score the attempt
    let score = 0;
    let totalMarks = 0;
    for (const q of orderedQuestions) {
      totalMarks += q.marks;
      const chosen = answerMap[q.id];
      if (chosen !== undefined && chosen === q.correctAnswer) {
        score += q.marks;
      }
    }

    const percentage =
      totalMarks > 0
        ? Math.round((score / totalMarks) * 100)
        : 0;
    const passed = percentage >= attempt.quizLink.passThreshold;

    // Determine status — anti-cheat heuristics + timeout
    let status: "COMPLETED" | "CHEAT_DETECTED" | "TIMEOUT" = "COMPLETED";

    const timeLimitSeconds = attempt.quizLink.timeLimit * 60;
    const isTimedOut =
      attempt.quizLink.timeLimit > 0 &&
      typeof timeTaken === "number" &&
      timeTaken > timeLimitSeconds + 60; // 1 min grace

    const isCheatDetected =
      (typeof tabSwitches === "number" && tabSwitches > 5) ||
      (typeof fullscreenExits === "number" && fullscreenExits > 2) ||
      (typeof copyAttempts === "number" && copyAttempts > 0) ||
      (typeof rightClicks === "number" && rightClicks > 3);

    if (isCheatDetected) status = "CHEAT_DETECTED";
    else if (isTimedOut) status = "TIMEOUT";

    const safeTab = Number(tabSwitches) || 0;
    const safeFull = Number(fullscreenExits) || 0;
    const safeCopy = Number(copyAttempts) || 0;
    const safeRight = Number(rightClicks) || 0;
    const safeTime = Number(timeTaken) || 0;

    const updated = await db.quizAttempt.update({
      where: { id: attemptId },
      data: {
        answers: stringifyJson(answerMap),
        score,
        totalMarks,
        percentage,
        passed,
        tabSwitches: safeTab,
        fullscreenExits: safeFull,
        copyAttempts: safeCopy,
        rightClicks: safeRight,
        timeTaken: safeTime,
        status,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      attemptId: updated.id,
      status: updated.status,
      score: updated.score,
      totalMarks: updated.totalMarks,
      percentage: updated.percentage,
      passed: updated.passed,
      timeTaken: updated.timeTaken,
      showResults: attempt.quizLink.showResults,
    });
  } catch (error) {
    console.error("[POST /api/attempts/submit] error:", error);
    return NextResponse.json(
      { error: "Failed to submit attempt" },
      { status: 500 }
    );
  }
}
