import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, ownsResource } from "@/lib/tenant";
import { parseJsonArray } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, "analytics.view");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    const event = await db.event.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        isActive: true,
      },
    });

    if (!event || !ownsResource(event, auth.ctx)) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const [
      totalAttempts,
      completedAttempts,
      recentAttempts,
      avgAgg,
      passedAgg,
      allCompletedAttempts,
      questions,
    ] = await Promise.all([
      db.quizAttempt.count({ where: { eventId: id } }),
      db.quizAttempt.count({
        where: { eventId: id, status: "COMPLETED" },
      }),
      db.quizAttempt.findMany({
        where: { eventId: id },
        take: 10,
        orderBy: { startedAt: "desc" },
        include: {
          user: { select: { name: true, email: true, image: true } },
          quizLink: { select: { slug: true } },
        },
      }),
      db.quizAttempt.aggregate({
        _avg: { percentage: true },
        where: {
          eventId: id,
          status: "COMPLETED",
          percentage: { not: null },
        },
      }),
      db.quizAttempt.count({
        where: { eventId: id, status: "COMPLETED", passed: true },
      }),
      db.quizAttempt.findMany({
        where: { eventId: id, status: "COMPLETED" },
        select: {
          percentage: true,
          answers: true,
          questionOrder: true,
        },
      }),
      db.question.findMany({
        where: { eventId: id },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          question: true,
          options: true,
          correctAnswer: true,
          marks: true,
          order: true,
        },
      }),
    ]);

    const averageScore = avgAgg._avg.percentage
      ? Math.round(avgAgg._avg.percentage * 10) / 10
      : 0;
    const passRate =
      completedAttempts > 0
        ? Math.round((passedAgg / completedAttempts) * 1000) / 10
        : 0;

    // Build score distribution buckets (0-20, 20-40, 40-60, 60-80, 80-100)
    const bucketLabels = ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"];
    const bucketCounts = [0, 0, 0, 0, 0];
    for (const a of allCompletedAttempts) {
      const pct = a.percentage ?? 0;
      let idx: number;
      if (pct < 20) idx = 0;
      else if (pct < 40) idx = 1;
      else if (pct < 60) idx = 2;
      else if (pct < 80) idx = 3;
      else idx = 4;
      bucketCounts[idx]++;
    }
    const scoreDistribution = bucketLabels.map((label, i) => ({
      label,
      count: bucketCounts[i],
      pct:
        completedAttempts > 0
          ? Math.round((bucketCounts[i] / completedAttempts) * 1000) / 10
          : 0,
    }));

    // Per-question performance (across completed attempts)
    const questionAttempts: Record<string, { correct: number; total: number }> =
      {};
    for (const q of questions) {
      questionAttempts[q.id] = { correct: 0, total: 0 };
    }

    for (const a of allCompletedAttempts) {
      const answers = a.answers
        ? (() => {
            try {
              const parsed = JSON.parse(a.answers);
              return typeof parsed === "object" && parsed !== null
                ? (parsed as Record<string, number>)
                : {};
            } catch {
              return {};
            }
          })()
        : {};

      for (const q of questions) {
        const chosen = answers[q.id];
        if (chosen === undefined) continue; // skip unanswered
        questionAttempts[q.id].total++;
        if (chosen === q.correctAnswer) {
          questionAttempts[q.id].correct++;
        }
      }
    }

    const questionPerformance = questions.map((q) => {
      const stat = questionAttempts[q.id];
      const correctPct =
        stat.total > 0
          ? Math.round((stat.correct / stat.total) * 1000) / 10
          : 0;
      return {
        id: q.id,
        question: q.question,
        order: q.order,
        marks: q.marks,
        correctAnswer: q.correctAnswer,
        options: parseJsonArray<string>(q.options),
        attemptsAnswered: stat.total,
        correctCount: stat.correct,
        correctPct,
      };
    });

    return NextResponse.json({
      event,
      totalAttempts,
      completedAttempts,
      averageScore,
      passRate,
      scoreDistribution,
      questionPerformance,
      recentAttempts: recentAttempts.map((a) => ({
        id: a.id,
        status: a.status,
        score: a.score,
        totalMarks: a.totalMarks,
        percentage: a.percentage,
        passed: a.passed,
        timeTaken: a.timeTaken,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        user: a.user,
        quizLink: a.quizLink,
      })),
    });
  } catch (error) {
    console.error("[GET /api/analytics/event/[id]] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch event analytics" },
      { status: 500 }
    );
  }
}
