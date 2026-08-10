import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * GET /api/public/event?slug=medical-summit-2026
 *
 * PUBLIC — no auth required.
 * Returns event details for the public event landing page.
 * Includes org info + quiz link + question count.
 */
export async function GET(req: NextRequest) {
  try {
    const slug = new URL(req.url).searchParams.get("slug")
    if (!slug) {
      return NextResponse.json({ error: "Event slug is required" }, { status: 400 })
    }

    const event = await db.event.findUnique({
      where: { slug, isActive: true },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const quizLink = await db.quizLink.findFirst({
      where: { eventId: event.id, isActive: true },
      select: {
        id: true,
        slug: true,
        timeLimit: true,
        maxAttempts: true,
        passThreshold: true,
        requireFullscreen: true,
      },
    })

    const questionCount = await db.question.count({ where: { eventId: event.id } })

    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        description: event.description,
        image: event.image,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        requireRegistration: event.requireRegistration,
        paymentMethod: event.paymentMethod,
        paymentAmount: event.paymentAmount,
        paymentCurrency: event.paymentCurrency,
        certEnabled: event.certEnabled,
        certPassingScore: event.certPassingScore,
        organization: event.organization ? {
          id: event.organization.id,
          name: event.organization.name,
          slug: event.organization.slug,
          logoUrl: event.organization.logoUrl,
          primaryColor: event.organization.primaryColor,
        } : null,
      },
      quizLink: quizLink ? {
        id: quizLink.id,
        slug: quizLink.slug,
        timeLimit: quizLink.timeLimit,
        maxAttempts: quizLink.maxAttempts,
        passThreshold: quizLink.passThreshold,
        requireFullscreen: quizLink.requireFullscreen,
      } : null,
      questionCount,
    })
  } catch (error) {
    console.error("[GET /api/public/event] error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(error) },
      { status: 500 }
    )
  }
}
