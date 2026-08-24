import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveCurrencies } from "@/lib/i18n";

/**
 * GET /api/pricing
 *
 * Public endpoint (no auth) — returns the plan catalogue for the marketing
 * pricing page + billing comparison grid. Reads from Plan + PlanPrice so the
 * page is fully DB-driven (no hardcoded prices in the UI).
 *
 * Response shape:
 *   {
 *     plans: [{
 *       id, name, displayName,
 *       limits: Record<string, unknown>,
 *       prices: [{ currency, monthlyAmount, yearlyAmount }],
 *       isFeatured?: boolean
 *     }],
 *     currencies: [{ code, symbol, name }]
 *   }
 *
 * - Plans are ordered FREE → STARTER → PROFESSIONAL → ENTERPRISE.
 * - FREE / ENTERPRISE plans typically have no PlanPrice rows — the UI shows
 *   "Free" or "Custom" respectively.
 * - The `PROFESSIONAL` plan is flagged `isFeatured` so the UI can highlight it.
 */
export async function GET() {
  try {
    const [planRows, currencyConfigs] = await Promise.all([
      db.plan.findMany({
        where: { isActive: true },
        include: {
          prices: {
            where: { isActive: true },
          },
        },
        // Sort by an explicit order so the cards always render FREE first.
        orderBy: [{ name: "asc" }],
      }),
      Promise.resolve(getActiveCurrencies()),
    ]);

    // Canonical plan ordering: FREE → STARTER → PROFESSIONAL → ENTERPRISE.
    const PLAN_ORDER: Record<string, number> = {
      FREE: 0,
      STARTER: 1,
      PROFESSIONAL: 2,
      ENTERPRISE: 3,
    };
    const sortedPlans = [...planRows].sort((a, b) => {
      const ai = PLAN_ORDER[a.name] ?? 99;
      const bi = PLAN_ORDER[b.name] ?? 99;
      if (ai !== bi) return ai - bi;
      return a.displayName.localeCompare(b.displayName);
    });

    const plans = sortedPlans.map((p) => {
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
        limits: parsedLimits,
        // Map PlanPrice rows into the public shape. Only currencies with an
        // active price row are listed — the UI falls back to "Contact us"
        // for currencies the plan doesn't have a price for.
        prices: p.prices.map((pr) => ({
          currency: pr.currency,
          monthlyAmount: pr.monthlyAmount,
          yearlyAmount: pr.yearlyAmount,
        })),
        isFeatured: p.name === "PROFESSIONAL",
      };
    });

    return NextResponse.json({
      plans,
      currencies: currencyConfigs.map((c) => ({
        code: c.code,
        symbol: c.symbol,
        name: c.name,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
