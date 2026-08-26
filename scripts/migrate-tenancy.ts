/**
 * Migration script: multi-tenant backfill.
 *
 * Run: `bun run scripts/migrate-tenancy.ts`
 *
 * 1. Creates a "Default Organization" if it doesn't exist.
 * 2. For every ADMIN user, creates an OWNER membership in the Default Org.
 * 3. For every PARTICIPANT user, creates a PARTICIPANT membership in the Default Org.
 * 4. Backfills all Events with organizationId = Default Org (only those currently null).
 * 5. Backfills all Questions with organizationId = Default Org (only those currently null).
 *
 * This is idempotent — safe to run multiple times.
 * This is non-destructive — never deletes or duplicates data.
 */

import { db } from "../src/lib/db"

async function main() {
  console.log("🏢 Multi-tenant migration starting...")

  // 1. Create Default Organization
  let defaultOrg = await db.organization.findUnique({ where: { slug: "default" } })
  if (!defaultOrg) {
    defaultOrg = await db.organization.create({
      data: {
        name: "Default Organization",
        slug: "default",
        description:
          "Default organization for existing data (auto-created during migration).",
        status: "ACTIVE",
      },
    })
    console.log(`  ✓ Created Default Organization (${defaultOrg.id})`)
  } else {
    console.log(`  ✓ Default Organization already exists (${defaultOrg.id})`)
  }

  // 2 + 3. Create memberships for all users
  const users = await db.user.findMany()
  let membersCreated = 0
  for (const user of users) {
    const existing = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: defaultOrg.id,
          userId: user.id,
        },
      },
    })
    if (existing) continue

    const role = user.role === "ADMIN" ? "OWNER" : "PARTICIPANT"
    await db.organizationMember.create({
      data: {
        organizationId: defaultOrg.id,
        userId: user.id,
        role,
        status: "ACTIVE",
      },
    })
    membersCreated++
  }
  console.log(`  ✓ Memberships: ${membersCreated} created (${users.length} total users)`)

  // 4. Backfill Events
  const eventsWithoutOrg = await db.event.findMany({
    where: { organizationId: null },
    select: { id: true },
  })
  if (eventsWithoutOrg.length > 0) {
    const result = await db.event.updateMany({
      where: { id: { in: eventsWithoutOrg.map((e) => e.id) } },
      data: { organizationId: defaultOrg.id },
    })
    console.log(`  ✓ Events backfilled: ${result.count}`)
  } else {
    console.log("  ✓ Events: all already have organizationId")
  }

  // 5. Backfill Questions
  const questionsWithoutOrg = await db.question.findMany({
    where: { organizationId: null },
    select: { id: true },
  })
  if (questionsWithoutOrg.length > 0) {
    const result = await db.question.updateMany({
      where: { id: { in: questionsWithoutOrg.map((q) => q.id) } },
      data: { organizationId: defaultOrg.id },
    })
    console.log(`  ✓ Questions backfilled: ${result.count}`)
  } else {
    console.log("  ✓ Questions: all already have organizationId")
  }

  // 6. Seed / sync default plans (idempotent — re-running updates limits).
  //    Limit keys use snake_case (`max_events`, `max_custom_domains`, ...)
  //    to match the `Limit` type in src/lib/entitlements.ts. Custom domains
  //    are gated to paid plans (STARTER+).
  const PLANS = [
    {
      name: "FREE",
      displayName: "Free",
      limits: {
        max_events: 3,
        max_participants_per_event: 100,
        max_members: 3,
        max_storage_bytes: 500 * 1024 * 1024,
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
      },
      priceMonthly: 0,
      priceYearly: 0,
    },
    {
      name: "STARTER",
      displayName: "Starter",
      limits: {
        max_events: 10,
        max_participants_per_event: 500,
        max_members: 10,
        max_storage_bytes: 5 * 1024 * 1024 * 1024,
        max_custom_domains: 1,
        max_assessments: 50,
        customBranding: true,
        certificates: true,
        aiProctor: false,
        advancedSecurity: false,
        advancedAnalytics: false,
        customDomain: true,
        removeEngagioBranding: false,
        prioritySupport: false,
      },
      priceMonthly: 99900, // ₹999
      priceYearly: 999900,
    },
    {
      name: "PROFESSIONAL",
      displayName: "Professional",
      limits: {
        max_events: 50,
        max_participants_per_event: 5000,
        max_members: 50,
        max_storage_bytes: 50 * 1024 * 1024 * 1024,
        max_custom_domains: 5,
        max_assessments: 250,
        customBranding: true,
        certificates: true,
        aiProctor: true,
        advancedSecurity: true,
        advancedAnalytics: true,
        customDomain: true,
        removeEngagioBranding: true,
        prioritySupport: true,
      },
      priceMonthly: 299900, // ₹2,999
      priceYearly: 2999900,
    },
    {
      name: "ENTERPRISE",
      displayName: "Enterprise",
      limits: {
        max_events: -1, // unlimited
        max_participants_per_event: -1,
        max_members: -1,
        max_storage_bytes: -1,
        max_custom_domains: 20,
        max_assessments: -1,
        customBranding: true,
        certificates: true,
        aiProctor: true,
        advancedSecurity: true,
        advancedAnalytics: true,
        customDomain: true,
        removeEngagioBranding: true,
        prioritySupport: true,
      },
      priceMonthly: 0, // contact sales
      priceYearly: 0,
    },
  ] as const

  for (const plan of PLANS) {
    await db.plan.upsert({
      where: { name: plan.name },
      create: {
        name: plan.name,
        displayName: plan.displayName,
        limits: JSON.stringify(plan.limits),
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        isActive: true,
      },
      update: {
        displayName: plan.displayName,
        limits: JSON.stringify(plan.limits),
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        isActive: true,
      },
    })
  }
  console.log(`  ✓ Synced ${PLANS.length} plans (FREE, STARTER, PROFESSIONAL, ENTERPRISE)`)

  // 6b. Seed multi-currency PlanPrice rows (INR / USD / EUR / GBP).
  //     Money is stored as integer minor units (paise for INR, cents for USD,
  //     etc.). FREE + ENTERPRISE have no prices — the UI shows "Free" / "Custom".
  //     Yearly is 12 × monthly × 0.8 (20% annual discount).
  const PLAN_PRICES: Array<{
    plan: string
    prices: Array<{ currency: string; monthly: number }>
  }> = [
    {
      plan: "STARTER",
      prices: [
        { currency: "INR", monthly: 99900 }, // ₹999.00
        { currency: "USD", monthly: 1499 }, // $14.99
        { currency: "EUR", monthly: 1399 }, // €13.99
        { currency: "GBP", monthly: 1199 }, // £11.99
      ],
    },
    {
      plan: "PROFESSIONAL",
      prices: [
        { currency: "INR", monthly: 299900 }, // ₹2,999.00
        { currency: "USD", monthly: 4999 }, // $49.99
        { currency: "EUR", monthly: 4499 }, // €44.99
        { currency: "GBP", monthly: 3999 }, // £39.99
      ],
    },
  ]

  let pricesSynced = 0
  for (const { plan: planName, prices } of PLAN_PRICES) {
    const planRow = await db.plan.findUnique({ where: { name: planName } })
    if (!planRow) continue
    for (const { currency, monthly } of prices) {
      // 20% off for annual billing (12 months → 9.6 months equivalent).
      const yearly = Math.round(monthly * 12 * 0.8)
      await db.planPrice.upsert({
        where: { planId_currency: { planId: planRow.id, currency } },
        create: {
          planId: planRow.id,
          currency,
          monthlyAmount: monthly,
          yearlyAmount: yearly,
          isActive: true,
        },
        update: {
          monthlyAmount: monthly,
          yearlyAmount: yearly,
          isActive: true,
        },
      })
      pricesSynced++
    }
  }
  console.log(
    `  ✓ Synced ${pricesSynced} PlanPrice rows (STARTER + PROFESSIONAL × INR/USD/EUR/GBP)`,
  )

  // 7. Assign FREE plan subscription to the Default Org
  if (!defaultOrg.planId) {
    const freePlan = await db.plan.findUnique({ where: { name: "FREE" } })
    if (freePlan) {
      await db.organization.update({
        where: { id: defaultOrg.id },
        data: { planId: freePlan.id },
      })
      console.log("  ✓ Default Org assigned FREE plan")
    }
  }

  console.log("\n✅ Migration complete.")
  console.log(`   Default Org: ${defaultOrg.id}`)
  console.log(`   Slug: ${defaultOrg.slug}`)
  console.log("   All existing events + questions are now owned by the Default Org.")
  console.log("   All users are now members of the Default Org.")
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
