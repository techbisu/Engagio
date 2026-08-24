/**
 * Shared logic for public org lookup.
 * Used by both:
 *   - /api/public/org?slug=... (query param)
 *   - /api/public/org/[slug]   (path param)
 */

import { NextResponse } from "next/server"
import { db } from "./db"

export interface PublicOrgResponse {
  organization: {
    id: string
    name: string
    slug: string
    description: string | null
    logoUrl: string | null
    website: string | null
    primaryColor: string
    secondaryColor: string
    industry: string | null
  }
  events: Array<{
    id: string
    title: string
    slug: string | null
    description: string
    image: string | null
    startDate: string
    endDate: string
    questionCount: number
    quizSlug: string | null
    timeLimit: number
    passThreshold: number
  }>
}

/**
 * Fetch org details + active events by slug.
 * Returns a NextResponse (either 200 with data or 404).
 */
export async function fetchOrgBySlug(
  slug: string
): Promise<NextResponse<PublicOrgResponse | { error: string }>> {
  const org = await db.organization.findUnique({
    where: { slug, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      website: true,
      primaryColor: true,
      secondaryColor: true,
      industry: true,
    },
  })

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    )
  }

  // Fetch active events for this org
  const events = await db.event.findMany({
    where: { organizationId: org.id, isActive: true },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      image: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: "asc" },
  })

  // For each event, get quiz link + question count
  const eventsWithDetails = await Promise.all(
    events.map(async (e) => {
      const quizLink = await db.quizLink.findFirst({
        where: { eventId: e.id, isActive: true },
        select: { slug: true, timeLimit: true, passThreshold: true },
      })
      const questionCount = await db.question.count({
        where: { eventId: e.id },
      })
      return {
        id: e.id,
        title: e.title,
        slug: e.slug,
        description: e.description,
        image: e.image,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        questionCount,
        quizSlug: quizLink?.slug || null,
        timeLimit: quizLink?.timeLimit || 0,
        passThreshold: quizLink?.passThreshold || 0,
      }
    })
  )

  return NextResponse.json({
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      logoUrl: org.logoUrl,
      website: org.website,
      primaryColor: org.primaryColor,
      secondaryColor: org.secondaryColor,
      industry: org.industry,
    },
    events: eventsWithDetails,
  })
}
