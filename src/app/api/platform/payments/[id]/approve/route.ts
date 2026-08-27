import { NextRequest, NextResponse } from "next/server"
import { getServerSession, isDbPlatformAdmin } from "@/lib/auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/** Platform admin only — checks User.platformRole === "SUPERADMIN" (DB-backed). */
async function requirePlatformAdmin(): Promise<{ ok: boolean; userId?: string }> {
  const session = await getServerSession(authOptions)
  const ok = await isDbPlatformAdmin(session)
  return { ok, userId: session?.user?.id }
}

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/platform/payments/[id]/approve
 * Super admin only. `id` is the registration ID.
 *
 * Platform-scope equivalent of /api/admin/payments/[id]/approve — no
 * organizationId filter is applied, since a super admin can approve any
 * registration on the platform.
 *
 * Validates:
 *   - Caller is a platform admin (User.platformRole === "SUPERADMIN").
 *   - The registration exists.
 *   - The registration's event actually charges (event.paymentMethod != "FREE").
 *   - paymentStatus is "PENDING_VERIFICATION" (can't approve already-decided).
 *
 * Updates:
 *   - paymentStatus = "COMPLETED"
 *   - verifiedBy = session.user.id
 *   - verifiedAt = now
 *   - clears rejectionReason.
 *
 * Returns: `{ success: true, registration: { id, paymentStatus, verifiedAt } }`.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePlatformAdmin()
    if (!auth.ok || !auth.userId) {
      return NextResponse.json(
        { error: "Platform admin access required" },
        { status: 403 }
      )
    }
    const adminId = auth.userId

    const { id } = await ctx.params
    const existing = await db.registration.findUnique({
      where: { id },
      select: {
        id: true,
        paymentStatus: true,
        event: { select: { paymentMethod: true } },
      },
    })
    if (!existing) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      )
    }
    if (existing.event?.paymentMethod === "FREE") {
      return NextResponse.json(
        { error: "Cannot approve a registration for a free event" },
        { status: 400 }
      )
    }
    if (existing.paymentStatus !== "PENDING_VERIFICATION") {
      return NextResponse.json(
        {
          error:
            "Only payments pending verification can be approved. Current status: " +
            existing.paymentStatus,
        },
        { status: 400 }
      )
    }

    const updated = await db.registration.update({
      where: { id },
      data: {
        paymentStatus: "COMPLETED",
        verifiedBy: adminId,
        verifiedAt: new Date(),
        rejectionReason: null,
      },
      select: { id: true, paymentStatus: true, verifiedAt: true },
    })

    return NextResponse.json({
      success: true,
      registration: {
        id: updated.id,
        paymentStatus: updated.paymentStatus,
        verifiedAt: updated.verifiedAt ? updated.verifiedAt.toISOString() : null,
      },
    })
  } catch (e) {
    console.error("[POST /api/platform/payments/[id]/approve] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
