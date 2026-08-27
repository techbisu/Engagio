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

type Range = "30d" | "90d" | "12m"

function parseRange(raw: string | null): Range {
  if (raw === "90d" || raw === "12m") return raw
  return "30d"
}

// ─── Date helpers (UTC-safe) ───────────────────────────────────────────────
const dateKey = (d: Date): string => d.toISOString().slice(0, 10) // YYYY-MM-DD
const monthKey = (d: Date): string => `${d.toISOString().slice(0, 7)}-01` // YYYY-MM-01
const addDays = (d: Date, n: number): Date => {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}
const addMonths = (d: Date, n: number): Date => {
  const r = new Date(d)
  r.setUTCMonth(r.getUTCMonth() + n)
  return r
}
// Last day of the same month as `d`, at end of day (UTC).
const monthEnd = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999))

interface GrowthBucket {
  newOrgs: number
  newUsers: number
  newSubs: number
}

/**
 * GET /api/platform/analytics?range=30d|90d|12m
 *
 * Returns time-series growth, monthly recurring revenue trend, current-month
 * churn, and a current-snapshot revenue-by-plan breakdown. Platform admin
 * only.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await requirePlatformAdmin())) {
      return NextResponse.json({ error: "Platform admin access required" }, { status: 403 })
    }

    const range = parseRange(req.nextUrl.searchParams.get("range"))
    const now = new Date()

    const isMonthlyGrowth = range === "12m"
    const growthDays = range === "30d" ? 30 : range === "90d" ? 90 : 365
    const growthMonths = range === "12m" ? 12 : 0
    const mrrMonths = range === "30d" ? 3 : range === "90d" ? 6 : 12

    // ─── 1. Growth series (new orgs / users / subscriptions per bucket) ───────
    const growthMap = new Map<string, GrowthBucket>()
    if (isMonthlyGrowth) {
      for (let i = growthMonths - 1; i >= 0; i--) {
        growthMap.set(monthKey(addMonths(now, -i)), { newOrgs: 0, newUsers: 0, newSubs: 0 })
      }
    } else {
      for (let i = growthDays - 1; i >= 0; i--) {
        growthMap.set(dateKey(addDays(now, -i)), { newOrgs: 0, newUsers: 0, newSubs: 0 })
      }
    }

    const growthStart = isMonthlyGrowth
      ? addMonths(now, -(growthMonths - 1))
      : addDays(now, -(growthDays - 1))
    growthStart.setUTCHours(0, 0, 0, 0)

    const [orgRows, userRows, subRows] = await Promise.all([
      db.organization.findMany({
        where: { createdAt: { gte: growthStart } },
        select: { createdAt: true },
      }),
      db.user.findMany({
        where: { createdAt: { gte: growthStart } },
        select: { createdAt: true },
      }),
      db.subscription.findMany({
        where: { createdAt: { gte: growthStart } },
        select: { createdAt: true },
      }),
    ])

    const bucketOf = (date: Date): string =>
      isMonthlyGrowth ? monthKey(new Date(date)) : dateKey(new Date(date))

    for (const o of orgRows) {
      const b = growthMap.get(bucketOf(o.createdAt))
      if (b) b.newOrgs++
    }
    for (const u of userRows) {
      const b = growthMap.get(bucketOf(u.createdAt))
      if (b) b.newUsers++
    }
    for (const s of subRows) {
      const b = growthMap.get(bucketOf(s.createdAt))
      if (b) b.newSubs++
    }

    const growth = Array.from(growthMap.entries()).map(([date, v]) => ({
      date,
      newOrgs: v.newOrgs,
      newUsers: v.newUsers,
      newSubs: v.newSubs,
    }))

    // ─── 2. MRR series (monthly, last N months) ───────────────────────────────
    // For each of the last `mrrMonths` months, MRR = sum of `Plan.priceMonthly`
    // for every subscription that was active at the end of that month. We
    // approximate "active at end of month M" as:
    //   createdAt <= end(M) AND (status = ACTIVE OR (status = CANCELED AND
    //   updatedAt > end(M)))
    //
    // Note: PAST_DUE and TRIALING are treated as active (still paying). FREE
    // plans (priceMonthly = 0) are excluded because they contribute zero.
    const allSubs = await db.subscription.findMany({
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        status: true,
        planId: true,
        plan: { select: { name: true, displayName: true, priceMonthly: true } },
      },
    })

    const mrrMap = new Map<string, number>()
    const mrrMonthEnds: { key: string; end: Date }[] = []
    for (let i = mrrMonths - 1; i >= 0; i--) {
      const mDate = addMonths(now, -i)
      const key = monthKey(mDate)
      mrrMap.set(key, 0)
      mrrMonthEnds.push({ key, end: monthEnd(mDate) })
    }

    const isActiveAt = (s: (typeof allSubs)[number], at: Date): boolean => {
      const created = new Date(s.createdAt)
      if (created > at) return false
      if (s.status === "CANCELED") {
        const updated = s.updatedAt ? new Date(s.updatedAt) : null
        if (updated && updated <= at) return false
      }
      return true
    }

    for (const s of allSubs) {
      const price = s.plan?.priceMonthly || 0
      if (!price) continue
      for (const { key, end } of mrrMonthEnds) {
        if (isActiveAt(s, end)) {
          mrrMap.set(key, (mrrMap.get(key) || 0) + price)
        }
      }
    }

    const mrr = Array.from(mrrMap.entries()).map(([date, v]) => ({ date, mrr: v }))

    // ─── 3. Churn (current month) ────────────────────────────────────────────
    // Count subscriptions that were active at the start of the current month
    // (i.e. as of the last millisecond of the previous month) and how many of
    // those have since been canceled this month. Churn rate = churned / active
    // at start × 100. This is the only churn window we can compute without a
    // subscription-history table.
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const lastMonthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999),
    )

    let activeAtStart = 0
    let churnedThisMonth = 0
    for (const s of allSubs) {
      if (!isActiveAt(s, lastMonthEnd)) continue
      activeAtStart++
      if (s.status === "CANCELED") {
        const updated = s.updatedAt ? new Date(s.updatedAt) : null
        if (updated && updated >= thisMonthStart && updated <= now) {
          churnedThisMonth++
        }
      }
    }

    const churnRate = activeAtStart > 0 ? (churnedThisMonth / activeAtStart) * 100 : 0

    // ─── 4. Revenue by plan (current snapshot) ───────────────────────────────
    const planAgg = new Map<
      string,
      { count: number; mrr: number; name: string; displayName: string }
    >()
    for (const s of allSubs) {
      if (s.status !== "ACTIVE") continue
      const planId = s.planId
      const price = s.plan?.priceMonthly || 0
      const name = s.plan?.name || planId
      const displayName = s.plan?.displayName || name
      const existing = planAgg.get(planId) || { count: 0, mrr: 0, name, displayName }
      existing.count++
      existing.mrr += price
      planAgg.set(planId, existing)
    }

    const revenueByPlan = Array.from(planAgg.entries())
      .map(([planId, v]) => ({
        planId,
        plan: v.name,
        planDisplayName: v.displayName,
        count: v.count,
        mrr: v.mrr,
      }))
      .sort((a, b) => b.mrr - a.mrr)

    return NextResponse.json({
      range,
      growth,
      mrr,
      churn: {
        rate: Math.round(churnRate * 10) / 10,
        churnedThisMonth,
        activeAtStart,
      },
      revenueByPlan,
    })
  } catch (error) {
    console.error("[GET /api/platform/analytics] error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
