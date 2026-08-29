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

    // Find all events the user has registered for OR attempted.
    // Registrations = events with a registration form.
    // Attempts = events the user has taken a quiz for (even without registration).
    // Quiz links = events with active quiz links the user can take (always include these
    // so the dashboard shows events the user CAN participate in, even if they haven't yet).
    const [registrations, attempts, activeQuizLinks] = await Promise.all([
      db.registration.findMany({
        where: { userId },
        select: {
          id: true,
          eventId: true,
          createdAt: true,
          event: {
            select: {
              id: true, title: true, slug: true, image: true,
              startDate: true, endDate: true, isActive: true,
              organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      // Events the user has attempted (has at least one QuizAttempt)
      db.quizAttempt.findMany({
        where: { userId },
        select: {
          eventId: true,
          event: {
            select: {
              id: true, title: true, slug: true, image: true,
              startDate: true, endDate: true, isActive: true,
              organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
            },
          },
        },
        distinct: ["eventId"],
      }),
      // Events with active quiz links (events the user CAN take)
      db.quizLink.findMany({
        where: {
          isActive: true,
          event: { isActive: true },
        },
        select: {
          id: true,
          slug: true,
          eventId: true,
          event: {
            select: {
              id: true, title: true, slug: true, image: true,
              startDate: true, endDate: true, isActive: true,
              organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
            },
          },
        },
      }),
    ]);

    // Merge: collect unique event IDs from all three sources.
    const eventMap = new Map<string, { event: any; quizLinkSlug?: string }>()

    // Add registered events
    for (const reg of registrations) {
      eventMap.set(reg.eventId, { event: reg.event })
    }

    // Add attempted events
    for (const att of attempts) {
      if (!eventMap.has(att.eventId)) {
        eventMap.set(att.eventId, { event: att.event })
      }
    }

    // Add events with active quiz links (user CAN take these)
    for (const ql of activeQuizLinks) {
      if (!eventMap.has(ql.eventId)) {
        eventMap.set(ql.eventId, { event: ql.event, quizLinkSlug: ql.slug })
      } else {
        // Already in the map — add the quiz link slug if missing
        const existing = eventMap.get(ql.eventId)!
        if (!existing.quizLinkSlug) existing.quizLinkSlug = ql.slug
      }
    }

    const allEventIds = Array.from(eventMap.keys())

    if (allEventIds.length === 0) {
      return NextResponse.json({ events: [] });
    }

    // For each event, fetch activities (LIVE + SCHEDULED) + quiz links.
    const eventsWithActivities = await Promise.all(
      allEventIds.map(async (eventId) => {
        const entry = eventMap.get(eventId)!
        const ev = entry.event

        // Fetch activities for this event
        const activities = await db.activity.findMany({
          where: { eventId, status: { in: ["LIVE", "SCHEDULED"] } },
          select: {
            id: true, type: true, title: true, description: true,
            status: true, slug: true, scheduledAt: true, endsAt: true,
            isAcceptingResponses: true, quizLinkId: true,
            _count: { select: { questions: true, participations: true } },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        })

        // Fetch ALL active quiz links for this event (not just from activities).
        // This ensures the dashboard shows "Start Quiz" even if no Activity row exists.
        const quizLinksForEvent = await db.quizLink.findMany({
          where: { eventId, isActive: true },
          select: { id: true, slug: true, timeLimit: true, passThreshold: true, questionCount: true },
        })

        // If there are quiz links but no activities, create a synthetic activity
        // so the dashboard shows a "Start Quiz" button.
        const quizLinkMap = new Map(quizLinksForEvent.map((ql) => [ql.id, ql]))

        // If we found a quiz link slug from the activeQuizLinks query, ensure it's included
        if (entry.quizLinkSlug && !quizLinksForEvent.find((ql) => ql.slug === entry.quizLinkSlug)) {
          const ql = await db.quizLink.findUnique({
            where: { slug: entry.quizLinkSlug },
            select: { id: true, slug: true, timeLimit: true, passThreshold: true, questionCount: true },
          })
          if (ql) {
            quizLinksForEvent.push(ql)
            quizLinkMap.set(ql.id, ql)
          }
        }

        // Build activities list — include real activities + a synthetic "quiz" activity
        // for each quiz link that doesn't have a matching Activity row.
        const activityQuizLinkIds = new Set(activities.map((a) => a.quizLinkId).filter(Boolean))
        const standaloneQuizLinks = quizLinksForEvent.filter((ql) => !activityQuizLinkIds.has(ql.id))

        const allActivities = [
          ...activities.map((a) => ({
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
          // Add standalone quiz links as synthetic activities
          ...standaloneQuizLinks.map((ql) => ({
            id: `quiz-${ql.id}`,
            type: "QUIZ",
            title: "Quiz",
            description: null,
            status: "LIVE" as const,
            slug: ql.slug,
            scheduledAt: null,
            endsAt: null,
            isAcceptingResponses: true,
            questionCount: 0,
            participantCount: 0,
            quizLink: ql,
          })),
        ]

        return {
          event: {
            ...ev,
            startDate: ev.startDate.toISOString(),
            endDate: ev.endDate.toISOString(),
          },
          activities: allActivities,
        }
      })
    )

    // Filter out events with no activities/quiz links
    const filtered = eventsWithActivities.filter((e) => e.activities.length > 0)

    return NextResponse.json({ events: filtered });
  } catch (e) {
    console.error("[GET /api/me/activities] error:", e);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
