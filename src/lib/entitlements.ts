/**
 * Feature entitlements — centralized plan-limit + feature checks.
 *
 * Instead of scattering `if (plan === "PRO")` checks throughout the app,
 * use:
 *   hasFeature(ctx, "custom_domain")
 *   getLimit(ctx, "max_events")
 *   checkUsageLimit(ctx, "events")
 *
 * Plan limits are defined in the Plan.limits JSON field (seeded by the
 * migration script). This service reads them via the org's planId.
 */

import { db } from "./db"
import type { TenantContext } from "./tenant"

export type Feature =
  | "custom_domain"
  | "ai_proctor"
  | "advanced_security"
  | "advanced_analytics"
  | "custom_branding"
  | "remove_engagio_branding"
  | "priority_support"

export type Limit =
  | "max_events"
  | "max_participants_per_event"
  | "max_members"
  | "max_storage_bytes"
  | "max_custom_domains"
  | "max_assessments"

interface PlanLimits {
  max_events?: number // -1 = unlimited
  max_participants_per_event?: number
  max_members?: number
  max_storage_bytes?: number
  max_custom_domains?: number
  max_assessments?: number
  customBranding?: boolean
  certificates?: boolean
  aiProctor?: boolean
  advancedSecurity?: boolean
  advancedAnalytics?: boolean
  customDomain?: boolean
  removeEngagioBranding?: boolean
  prioritySupport?: boolean
  [key: string]: unknown
}

// In-memory cache for plan limits (TTL 60s). In production, use a proper
// cache (Redis/Upstash) — but this is fine for MVP.
const planCache = new Map<string, { limits: PlanLimits; expires: number }>()
const CACHE_TTL = 60_000

async function getPlanLimits(orgId: string): Promise<PlanLimits> {
  const cached = planCache.get(orgId)
  if (cached && cached.expires > Date.now()) {
    return cached.limits
  }

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { planId: true },
  })

  let limits: PlanLimits = {}

  if (org?.planId) {
    const plan = await db.plan.findUnique({
      where: { id: org.planId },
      select: { limits: true },
    })
    if (plan?.limits) {
      try {
        limits = JSON.parse(plan.limits)
      } catch {
        limits = {}
      }
    }
  }

  // Fallback to FREE plan defaults if no plan limits found
  if (Object.keys(limits).length === 0) {
    limits = FREE_PLAN_LIMITS
  }

  planCache.set(orgId, { limits, expires: Date.now() + CACHE_TTL })
  return limits
}

/** Clear the plan cache for an org (call after plan changes). */
export function invalidatePlanCache(orgId: string): void {
  planCache.delete(orgId)
}

// Default FREE plan limits (used when no plan is assigned)
export const FREE_PLAN_LIMITS: PlanLimits = {
  max_events: 3,
  max_participants_per_event: 100,
  max_members: 3,
  max_storage_bytes: 500 * 1024 * 1024, // 500MB
  max_custom_domains: 0,
  max_assessments: 10,
  customBranding: false,
  certificates: true,
  aiProctor: false,
  advancedSecurity: false,
  advancedAnalytics: false,
  customDomain: false,
  removeEngagioBranding: false,
  prioritySupport: false,
}

// Feature → limit key mapping (for boolean features)
const FEATURE_KEYS: Record<Feature, keyof PlanLimits> = {
  custom_domain: "customDomain",
  ai_proctor: "aiProctor",
  advanced_security: "advancedSecurity",
  advanced_analytics: "advancedAnalytics",
  custom_branding: "customBranding",
  remove_engagio_branding: "removeEngagioBranding",
  priority_support: "prioritySupport",
}

/**
 * Check if a feature is enabled for the current org's plan.
 *
 *   if (await hasFeature(ctx, "custom_domain")) { ... }
 */
export async function hasFeature(
  ctx: TenantContext,
  feature: Feature
): Promise<boolean> {
  // Platform admins always have all features
  if (ctx.isPlatformAdmin) return true
  const limits = await getPlanLimits(ctx.orgId)
  const key = FEATURE_KEYS[feature]
  return limits[key] === true
}

/**
 * Get a numeric limit for the current org's plan.
 * Returns -1 for unlimited.
 *
 *   const max = await getLimit(ctx, "max_events") // 3 or -1
 */
export async function getLimit(
  ctx: TenantContext,
  limit: Limit
): Promise<number> {
  if (ctx.isPlatformAdmin) return -1
  const limits = await getPlanLimits(ctx.orgId)
  const val = limits[limit]
  return typeof val === "number" ? val : 0
}

/**
 * Check all features at once (for the billing/settings UI).
 */
export async function getEntitlements(orgId: string): Promise<{
  plan: string
  limits: PlanLimits
  features: Record<Feature, boolean>
}> {
  const limits = await getPlanLimits(orgId)
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { planId: true },
  })
  let planName = "FREE"
  if (org?.planId) {
    const plan = await db.plan.findUnique({
      where: { id: org.planId },
      select: { name: true },
    })
    if (plan) planName = plan.name
  }

  const features = {} as Record<Feature, boolean>
  for (const f of Object.keys(FEATURE_KEYS) as Feature[]) {
    const key = FEATURE_KEYS[f]
    features[f] = limits[key] === true
  }

  return { plan: planName, limits, features }
}
