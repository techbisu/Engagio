import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveCurrencies } from "@/lib/i18n";

/**
 * POST /api/pricing/seed
 *
 * Admin-only endpoint that seeds (or repairs) PlanPrice rows for every
 * Plan in every active currency. Idempotent — upserts on [planId, currency].
 *
 * Used during local dev + on first deploy to populate the DB-driven pricing
 * page so the marketing site / billing dashboard has real numbers to show.
 *
 * Pricing matrix (integer minor units — paise for INR, cents for USD/EUR/GBP):
 *
 *   FREE          — all prices 0 (free forever)
 *   STARTER       — INR 49900 / 499900
 *                   USD 999   / 9999
 *                   EUR 799   / 7999
 *                   GBP 699   / 6999
 *   PROFESSIONAL  — INR 299900 / 2999900
 *                   USD 2999   / 29999
 *                   EUR 2499   / 24999
 *                   GBP 1999   / 19999
 *   ENTERPRISE    — all prices 0 (contact sales)
 *
 * Auth: requires a session with the ADMIN platform role.
 */

// [planName][currency] => [monthly, yearly] in minor units
const SEED_PRICES: Record<string, Record<string, [number, number]>> = {
  FREE: {
    INR: [0, 0],
    USD: [0, 0],
    EUR: [0, 0],
    GBP: [0, 0],
  },
  STARTER: {
    INR: [49900, 499900],
    USD: [999, 9999],
    EUR: [799, 7999],
    GBP: [699, 6999],
  },
  PROFESSIONAL: {
    INR: [299900, 2999900],
    USD: [2999, 29999],
    EUR: [2499, 24999],
    GBP: [1999, 19999],
  },
  ENTERPRISE: {
    INR: [0, 0],
    USD: [0, 0],
    EUR: [0, 0],
    GBP: [0, 0],
  },
}

async function requirePlatformAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  return (session?.user as any)?.role === "ADMIN"
}

export async function POST() {
  try {
    if (!(await requirePlatformAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const plans = await db.plan.findMany()
    if (plans.length === 0) {
      return NextResponse.json(
        { error: "No plans found — run scripts/migrate-tenancy.ts first" },
        { status: 409 },
      )
    }

    const activeCurrencies = getActiveCurrencies()
    const currencyCodes = activeCurrencies.map((c) => c.code)

    const results: Array<{
      plan: string
      currency: string
      monthly: number
      yearly: number
      action: "created" | "updated" | "skipped"
    }> = []

    for (const plan of plans) {
      const priceMap = SEED_PRICES[plan.name]
      if (!priceMap) {
        // Unknown plan — skip silently (don't touch user-defined prices).
        continue
      }

      for (const currency of currencyCodes) {
        const priceTuple = priceMap[currency]
        if (!priceTuple) {
          results.push({
            plan: plan.name,
            currency,
            monthly: 0,
            yearly: 0,
            action: "skipped",
          })
          continue
        }
        const [monthly, yearly] = priceTuple

        // Probe existence BEFORE the upsert so we can report
        // "created" vs "updated" accurately to the caller.
        const existing = await db.planPrice.findUnique({
          where: {
            planId_currency: { planId: plan.id, currency },
          },
          select: { id: true },
        })

        // Idempotent upsert on the [planId, currency] unique constraint.
        await db.planPrice.upsert({
          where: {
            planId_currency: { planId: plan.id, currency },
          },
          update: {
            monthlyAmount: monthly,
            yearlyAmount: yearly,
            isActive: true,
          },
          create: {
            planId: plan.id,
            currency,
            monthlyAmount: monthly,
            yearlyAmount: yearly,
            isActive: true,
          },
        })

        results.push({
          plan: plan.name,
          currency,
          monthly,
          yearly,
          action: existing ? "updated" : "created",
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${results.filter((r) => r.action !== "skipped").length} PlanPrice rows across ${plans.length} plans × ${currencyCodes.length} currencies.`,
      seeded: results,
      currencies: activeCurrencies.map((c) => ({
        code: c.code,
        symbol: c.symbol,
        name: c.name,
      })),
    })
  } catch (e) {
    return NextResponse.json(
      {
        error: "Internal Server Error",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    )
  }
}
