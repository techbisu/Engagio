import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * GET /api/setup
 *
 * One-time setup endpoint. Creates:
 * 1. Plans (FREE, STARTER, PROFESSIONAL, ENTERPRISE)
 * 2. Plan prices for all currencies
 * 3. Default Organization
 * 4. Org memberships for existing users
 * 5. Backfills events + questions to Default Org
 *
 * Tables must already exist (created by `prisma db push` in the build step).
 * This endpoint is idempotent — safe to call multiple times.
 *
 * Usage: Visit https://your-app.vercel.app/api/setup
 */
export async function GET() {
  const results: string[] = []

  // Platform admin auth required
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const user = session.user as any
  if (user.platformRole !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    // 1. Seed Plans
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
              maxStorageBytes: 500 * 1024 * 1024,
              maxCustomDomains: 0,
              maxAssessments: 10,
              customBranding: false,
              certificates: true,
              aiProctor: false,
              advancedSecurity: false,
              advancedAnalytics: false,
              customDomain: false,
              removeEngagioBranding: false,
              prioritySupport: false,
            }),
            priceMonthly: 0,
            priceYearly: 0,
            isActive: true,
          },
          {
            name: "STARTER",
            displayName: "Starter",
            limits: JSON.stringify({
              maxEvents: 10,
              maxParticipantsPerEvent: 500,
              maxMembers: 10,
              maxStorageBytes: 2 * 1024 * 1024 * 1024,
              maxCustomDomains: 1,
              maxAssessments: 50,
              customBranding: true,
              certificates: true,
              aiProctor: false,
              advancedSecurity: false,
              advancedAnalytics: false,
              customDomain: true,
              removeEngagioBranding: false,
              prioritySupport: false,
            }),
            priceMonthly: 49900,
            priceYearly: 499900,
            isActive: true,
          },
          {
            name: "PROFESSIONAL",
            displayName: "Professional",
            limits: JSON.stringify({
              maxEvents: 50,
              maxParticipantsPerEvent: 5000,
              maxMembers: 50,
              maxStorageBytes: 10 * 1024 * 1024 * 1024,
              maxCustomDomains: 1,
              maxAssessments: 200,
              customBranding: true,
              certificates: true,
              aiProctor: true,
              advancedSecurity: true,
              advancedAnalytics: true,
              customDomain: true,
              removeEngagioBranding: true,
              prioritySupport: true,
            }),
            priceMonthly: 299900,
            priceYearly: 2999900,
            isActive: true,
          },
          {
            name: "ENTERPRISE",
            displayName: "Enterprise",
            limits: JSON.stringify({
              maxEvents: -1,
              maxParticipantsPerEvent: -1,
              maxMembers: -1,
              maxStorageBytes: -1,
              maxCustomDomains: 10,
              maxAssessments: -1,
              customBranding: true,
              certificates: true,
              aiProctor: true,
              advancedSecurity: true,
              advancedAnalytics: true,
              customDomain: true,
              removeEngagioBranding: true,
              prioritySupport: true,
            }),
            priceMonthly: 0,
            priceYearly: 0,
            isActive: true,
          },
        ],
      })
      results.push("Created 4 plans (FREE, STARTER, PROFESSIONAL, ENTERPRISE)")
    } else {
      results.push(`Plans already exist (${existingPlans} found)`)
    }

    // 2. Seed Plan Prices for multi-currency
    const starterPlan = await db.plan.findUnique({ where: { name: "STARTER" } })
    const proPlan = await db.plan.findUnique({ where: { name: "PROFESSIONAL" } })
    const existingPrices = await db.planPrice.count()
    if (existingPrices === 0 && starterPlan && proPlan) {
      await db.planPrice.createMany({
        data: [
          { planId: starterPlan.id, currency: "INR", monthlyAmount: 49900, yearlyAmount: 499000, isActive: true },
          { planId: starterPlan.id, currency: "USD", monthlyAmount: 999, yearlyAmount: 9999, isActive: true },
          { planId: starterPlan.id, currency: "EUR", monthlyAmount: 799, yearlyAmount: 7999, isActive: true },
          { planId: starterPlan.id, currency: "GBP", monthlyAmount: 699, yearlyAmount: 6999, isActive: true },
          { planId: proPlan.id, currency: "INR", monthlyAmount: 299900, yearlyAmount: 2999000, isActive: true },
          { planId: proPlan.id, currency: "USD", monthlyAmount: 2999, yearlyAmount: 29999, isActive: true },
          { planId: proPlan.id, currency: "EUR", monthlyAmount: 2499, yearlyAmount: 24999, isActive: true },
          { planId: proPlan.id, currency: "GBP", monthlyAmount: 1999, yearlyAmount: 19999, isActive: true },
        ],
      })
      results.push("Created 8 plan prices (STARTER + PROFESSIONAL × 4 currencies)")
    } else {
      results.push(`Plan prices already exist (${existingPrices} found)`)
    }

    // 3. Create Default Organization
    let defaultOrg = await db.organization.findUnique({ where: { slug: "default" } })
    if (!defaultOrg) {
      const freePlanForOrg = await db.plan.findUnique({ where: { name: "FREE" } })
      defaultOrg = await db.organization.create({
        data: {
          name: "Default Organization",
          slug: "default",
          description: "Default organization for existing data.",
          status: "ACTIVE",
          planId: freePlanForOrg?.id || null,
        },
      })
      results.push("Created Default Organization")
    } else {
      results.push("Default Organization already exists")
    }

    // 4. Create org memberships for existing users
    const existingMembers = await db.organizationMember.count({
      where: { organizationId: defaultOrg.id },
    })
    if (existingMembers === 0) {
      const allUsers = await db.user.findMany()
      for (const user of allUsers) {
        await db.organizationMember
          .create({
            data: {
              organizationId: defaultOrg.id,
              userId: user.id,
              role: user.role === "ADMIN" ? "OWNER" : "PARTICIPANT",
              status: "ACTIVE",
            },
          })
          .catch(() => {})
      }
      results.push(`Created ${allUsers.length} org memberships`)
    } else {
      results.push(`Org memberships already exist (${existingMembers})`)
    }

    // 5. Backfill events + questions
    const eventsWithoutOrg = await db.event.count({ where: { organizationId: null } })
    if (eventsWithoutOrg > 0) {
      await db.event.updateMany({
        where: { organizationId: null },
        data: { organizationId: defaultOrg.id },
      })
      results.push(`Backfilled ${eventsWithoutOrg} events`)
    }

    const questionsWithoutOrg = await db.question.count({ where: { organizationId: null } })
    if (questionsWithoutOrg > 0) {
      await db.question.updateMany({
        where: { organizationId: null },
        data: { organizationId: defaultOrg.id },
      })
      results.push(`Backfilled ${questionsWithoutOrg} questions`)
    }

    // ─── 12. Super Admin ─────────────────────────────────────────────────
    const superAdmin = await db.user.upsert({
      where: { email: process.env.SUPERADMIN_EMAIL || "superadmin@engagio.app" },
      update: { role: "ADMIN", name: "Super Admin" },
      create: { email: process.env.SUPERADMIN_EMAIL || "superadmin@engagio.app", name: "Super Admin", role: "ADMIN" },
    })
    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: defaultOrg.id, userId: superAdmin.id } },
      update: {},
      create: { organizationId: defaultOrg.id, userId: superAdmin.id, role: "OWNER", status: "ACTIVE" },
    }).catch(() => {})
    results.push("Super admin ready: " + (process.env.SUPERADMIN_EMAIL || "superadmin@engagio.app"))

    results.push("")
    results.push("🎉 Setup complete!")
    results.push("")
    results.push("")
    results.push(`Public URLs:`)
    results.push(`  Direct quiz: /quiz/${quizLink?.slug}`)

    return NextResponse.json({
      success: true,
      steps: results,
    })
  } catch (error) {
    console.error("[/api/setup] error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
        steps: results,
      },
      { status: 500 }
    )
  }
}
