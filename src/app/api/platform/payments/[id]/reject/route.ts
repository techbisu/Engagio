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
 * POST /api/platform/payments/[id]/reject
 * Super admin only. `id` is the registration ID.
 *
 * Platform-scope equivalent of /api/admin/payments/[id]/reject — no
 * organizationId filter is applied, since a super admin can reject any
 * registration on the platform.
 *
 * Body: { rejectionReason: string }
 *
 * Validates:
 *   - Caller is a platform admin (User.platformRole === "SUPERADMIN").
 *   - The registration exists.
 *   - The registration's event actually charges (event.paymentMethod != "FREE").
 *   - paymentStatus is "PENDING_VERIFICATION".
 *   - rejectionReason is a non-empty string (max 500 chars).
 *
 * Updates:
 *   - paymentStatus = "REJECTED"
 *   - verifiedBy = session.user.id
 *   - verifiedAt = now
 *   - rejectionReason from body.
 *
 * Returns: `{ success: true, registration: { id, paymentStatus, verifiedAt, rejectionReason } }`.
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
        { error: "Cannot reject a registration for a free event" },
        { status: 400 }
      )
    }
    if (existing.paymentStatus !== "PENDING_VERIFICATION") {
      return NextResponse.json(
        {
          error:
            "Only payments pending verification can be rejected. Current status: " +
            existing.paymentStatus,
        },
        { status: 400 }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }
    const reason =
      typeof (body as { rejectionReason?: unknown }).rejectionReason === "string"
        ? ((body as { rejectionReason: string }).rejectionReason).trim()
        : ""
    if (!reason) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      )
    }
    if (reason.length > 500) {
      return NextResponse.json(
        { error: "Rejection reason is too long (max 500 chars)" },
        { status: 400 }
      )
    }

    const updated = await db.registration.update({
      where: { id },
      data: {
        paymentStatus: "REJECTED",
        verifiedBy: adminId,
        verifiedAt: new Date(),
        rejectionReason: reason,
      },
      select: {
        id: true,
        paymentStatus: true,
        verifiedAt: true,
        rejectionReason: true,
      },
    })

    return NextResponse.json({
      success: true,
      registration: {
        id: updated.id,
        paymentStatus: updated.paymentStatus,
        verifiedAt: updated.verifiedAt ? updated.verifiedAt.toISOString() : null,
        rejectionReason: updated.rejectionReason,
      },
    })
  } catch (e) {
    console.error("[POST /api/platform/payments/[id]/reject] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
