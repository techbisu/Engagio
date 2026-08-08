import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveOrgMembership } from "@/lib/org-api";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/organizations/[id]/stats
 *
 * Returns org dashboard stats. All counts are org-scoped (via Event.organizationId).
 *
 *   - eventCount:        events in the org
 *   - participantCount:  distinct users via registrations
 *   - activityCount:     activities (sum across the org's events)
 *   - assessmentCount:   quiz links (sum across the org's events)
 *   - certificateCount:  certificates (sum across the org's events)
 *   - memberCount:       organization members
 *   - attemptCount:      quiz attempts (sum across the org's events)
 *
 * Any member can view org stats.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const result = await resolveOrgMembership(id, "PARTICIPANT");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Aggregate — all counts run in parallel.
    const [
      eventCount,
      memberCount,
      activityCount,
      assessmentCount,
      certificateCount,
      attemptCount,
      participantAgg,
    ] = await Promise.all([
      db.event.count({ where: { organizationId: id } }),
      db.organizationMember.count({ where: { organizationId: id } }),
      db.activity.count({
        where: { event: { organizationId: id } },
      }),
      db.quizLink.count({
        where: { event: { organizationId: id } },
      }),
      db.certificate.count({
        where: { event: { organizationId: id } },
      }),
      db.quizAttempt.count({
        where: { event: { organizationId: id } },
      }),
      // Distinct participant userId via registrations.
      db.registration.groupBy({
        by: ["userId"],
        where: { event: { organizationId: id } },
        _count: { _all: true },
      }),
    ]);

    const participantCount = participantAgg.length;

    return NextResponse.json({
      eventCount,
      participantCount,
      activityCount,
      assessmentCount,
      certificateCount,
      memberCount,
      attemptCount,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
