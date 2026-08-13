import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * POST /api/events/register-participant
 *
 * Called when a participant signs in from a quiz deep-link (/quiz/SLUG).
 * Automatically adds them as a PARTICIPANT member in the event's organization
 * so the org admin can see them in their participant list.
 *
 * Body: { quizSlug: string }
 * Auth: Required (the participant must be signed in)
 *
 * This is idempotent — if the membership already exists, it returns success.
 * If the participant is already an org member with a higher role (e.g. ADMIN),
 * it does NOT downgrade their role.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { quizSlug } = body

    if (!quizSlug || typeof quizSlug !== "string") {
      return NextResponse.json({ error: "quizSlug is required" }, { status: 400 })
    }

    // Look up the quiz link → event → organization
    const quizLink = await db.quizLink.findUnique({
      where: { slug: quizSlug },
      include: {
        event: {
          select: { id: true, organizationId: true, title: true },
        },
      },
    })

    if (!quizLink || !quizLink.event?.organizationId) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const orgId = quizLink.event.organizationId
    const userId = session.user.id

    // Check if the user is already a member of this org
    const existing = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId },
      },
    })

    if (existing) {
      // Already a member — don't downgrade their role
      return NextResponse.json({
        success: true,
        alreadyMember: true,
        role: existing.role,
        orgId,
      })
    }

    // Create PARTICIPANT membership
    await db.organizationMember.create({
      data: {
        organizationId: orgId,
        userId,
        role: "PARTICIPANT",
        status: "ACTIVE",
      },
    })

    return NextResponse.json({
      success: true,
      alreadyMember: false,
      role: "PARTICIPANT",
      orgId,
    })
  } catch (error) {
    console.error("[POST /api/events/register-participant] error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(error) },
      { status: 500 }
    )
  }
}
