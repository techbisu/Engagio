import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/me/activities
 *
 * Returns current and upcoming activities for events the participant has
 * registered for. Only shows LIVE and SCHEDULED activities.
 *
 * Returns: { events: [{ event: {...}, activities: [...] }] }
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Find all events the user has registered for
    const registrations = await db.registration.findMany({
      where: { userId },
      select: {
        id: true,
        eventId: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            image: true,
            startDate: true,
            endDate: true,
            isActive: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (registrations.length === 0) {
      return NextResponse.json({ events: [] });
    }

    // For each registered event, fetch LIVE and SCHEDULED activities
    const eventsWithActivities = await Promise.all(
      registrations.map(async (reg) => {
        const activities = await db.activity.findMany({
          where: {
            eventId: reg.eventId,
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

        // Fetch quiz link slugs
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

        return {
          registration: { id: reg.id, createdAt: reg.createdAt.toISOString() },
          event: {
            ...reg.event,
            startDate: reg.event.startDate.toISOString(),
            endDate: reg.event.endDate.toISOString(),
          },
          activities: activities.map((a) => ({
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
            quizLink: a.quizLinkId ? quizLinkMap.get(a.quizLinkId) : null,
          })),
        };
      })
    );

    // Filter out events with no activities
    const filtered = eventsWithActivities.filter((e) => e.activities.length > 0);

    return NextResponse.json({ events: filtered });
  } catch (e) {
    console.error("[GET /api/me/activities] error:", e);
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
