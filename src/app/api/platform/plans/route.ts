import { NextRequest, NextResponse } from "next/server"
import { getServerSession, isDbPlatformAdmin } from "@/lib/auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { invalidatePlanCache } from "@/lib/entitlements"

async function requirePlatformAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  // DB-backed: re-fetch User.platformRole so demotions apply immediately.
  return isDbPlatformAdmin(session)
}

/** GET /api/platform/plans — list all plans with prices + subscription counts */
export async function GET(req: NextRequest) {
  try {
    if (!(await requirePlatformAdmin())) {
      return NextResponse.json({ error: "Platform admin access required" }, { status: 403 })
    }

    const plans = await db.plan.findMany({
      include: {
        prices: { where: { isActive: true } },
        _count: { select: { subscriptions: true, organizations: true } },
      },
      orderBy: { priceMonthly: "asc" },
    })

    return NextResponse.json({
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        displayName: p.displayName,
        isActive: p.isActive,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        limits: JSON.parse(p.limits || "{}"),
        prices: p.prices.map((pr) => ({
          currency: pr.currency,
          monthlyAmount: pr.monthlyAmount,
          yearlyAmount: pr.yearlyAmount,
        })),
        subscriptionCount: p._count.subscriptions,
        organizationCount: p._count.organizations,
        createdAt: p.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("[GET /api/platform/plans] error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

/** POST /api/platform/plans — create or update a plan */
export async function POST(req: NextRequest) {
  try {
    if (!(await requirePlatformAdmin())) {
      return NextResponse.json({ error: "Platform admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { name, displayName, limits, priceMonthly, priceYearly, isActive } = body

    if (!name || !displayName) {
      return NextResponse.json({ error: "Name and displayName are required" }, { status: 400 })
    }

    const plan = await db.plan.upsert({
      where: { name },
      update: {
        displayName,
        limits: typeof limits === "string" ? limits : JSON.stringify(limits || {}),
        priceMonthly: typeof priceMonthly === "number" ? priceMonthly : 0,
        priceYearly: typeof priceYearly === "number" ? priceYearly : 0,
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
      create: {
        name,
        displayName,
        limits: typeof limits === "string" ? limits : JSON.stringify(limits || {}),
        priceMonthly: typeof priceMonthly === "number" ? priceMonthly : 0,
        priceYearly: typeof priceYearly === "number" ? priceYearly : 0,
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
    })

    // Invalidate all plan caches
    const orgs = await db.organization.findMany({ select: { id: true } })
    for (const org of orgs) invalidatePlanCache(org.id)

    return NextResponse.json({ success: true, plan })
  } catch (error) {
    console.error("[POST /api/platform/plans] error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
