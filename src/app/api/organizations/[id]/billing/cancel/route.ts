import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/tenant";
import { resolveOrgMembership } from "@/lib/org-api";
import { invalidatePlanCache } from "@/lib/entitlements";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/organizations/[id]/billing/cancel
 *
 * Cancel the org's paid subscription and revert to the FREE plan.
 *
 * Behavior:
 *   - Looks up the FREE plan by `name: "FREE"`.
 *   - Sets the org's `planId` to the FREE plan id (or null if no FREE plan
 *     row exists — entitlements fall back to FREE_PLAN_LIMITS anyway).
 *   - Marks the most recent ACTIVE subscription as `CANCELED` and clears
 *     its `currentPeriodEnd` so the billing UI no longer shows a renewal
 *     date.
 *   - Invalidates the plan cache so subsequent hasFeature()/getLimit()
 *     calls reflect the FREE plan immediately.
 *
 * auditLog: SUBSCRIPTION_CANCELED.
 *
 * Response: { success: true, plan: "FREE" }
 */
export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const result = await resolveOrgMembership(id, "OWNER");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { ctx: tenantCtx } = result;

    // Look up the FREE plan. If it doesn't exist (shouldn't happen in seeded
    // DBs), fall back to clearing planId — entitlements use FREE_PLAN_LIMITS.
    const freePlan = await db.plan.findUnique({ where: { name: "FREE" } });
    const newPlanId = freePlan?.id ?? null;

    // Update the org's plan back to FREE.
    await db.organization.update({
      where: { id },
      data: { planId: newPlanId },
    });

    // Mark the most recent ACTIVE subscription as CANCELED and clear the
    // renewal date so the billing UI reflects the cancellation.
    const existing = await db.subscription.findFirst({
      where: { organizationId: id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    let subscriptionId: string | null = null;
    if (existing) {
      await db.subscription.update({
        where: { id: existing.id },
        data: {
          status: "CANCELED",
          currentPeriodEnd: null,
        },
      });
      subscriptionId = existing.id;
    }

    // Invalidate the plan cache so entitlements re-read the FREE plan.
    invalidatePlanCache(id);

    await auditLog(
      tenantCtx,
      "SUBSCRIPTION_CANCELED",
      "Subscription",
      subscriptionId ?? undefined,
      {
        previousPlanId: existing?.planId ?? null,
        newPlanName: "FREE",
        method: "demo_cancel",
      }
    );

    return NextResponse.json({
      success: true,
      plan: "FREE",
      note: "Your subscription has been cancelled. You are now on the Free plan.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
