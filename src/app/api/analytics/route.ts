import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    // Dashboard analytics are org-scoped to the caller's organization.
    const auth = await requirePermission(req, "analytics.view");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const orgId = auth.ctx.orgId;
    const orgAttemptWhere = { event: { organizationId: orgId } };

    const statuses = ["IN_PROGRESS", "COMPLETED", "CHEAT_DETECTED", "TIMEOUT"];

    const [
      totalEvents,
      totalQuestions,
      totalQuizLinks,
      totalAttempts,
      totalUsers,
      completedAttempts,
      inProgressAttempts,
      cheatDetectedAttempts,
      timeoutAttempts,
      passedCount,
      avgAgg,
      recentAttemptsRaw,
      allAttemptsEventIds,
    ] = await Promise.all([
      db.event.count({ where: { organizationId: orgId } }),
      db.question.count({ where: { organizationId: orgId } }),
      db.quizLink.count({ where: orgAttemptWhere }),
      db.quizAttempt.count({ where: orgAttemptWhere }),
      db.organizationMember.count({
        where: { organizationId: orgId, status: "ACTIVE" },
      }),
      db.quizAttempt.count({ where: { ...orgAttemptWhere, status: "COMPLETED" } }),
      db.quizAttempt.count({ where: { ...orgAttemptWhere, status: "IN_PROGRESS" } }),
      db.quizAttempt.count({ where: { ...orgAttemptWhere, status: "CHEAT_DETECTED" } }),
      db.quizAttempt.count({ where: { ...orgAttemptWhere, status: "TIMEOUT" } }),
      db.quizAttempt.count({
        where: { ...orgAttemptWhere, status: "COMPLETED", passed: true },
      }),
      db.quizAttempt.aggregate({
        _avg: { percentage: true },
        where: { ...orgAttemptWhere, status: "COMPLETED", percentage: { not: null } },
      }),
      db.quizAttempt.findMany({
        take: 5,
        orderBy: { startedAt: "desc" },
        where: orgAttemptWhere,
        include: {
          user: { select: { name: true, email: true } },
          event: { select: { title: true } },
        },
      }),
      // Fetch all attempt eventIds to compute top events by attempt count
      db.quizAttempt.findMany({
        where: orgAttemptWhere,
        select: { eventId: true },
      }),
    ]);

    // Compute top events by attempt count (grouped in JS to avoid Prisma typing pitfalls)
    const countsByEvent = new Map<string, number>();
    for (const a of allAttemptsEventIds) {
      countsByEvent.set(a.eventId, (countsByEvent.get(a.eventId) || 0) + 1);
    }
    const topEventsRaw = [...countsByEvent.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([eventId, attemptCount]) => ({ eventId, attemptCount }));

    const recentAttempts = recentAttemptsRaw.map((a) => ({
      id: a.id,
      status: a.status,
      percentage: a.percentage,
      startedAt: a.startedAt,
      user: a.user,
      event: a.event,
    }));

    // Resolve top events — fetch event titles + per-event aggregates
    const topEventIds = topEventsRaw.map((t) => t.eventId);
    const topEventsInfo = await db.event.findMany({
      where: { id: { in: topEventIds }, organizationId: orgId },
      select: { id: true, title: true },
    });
    const topEventMap = new Map(topEventsInfo.map((e) => [e.id, e.title]));

    const topEventAggs = await Promise.all(
      topEventIds.map((eid) =>
        db.quizAttempt.aggregate({
          _avg: { percentage: true },
          _count: true,
          where: { eventId: eid, status: "COMPLETED" },
        })
      )
    );

    const averageScore = avgAgg._avg.percentage
      ? Math.round(avgAgg._avg.percentage * 10) / 10
      : 0;
    const passRate =
      completedAttempts > 0
        ? Math.round((passedCount / completedAttempts) * 1000) / 10
        : 0;

    const topEvents = topEventsRaw.map((t, idx) => {
      const agg = topEventAggs[idx];
      const completedCount = agg._count;
      const avgPct = agg._avg.percentage
        ? Math.round(agg._avg.percentage * 10) / 10
        : 0;
      const totalAttemptsForEvent = t.attemptCount;
      const completionRate =
        totalAttemptsForEvent > 0
          ? Math.round((completedCount / totalAttemptsForEvent) * 1000) / 10
          : 0;
      return {
        eventId: t.eventId,
        title: topEventMap.get(t.eventId) || "Unknown",
        attemptCount: totalAttemptsForEvent,
        avgScore: avgPct,
        completionRate,
      };
    });

    return NextResponse.json({
      totalEvents,
      totalQuestions,
      totalQuizLinks,
      totalAttempts,
      totalUsers,
      completedAttempts,
      inProgressAttempts,
      cheatDetectedAttempts,
      timeoutAttempts,
      averageScore,
      passRate,
      recentAttempts,
      topEvents,
      statusBreakdown: {
        IN_PROGRESS: inProgressAttempts,
        COMPLETED: completedAttempts,
        CHEAT_DETECTED: cheatDetectedAttempts,
        TIMEOUT: timeoutAttempts,
        statuses,
      },
    });
  } catch (error) {
    console.error("[GET /api/analytics] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
