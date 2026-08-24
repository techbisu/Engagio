import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, ownsResource } from "@/lib/tenant";
import { toActivityDto, fetchActivityQuizLink } from "@/lib/activity-mapper";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/activities/[id]/start — admin activates an activity.
 *  Sets status=LIVE, isEnabled=true, startsAt=now() (if not already set).
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "activity.update");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await ctx.params;
    const existing = await db.activity.findUnique({
      where: { id },
      include: { event: { select: { organizationId: true } } },
    });
    if (!existing || !ownsResource(existing.event, auth.ctx)) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const updated = await db.activity.update({
      where: { id },
      data: {
        status: "LIVE",
        isEnabled: true,
        startsAt: existing.startsAt ?? new Date(),
      },
      include: {
        _count: {
          select: { questions: true, responses: true, participations: true },
        },
      },
    });
    const quizLink = await fetchActivityQuizLink(updated.quizLinkId);
    return NextResponse.json(toActivityDto(updated, quizLink));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
