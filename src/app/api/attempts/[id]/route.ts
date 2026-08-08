import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseJsonArray } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const attempt = await db.quizAttempt.findUnique({
      where: { id },
      include: {
        quizLink: {
          select: {
            id: true,
            slug: true,
            timeLimit: true,
            maxAttempts: true,
            passThreshold: true,
            showResults: true,
            requireFullscreen: true,
            eventId: true,
          },
        },
        event: {
          select: { id: true, title: true, description: true },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    const isAdmin = session.user.role === "ADMIN";
    if (attempt.userId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const questionOrder = parseJsonArray<string>(attempt.questionOrder);

    // Fetch all questions referenced in this attempt
    const questions = await db.question.findMany({
      where: { id: { in: questionOrder.length ? questionOrder : undefined } },
    });
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions = questionOrder
      .map((qid) => questionMap.get(qid))
      .filter(Boolean) as typeof questions;

    // --- IN_PROGRESS: return questions without correctAnswer (resume view) ---
    if (attempt.status === "IN_PROGRESS") {
      const publicQuestions = orderedQuestions.map((q, idx) => ({
        id: q.id,
        question: q.question,
        options: parseJsonArray<string>(q.options),
        marks: q.marks,
        order: idx,
      }));

      const totalMarks = orderedQuestions.reduce(
        (sum, q) => sum + q.marks,
        0
      );

      return NextResponse.json({
        attemptId: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        questionOrder,
        questions: publicQuestions,
        totalQuestions: orderedQuestions.length,
        totalMarks,
        timeLimit: attempt.quizLink.timeLimit,
        maxAttempts: attempt.quizLink.maxAttempts,
        passThreshold: attempt.quizLink.passThreshold,
        requireFullscreen: attempt.quizLink.requireFullscreen,
        event: attempt.event,
      });
    }

    // --- COMPLETED / TIMEOUT / CHEAT_DETECTED: review payload ---
    const answers = attempt.answers
      ? (() => {
          try {
            const parsed = JSON.parse(attempt.answers);
            return typeof parsed === "object" && parsed !== null
              ? (parsed as Record<string, number>)
              : {};
          } catch {
            return {};
          }
        })()
      : {};

    const reviewQuestions = orderedQuestions.map((q, idx) => {
      const options = parseJsonArray<string>(q.options);
      const chosenIndex = answers[q.id];
      const correctIndex = q.correctAnswer;
      const isCorrect = chosenIndex === correctIndex;
      const marksAwarded = isCorrect ? q.marks : 0;
      return {
        id: q.id,
        order: idx,
        question: q.question,
        options,
        chosenIndex: chosenIndex === undefined ? null : chosenIndex,
        correctIndex,
        isCorrect,
        marks: q.marks,
        marksAwarded,
        explanation: q.explanation,
      };
    });

    return NextResponse.json({
      attemptId: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      percentage: attempt.percentage,
      passed: attempt.passed,
      tabSwitches: attempt.tabSwitches,
      fullscreenExits: attempt.fullscreenExits,
      copyAttempts: attempt.copyAttempts,
      rightClicks: attempt.rightClicks,
      timeTaken: attempt.timeTaken,
      questionOrder,
      questions: reviewQuestions,
      totalQuestions: orderedQuestions.length,
      showResults: attempt.quizLink.showResults,
      event: attempt.event,
      quizLink: attempt.quizLink,
    });
  } catch (error) {
    console.error("[GET /api/attempts/[id]] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch attempt" },
      { status: 500 }
    );
  }
}
