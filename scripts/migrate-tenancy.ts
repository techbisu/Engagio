/**
 * Migration script: multi-tenant backfill.
 *
 * Run: `bun run scripts/migrate-tenancy.ts`
 *
 * 1. Creates a "Default Organization" if it doesn't exist.
 * 2. For every ADMIN user, creates an OWNER membership in the Default Org.
 * 3. For every STUDENT user, creates a PARTICIPANT membership in the Default Org.
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

  // 6. Seed default plans (future-ready stubs)
  const existingPlans = await db.plan.count()
  if (existingPlans === 0) {
    await db.plan.createMany({
      data: [
        {
          name: "FREE",
          displayName: "Free",
          limits: JSON.stringify({
            maxEvents: 3,
            maxParticipantsPerEvent: 100,
            maxMembers: 3,
            customBranding: false,
            certificates: true,
            aiProctor: false,
          }),
          priceMonthly: 0,
          priceYearly: 0,
        },
        {
          name: "STARTER",
          displayName: "Starter",
          limits: JSON.stringify({
            maxEvents: 10,
            maxParticipantsPerEvent: 500,
            maxMembers: 10,
            customBranding: true,
            certificates: true,
            aiProctor: false,
          }),
          priceMonthly: 99900, // ₹999
          priceYearly: 999900,
        },
        {
          name: "PROFESSIONAL",
          displayName: "Professional",
          limits: JSON.stringify({
            maxEvents: 50,
            maxParticipantsPerEvent: 5000,
            maxMembers: 50,
            customBranding: true,
            certificates: true,
            aiProctor: true,
            advancedSecurity: true,
          }),
          priceMonthly: 299900, // ₹2,999
          priceYearly: 2999900,
        },
        {
          name: "ENTERPRISE",
          displayName: "Enterprise",
          limits: JSON.stringify({
            maxEvents: -1, // unlimited
            maxParticipantsPerEvent: -1,
            maxMembers: -1,
            customBranding: true,
            certificates: true,
            aiProctor: true,
            advancedSecurity: true,
            customDomain: true,
          }),
          priceMonthly: 0, // contact sales
          priceYearly: 0,
        },
      ],
    })
    console.log("  ✓ Seeded 4 plans (FREE, STARTER, PROFESSIONAL, ENTERPRISE)")
  } else {
    console.log(`  ✓ Plans already seeded (${existingPlans} found)`)
  }

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
