import { NextRequest, NextResponse } from "next/server"
import { getServerSession, isDbPlatformAdmin } from "@/lib/auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/** Platform admin only — checks User.platformRole === "SUPERADMIN" (DB-backed). */
async function requirePlatformAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  // DB-backed: re-fetch User.platformRole so demotions apply immediately.
  return isDbPlatformAdmin(session)
}

/**
 * GET /api/platform/payments — list ALL manual/UPI payment registrations
 * across every organization on the platform.
 *
 * Returns registrations where:
 *   - paymentStatus ∈ { PENDING_VERIFICATION, COMPLETED, REJECTED }
 *   - event.paymentMethod != "FREE" (i.e. the event actually charges)
 *
 * Joined with the registrant (User), Event, and the Event's Organization for
 * display in the super admin Payments tab.
 *
 * Query params:
 *   - `status` (optional): one of PENDING_VERIFICATION | COMPLETED | REJECTED.
 *     When omitted, returns all three statuses.
 *
 * Response shape:
 *   {
 *     payments: Array<{
 *       id, amount, currency, paymentMethod, paymentStatus, paymentRef,
 *       rejectionReason, createdAt, verifiedAt,
 *       user: { name, email },
 *       event: { id, title },
 *       organization: { id, name, slug } | null
 *     }>,
 *     stats: { pending, approved, rejected, totalAmount }
 *   }
 *
 * Notes:
 *   - `amount` and `currency` come from the Event's paymentAmount / paymentCurrency
 *     (Registration itself does not store the amount — it inherits the event's price).
 *   - `paymentRef` is the participant-entered UTR/transaction id
 *     (Registration.transactionReference).
 *   - `totalAmount` is the sum of COMPLETED registrations' event amounts (in paise).
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await requirePlatformAdmin())) {
      return NextResponse.json(
        { error: "Platform admin access required" },
        { status: 403 }
      )
    }

    const url = new URL(req.url)
    const statusParam = (url.searchParams.get("status") || "ALL").toUpperCase()

    // Build the where clause for the main payments list.
    // We deliberately use `any` here so Prisma can infer the `include` clause
    // on the findMany call below — the same pattern used by /api/admin/payments.
    const where: {
      paymentStatus: { in: string[] }
      event: { paymentMethod: { not: string } }
    } = {
      // Only rows whose payment was actually initiated against a non-free event.
      paymentStatus: {
        in: ["PENDING_VERIFICATION", "COMPLETED", "REJECTED"],
      },
      event: { paymentMethod: { not: "FREE" } },
    }
    if (
      statusParam === "PENDING_VERIFICATION" ||
      statusParam === "COMPLETED" ||
      statusParam === "REJECTED"
    ) {
      where.paymentStatus = { in: [statusParam] }
    }

    // Pull every matching registration with the joins we need for display.
    const registrations = await db.registration.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        event: {
          select: {
            id: true,
            title: true,
            paymentAmount: true,
            paymentCurrency: true,
            paymentMethod: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      // Platform-wide view — cap at 500 to keep the response size reasonable.
      take: 500,
    })

    const payments = registrations.map((r) => ({
      id: r.id,
      amount: r.event?.paymentAmount ?? 0,
      currency: r.event?.paymentCurrency ?? "INR",
      paymentMethod: r.paymentMethod ?? null,
      paymentStatus: r.paymentStatus,
      paymentRef: r.transactionReference ?? null,
      rejectionReason: r.rejectionReason ?? null,
      verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      user: {
        name: r.user?.name ?? null,
        email: r.user?.email ?? "",
      },
      event: {
        id: r.event?.id ?? "",
        title: r.event?.title ?? "Untitled event",
      },
      organization: r.event?.organization
        ? {
            id: r.event.organization.id,
            name: r.event.organization.name,
            slug: r.event.organization.slug,
          }
        : null,
    }))

    // Aggregate counts + total approved revenue across *all* matching rows
    // (not just the slice above) so the stats cards are always accurate.
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      db.registration.count({
        where: {
          paymentStatus: "PENDING_VERIFICATION",
          event: { paymentMethod: { not: "FREE" } },
        },
      }),
      db.registration.count({
        where: {
          paymentStatus: "COMPLETED",
          event: { paymentMethod: { not: "FREE" } },
        },
      }),
      db.registration.count({
        where: {
          paymentStatus: "REJECTED",
          event: { paymentMethod: { not: "FREE" } },
        },
      }),
    ])

    // Sum the event amounts for every COMPLETED registration. We re-query
    // instead of summing the (possibly filtered) `payments` array so the
    // revenue figure is independent of the `status` query param.
    const approvedRows = await db.registration.findMany({
      where: {
        paymentStatus: "COMPLETED",
        event: { paymentMethod: { not: "FREE" } },
      },
      select: { event: { select: { paymentAmount: true } } },
    })
    const totalAmount = approvedRows.reduce(
      (sum, r) => sum + (r.event?.paymentAmount ?? 0),
      0
    )

    return NextResponse.json({
      payments,
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        totalAmount,
      },
    })
  } catch (error) {
    console.error("[GET /api/platform/payments] error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
