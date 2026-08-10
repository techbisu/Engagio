import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { toActivityDto, fetchActivityQuizLink } from "@/lib/activity-mapper";

/** Check the session for an admin role. Returns true if the caller is an admin. */
async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/activities/[id]/close — admin closes an activity.
 *  Sets status=CLOSED, endsAt=now() (if not already set).
 */
export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const existing = await db.activity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const updated = await db.activity.update({
      where: { id },
      data: {
        status: "CLOSED",
        endsAt: existing.endsAt ?? new Date(),
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
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
