import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/tenant";
import { resolveOrgMembership } from "@/lib/org-api";
import { invalidatePlanCache } from "@/lib/entitlements";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_PLAN_NAMES = ["STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;
type PlanName = (typeof VALID_PLAN_NAMES)[number];

function isPlanName(s: unknown): s is PlanName {
  return typeof s === "string" && (VALID_PLAN_NAMES as readonly string[]).includes(s);
}

/**
 * POST /api/organizations/[id]/billing/upgrade
 *
 * Demo upgrade flow — no real payment integration yet.
 * Sets the org's planId + creates/updates a Subscription with status=ACTIVE.
 *
 * BODY: { planName: "STARTER" | "PROFESSIONAL" | "ENTERPRISE" }
 *
 * After upgrade, the plan cache for the org is invalidated so subsequent
 * hasFeature()/getLimit() calls reflect the new plan immediately.
 *
 * auditLog: SUBSCRIPTION_CHANGED.
 *
 * Response: { success: true, plan: newPlanName, note: "..." }
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const result = await resolveOrgMembership(id, "OWNER");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { ctx: tenantCtx } = result;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const { planName } = body ?? {};

    if (!isPlanName(planName)) {
      return NextResponse.json(
        {
          error:
            "Invalid plan name. Must be one of STARTER, PROFESSIONAL, ENTERPRISE.",
          code: "INVALID_PLAN",
        },
        { status: 400 }
      );
    }

    const plan = await db.plan.findUnique({
      where: { name: planName },
    });
    if (!plan || !plan.isActive) {
      return NextResponse.json(
        { error: "Selected plan is not available.", code: "PLAN_NOT_AVAILABLE" },
        { status: 400 }
      );
    }

    // Update the org's plan.
    const updated = await db.organization.update({
      where: { id },
      data: { planId: plan.id },
    });

    // Create or update the active subscription (1-month period for demo).
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const existing = await db.subscription.findFirst({
      where: { organizationId: id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    let subscription;
    if (existing) {
      subscription = await db.subscription.update({
        where: { id: existing.id },
        data: {
          planId: plan.id,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    } else {
      subscription = await db.subscription.create({
        data: {
          organizationId: id,
          planId: plan.id,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    // Invalidate the plan cache so entitlements re-read the new plan.
    invalidatePlanCache(id);

    await auditLog(tenantCtx, "SUBSCRIPTION_CHANGED", "Subscription", subscription.id, {
      planName: plan.name,
      planId: plan.id,
      previousPlanId: updated.planId === plan.id ? null : updated.planId,
      method: "demo_upgrade",
    });

    return NextResponse.json({
      success: true,
      plan: plan.name,
      subscription: {
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      },
      note: "This is a demo upgrade. Real payment integration coming soon.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
