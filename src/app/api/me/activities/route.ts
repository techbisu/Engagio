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
 * Org scoping: When the `x-org-slug` header is sent (set by the participant
 * dashboard via the student `api()` helper), only events belonging to that
 * org are returned. This prevents a participant on org A's dashboard from
 * seeing events from org B, C, etc. just because they registered or
 * attempted them previously.
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

    // ── Resolve the target org from the `x-org-slug` header ──────────────
    // When present, we filter ALL sources (registrations, attempts, active
    // quiz links) by this org so the participant dashboard only shows
    // events/activities for the org they're currently viewing.
    const targetOrgSlug = req.headers.get("x-org-slug");
    let targetOrgId: string | null = null;
    if (targetOrgSlug) {
      const org = await db.organization.findUnique({
        where: { slug: targetOrgSlug },
        select: { id: true },
      });
      if (org) {
        targetOrgId = org.id;
      }
      // If the org slug is invalid, we fall back to showing all events
      // (no filter) so the dashboard isn't accidentally empty.
    }

    // Build the where-clause for org scoping once.
    const orgFilter = targetOrgId
      ? { event: { organizationId: targetOrgId } }
      : {};

    // Find all events the user has registered for OR attempted.
    // We collect unique event IDs from multiple sources and merge them.
    const [registrations, attemptEvents, activeQuizLinks] = await Promise.all([
      // 1. Events the user has registered for (org-scoped)
      db.registration.findMany({
        where: { userId, ...orgFilter },
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
        orderBy: { createdAt: "desc" },
      }),
      // 2. Events the user has attempted (org-scoped)
      db.quizAttempt.findMany({
        where: { userId, ...orgFilter },
        select: { eventId: true },
      }),
      // 3. Events with active quiz links (org-scoped — only THIS org's links)
      db.quizLink.findMany({
        where: {
          isActive: true,
          event: {
            isActive: true,
            ...(targetOrgId ? { organizationId: targetOrgId } : {}),
          },
        },
        select: {
          id: true, slug: true, eventId: true,
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

    // Get unique event IDs from attempts
    const attemptEventIds = [...new Set(attemptEvents.map((a) => a.eventId))]

    // Fetch event details for attempted events (not already in registrations)
    const regEventIds = new Set(registrations.map((r) => r.eventId))
    const newAttemptEventIds = attemptEventIds.filter((id) => !regEventIds.has(id))

    let attemptedEvents: { eventId: string; event: any }[] = []
    if (newAttemptEventIds.length > 0) {
      const events = await db.event.findMany({
        where: {
          id: { in: newAttemptEventIds },
          ...(targetOrgId ? { organizationId: targetOrgId } : {}),
        },
        select: {
          id: true, title: true, slug: true, image: true,
          startDate: true, endDate: true, isActive: true,
          organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
      })
      attemptedEvents = events.map((ev) => ({ eventId: ev.id, event: ev }))
    }

    // Merge: collect unique event IDs from all sources.
    const eventMap = new Map<string, { event: any; quizLinkSlug?: string }>()

    // Add registered events
    for (const reg of registrations) {
      eventMap.set(reg.eventId, { event: reg.event })
    }

    // Add attempted events
    for (const att of attemptedEvents) {
      if (!eventMap.has(att.eventId)) {
        eventMap.set(att.eventId, { event: att.event })
      }
    }

    // Add events with active quiz links (user CAN take these)
    for (const ql of activeQuizLinks) {
      if (!eventMap.has(ql.eventId)) {
        eventMap.set(ql.eventId, { event: ql.event, quizLinkSlug: ql.slug })
      } else {
        const existing = eventMap.get(ql.eventId)!
        if (!existing.quizLinkSlug) existing.quizLinkSlug = ql.slug
      }
    }

    const allEventIds = Array.from(eventMap.keys())

    if (allEventIds.length === 0) {
      return NextResponse.json({ events: [] });
    }

    // For each event, fetch activities + quiz links.
    const eventsWithActivities = await Promise.all(
      allEventIds.map(async (eventId) => {
        const entry = eventMap.get(eventId)!
        const ev = entry.event

        // Fetch activities for this event
        const activities = await db.activity.findMany({
          where: { eventId, status: { in: ["LIVE", "SCHEDULED"] } },
          select: {
            id: true, type: true, title: true, description: true,
            status: true, slug: true, startsAt: true, endsAt: true,
            isEnabled: true, quizLinkId: true,
            _count: { select: { questions: true, participations: true } },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        })

        // Fetch ALL active quiz links for this event
        const quizLinksForEvent = await db.quizLink.findMany({
          where: { eventId, isActive: true },
          select: { id: true, slug: true, timeLimit: true, passThreshold: true, questionCount: true },
        })
        const quizLinkMap = new Map(quizLinksForEvent.map((ql) => [ql.id, ql]))

        // Build synthetic activities for quiz links not already linked to an Activity
        const activityQuizLinkIds = new Set(activities.map((a) => a.quizLinkId).filter(Boolean))
        const standaloneQuizLinks = quizLinksForEvent.filter((ql) => !activityQuizLinkIds.has(ql.id))

        const allActivities = [
          ...activities.map((a) => ({
            id: a.id, type: a.type, title: a.title, description: a.description,
            status: a.status, slug: a.slug,
            scheduledAt: a.startsAt?.toISOString() ?? null,
            endsAt: a.endsAt?.toISOString() ?? null,
            isAcceptingResponses: a.isEnabled,
            questionCount: a._count.questions,
            participantCount: a._count.participations,
            quizLink: a.quizLinkId ? quizLinkMap.get(a.quizLinkId) : null,
          })),
          ...standaloneQuizLinks.map((ql) => ({
            id: `quiz-${ql.id}`,
            type: "QUIZ",
            title: "Quiz",
            description: null,
            status: "LIVE" as const,
            slug: ql.slug,
            scheduledAt: null, endsAt: null,
            isAcceptingResponses: true,
            // Use the quiz link's questionCount (random subset size) if set,
            // otherwise the total event question count.
            questionCount: ql.questionCount > 0 ? ql.questionCount : 0,
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
