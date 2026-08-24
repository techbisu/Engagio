import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/public/activities?eventId=xxx
 *
 * PUBLIC endpoint — returns only LIVE and SCHEDULED activities for an event.
 * Used by the event landing page's ACTIVITIES section to show activity cards
 * that participants can click to start.
 *
 * Returns: { activities: [{ id, type, title, description, status, slug, ... }] }
 */
export async function GET(req: NextRequest) {
  try {
    const eventId = req.nextUrl.searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json(
        { error: "Missing eventId query param" },
        { status: 400 }
      );
    }

    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true, isActive: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Only show LIVE and SCHEDULED activities to the public
    const activities = await db.activity.findMany({
      where: {
        eventId,
        status: { in: ["LIVE", "SCHEDULED"] },
      },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        status: true,
        slug: true,
        scheduledAt: true,
        endsAt: true,
        isAcceptingResponses: true,
        quizLinkId: true,
        _count: {
          select: {
            questions: true,
            participations: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    // Fetch quiz link slugs for quiz-type activities
    const quizLinkIds = activities
      .map((a) => a.quizLinkId)
      .filter((id): id is string => !!id);
    const quizLinks = await Promise.all(
      quizLinkIds.map((id) =>
        db.quizLink.findUnique({
          where: { id },
          select: { id: true, slug: true, timeLimit: true, passThreshold: true },
        })
      )
    );
    const quizLinkMap = new Map(
      quizLinks
        .filter((ql): ql is NonNullable<typeof ql> => !!ql)
        .map((ql) => [ql.id, ql])
    );

    const result = activities.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      status: a.status,
      slug: a.slug,
      scheduledAt: a.scheduledAt?.toISOString() ?? null,
      endsAt: a.endsAt?.toISOString() ?? null,
      isAcceptingResponses: a.isAcceptingResponses,
      questionCount: a._count.questions,
      participantCount: a._count.participations,
      quizLink: a.quizLinkId
        ? quizLinkMap.get(a.quizLinkId)
        : null,
    }));

    return NextResponse.json({ activities: result });
  } catch (e) {
    console.error("[GET /api/public/activities] error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
