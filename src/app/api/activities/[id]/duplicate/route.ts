import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { generateQuizSlug } from "@/lib/utils";
import { toActivityDto, fetchActivityQuizLink } from "@/lib/activity-mapper";

/** Check the session for an admin role. Returns true if the caller is an admin. */
async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/activities/[id]/duplicate — admin duplicates an activity.
 *  Copies title (+ " (Copy)"), description, type, settings, and questions —
 *  but NOT responses or participations. Status is reset to DRAFT, slug is
 *  regenerated, sortOrder is appended to the end.
 */
export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentAdminId = (session?.user as any)?.id ?? null;

    const { id } = await ctx.params;
    const existing = await db.activity.findUnique({
      where: { id },
      include: { questions: { orderBy: { sortOrder: "asc" } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // ----- Generate a fresh unique slug -----
    let slug = "";
    let attempt = 0;
    while (attempt < 5) {
      const candidate = generateQuizSlug(6);
      const clash = await db.activity.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!clash) {
        slug = candidate;
        break;
      }
      attempt++;
    }
    if (!slug) {
      return NextResponse.json(
        { error: "Failed to generate a unique slug. Please try again." },
        { status: 500 }
      );
    }

    // ----- New sortOrder: current max + 1 (so duplicate goes to end) -----
    const maxRow = await db.activity.aggregate({
      where: { eventId: existing.eventId },
      _max: { sortOrder: true },
    });
    const nextSort = (maxRow._max.sortOrder ?? -1) + 1;

    // ----- Create the duplicate + questions in a transaction -----
    const created = await db.$transaction(async (tx) => {
      const newActivity = await tx.activity.create({
        data: {
          eventId: existing.eventId,
          type: existing.type,
          title: `${existing.title} (Copy)`,
          description: existing.description,
          status: "DRAFT",
          isEnabled: true,
          sortOrder: nextSort,
          // Don't carry over scheduling — the duplicate is a fresh draft.
          startsAt: null,
          endsAt: null,
          settings: existing.settings,
          quizLinkId: existing.quizLinkId,
          session: existing.session,
          slug,
          // Inherit createdBy from the current admin, not the original.
          createdBy: currentAdminId,
        },
        include: {
          _count: {
            select: { questions: true, responses: true, participations: true },
          },
        },
      });

      // Copy each question verbatim, preserving sortOrder.
      for (const q of existing.questions) {
        await tx.activityQuestion.create({
          data: {
            activityId: newActivity.id,
            text: q.text,
            type: q.type,
            options: q.options,
            required: q.required,
            sortOrder: q.sortOrder,
          },
        });
      }

      // Re-fetch with updated _count after question inserts.
      return tx.activity.findUnique({
        where: { id: newActivity.id },
        include: {
          _count: {
            select: { questions: true, responses: true, participations: true },
          },
        },
      });
    });

    const quizLink = await fetchActivityQuizLink(created?.quizLinkId);

    return NextResponse.json(toActivityDto(created, quizLink), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
