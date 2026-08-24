import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveOrgMembership } from "@/lib/org-api";
import { getEntitlements } from "@/lib/entitlements";
import { getAllUsage, type UsageInfo } from "@/lib/usage";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/organizations/[id]/billing
 *
 * Returns the org's current plan, subscription, usage metrics, and
 * entitlements (features + numeric limits). OWNER only.
 *
 * Response shape:
 *   {
 *     plan: { name, displayName, priceMonthly, priceYearly },
 *     subscription: { status, currentPeriodEnd } | null,
 *     usage: { events, members, assessments, custom_domains }, // each UsageInfo
 *     entitlements: { features: Record<Feature, boolean>, limits: PlanLimits }
 *   }
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const result = await resolveOrgMembership(id, "OWNER", {
      includePlan: true,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { ctx: tenantCtx, org } = result;

    // Plan (fallback to FREE defaults if the org has no plan assigned).
    let planRow = org?.plan ?? null;
    if (!planRow) {
      planRow = await db.plan.findUnique({ where: { name: "FREE" } });
    }

    const plan = planRow
      ? {
          name: planRow.name as string,
          displayName: planRow.displayName,
          priceMonthly: planRow.priceMonthly,
          priceYearly: planRow.priceYearly,
        }
      : {
          name: "FREE",
          displayName: "Free",
          priceMonthly: 0,
          priceYearly: 0,
        };

    // Subscription (most recent ACTIVE/TRIALING one).
    const subscription = org?.planId
      ? await db.subscription.findFirst({
          where: { organizationId: id },
          orderBy: { createdAt: "desc" },
        })
      : null;

    const subscriptionDto = subscription
      ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        }
      : null;

    // Usage metrics (events, members, assessments, custom_domains).
    const usage: Record<string, UsageInfo> = await getAllUsage(tenantCtx);

    // Entitlements (features + limits).
    const entitlements = await getEntitlements(id);

    // All active plans (for the plans-comparison grid in the UI).
    const allPlanRows = await db.plan.findMany({
      where: { isActive: true },
      orderBy: [{ priceMonthly: "asc" }, { name: "asc" }],
    });
    const allPlans = allPlanRows.map((p) => {
      let parsedLimits: Record<string, unknown> = {};
      try {
        parsedLimits = p.limits ? JSON.parse(p.limits) : {};
      } catch {
        parsedLimits = {};
      }
      return {
        id: p.id,
        name: p.name,
        displayName: p.displayName,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        limits: parsedLimits,
      };
    });

    return NextResponse.json({
      plan,
      subscription: subscriptionDto,
      usage,
      entitlements: {
        features: entitlements.features,
        limits: entitlements.limits,
      },
      allPlans,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
