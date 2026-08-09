/**
 * Usage tracking — counts how many resources an org has used.
 *
 * Used by `checkUsageLimit()` to enforce plan limits server-side.
 *
 *   const canCreate = await checkUsageLimit(ctx, "events")
 *   if (!canCreate.allowed) return 403 { error: canCreate.reason }
 */

import { db } from "./db"
import { getLimit } from "./entitlements"
import type { TenantContext } from "./tenant"

export type UsageMetric =
  | "events"
  | "members"
  | "assessments"
  | "custom_domains"

export interface UsageInfo {
  used: number
  limit: number // -1 = unlimited
  remaining: number // -1 = unlimited
  percentage: number // 0-100, or 0 if unlimited
}

/**
 * Get the current usage for a metric.
 */
export async function getUsage(
  ctx: TenantContext,
  metric: UsageMetric
): Promise<UsageInfo> {
  const limit = await getLimit(ctx, mapToLimit(metric))

  let used = 0
  switch (metric) {
    case "events": {
      used = await db.event.count({ where: { organizationId: ctx.orgId } })
      break
    }
    case "members": {
      used = await db.organizationMember.count({
        where: { organizationId: ctx.orgId, status: "ACTIVE" },
      })
      break
    }
    case "assessments": {
      // Count quiz links for the org's events
      const events = await db.event.findMany({
        where: { organizationId: ctx.orgId },
        select: { id: true },
      })
      const eventIds = events.map((e) => e.id)
      if (eventIds.length > 0) {
        used = await db.quizLink.count({
          where: { eventId: { in: eventIds } },
        })
      }
      break
    }
    case "custom_domains": {
      used = await db.organizationDomain.count({
        where: {
          organizationId: ctx.orgId,
          type: "CUSTOM_DOMAIN",
          status: { in: ["ACTIVE", "VERIFIED", "PENDING", "VERIFYING"] },
        },
      })
      break
    }
  }

  const unlimited = limit === -1
  return {
    used,
    limit,
    remaining: unlimited ? -1 : Math.max(0, limit - used),
    percentage: unlimited ? 0 : limit > 0 ? Math.round((used / limit) * 100) : 100,
  }
}

/**
 * Check if the org can create a new resource of the given metric.
 * Returns `{ allowed: true }` or `{ allowed: false, reason }`.
 *
 *   const check = await checkUsageLimit(ctx, "events")
 *   if (!check.allowed) {
 *     return NextResponse.json({ error: check.reason }, { status: 403 })
 *   }
 */
export async function checkUsageLimit(
  ctx: TenantContext,
  metric: UsageMetric
): Promise<{ allowed: boolean; reason?: string; usage?: UsageInfo }> {
  if (ctx.isPlatformAdmin) return { allowed: true }

  const usage = await getUsage(ctx, metric)
  if (usage.limit === -1) return { allowed: true, usage }

  if (usage.used >= usage.limit) {
    const label = metric.replace(/_/g, " ")
    return {
      allowed: false,
      reason: `Your plan allows ${usage.limit} ${label}. Upgrade to create more.`,
      usage,
    }
  }

  return { allowed: true, usage }
}

/**
 * Get all usage metrics at once (for the billing dashboard).
 */
export async function getAllUsage(
  ctx: TenantContext
): Promise<Record<UsageMetric, UsageInfo>> {
  const [events, members, assessments, customDomains] = await Promise.all([
    getUsage(ctx, "events"),
    getUsage(ctx, "members"),
    getUsage(ctx, "assessments"),
    getUsage(ctx, "custom_domains"),
  ])
  return { events, members, assessments, custom_domains: customDomains }
}

function mapToLimit(metric: UsageMetric): Parameters<typeof getLimit>[1] {
  switch (metric) {
    case "events":
      return "max_events"
    case "members":
      return "max_members"
    case "assessments":
      return "max_assessments"
    case "custom_domains":
      return "max_custom_domains"
  }
}
