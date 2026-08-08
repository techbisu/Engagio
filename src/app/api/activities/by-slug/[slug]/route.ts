import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import {
  toActivityDto,
  toActivityQuestionDto,
  fetchActivityQuizLink,
} from "@/lib/activity-mapper";

type RouteContext = { params: Promise<{ slug: string }> };

/** GET /api/activities/by-slug/[slug] — public activity metadata + questions.
 *  Anyone with the slug can read this so the participant landing page can show
 *  the activity before login. The participant must be authenticated to respond.
 *  If the activity is not isEnabled OR status is not LIVE/SCHEDULED, return 404.
 *  For authed callers, also returns `hasResponded` (whether the user already
 *  has a participation row).
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { slug } = await ctx.params;
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const activity = await db.activity.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { questions: true, responses: true, participations: true },
        },
        questions: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Visibility gate: must be enabled + live-or-scheduled.
    if (!activity.isEnabled) {
      return NextResponse.json(
        { error: "This activity is not currently available." },
        { status: 404 }
      );
    }
    if (activity.status !== "LIVE" && activity.status !== "SCHEDULED") {
      return NextResponse.json(
        { error: `Activity is ${activity.status.toLowerCase()}.` },
        { status: 404 }
      );
    }

    // Determine whether the caller has already responded (only meaningful
    // for non-Q&A activities — Q&A allows multiple submissions).
    let hasResponded = false;
    let canRespond = false;
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id ?? null;
    if (userId) {
      canRespond = true;
      if (activity.type !== "Q_AND_A") {
        const existing = await db.activityParticipation.findUnique({
          where: {
            activityId_participantId: {
              activityId: activity.id,
              participantId: userId,
            },
          },
          select: { id: true },
        });
        hasResponded = !!existing;
      }
    }

    const quizLink = await fetchActivityQuizLink(activity.quizLinkId);

    return NextResponse.json({
      activity: toActivityDto(activity, quizLink),
      questions: activity.questions.map(toActivityQuestionDto),
      // Only meaningful for non-Q&A activities (Q&A allows multiple).
      hasResponded,
      canRespond,
      isAuthenticated: !!session?.user,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
