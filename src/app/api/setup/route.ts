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

    results.push("")
    results.push("Now seeding demo organization + event + questions...")

    // ─── 6. Demo Organization ────────────────────────────────────────────
    let demoOrg = await db.organization.findUnique({ where: { slug: "demo-medical" } })
    if (!demoOrg) {
      demoOrg = await db.organization.create({
        data: {
          name: "Demo Medical Association",
          slug: "demo-medical",
          description: "A demo medical association running a summit with Engagio.",
          primaryColor: "#10b981",
          secondaryColor: "#14b8a6",
          status: "ACTIVE",
          industry: "Medical",
          planId: freePlan?.id,
        },
      })
      results.push("Created Demo Medical Association")
    } else {
      results.push("Demo org already exists")
    }

    // ─── 7. Demo Admin ───────────────────────────────────────────────────
    const demoAdmin = await db.user.upsert({
      where: { email: "demo.admin@engagio.app" },
      update: { role: "ADMIN", name: "Dr. Demo Admin" },
      create: { email: "demo.admin@engagio.app", name: "Dr. Demo Admin", role: "ADMIN" },
    })
    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: demoOrg.id, userId: demoAdmin.id } },
      update: { role: "OWNER", status: "ACTIVE" },
      create: { organizationId: demoOrg.id, userId: demoAdmin.id, role: "OWNER", status: "ACTIVE" },
    }).catch(() => {})
    results.push("Demo admin ready: demo.admin@engagio.app")

    // ─── 8. Demo Event (with slug) ──────────────────────────────────────
    let demoEvent = await db.event.findFirst({ where: { organizationId: demoOrg.id, title: "Medical Summit 2026" } })
    if (!demoEvent) {
      demoEvent = await db.event.create({
        data: {
          organizationId: demoOrg.id,
          title: "Medical Summit 2026",
          slug: "medical-summit-2026",
          description: "A 2-day medical summit covering cardiology, emergency medicine, and recent advances in treatment.",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
          isActive: true,
          paymentMethod: "FREE",
          certEnabled: true,
          certTemplate: "modern",
          certIssueCondition: "PASSED",
          certPassingScore: 60,
          certOrgName: "Demo Medical Association",
        },
      })
      results.push("Created demo event: Medical Summit 2026")
    } else if (!demoEvent.slug) {
      demoEvent = await db.event.update({ where: { id: demoEvent.id }, data: { slug: "medical-summit-2026" } })
      results.push("Updated event slug")
    } else {
      results.push("Demo event already exists")
    }

    // ─── 9. Demo Questions ───────────────────────────────────────────────
    const existingQs = await db.question.count({ where: { eventId: demoEvent.id } })
    if (existingQs === 0) {
      const demoQuestions = [
        { question: "What is the first-line treatment for acute STEMI?", options: ["Beta blockers", "Aspirin + P2Y12 inhibitor", "ACE inhibitors", "Statins"], correctAnswer: 1, category: "Cardiology" },
        { question: "Which ECG finding is diagnostic of a posterior wall MI?", options: ["ST elevation in V1-V3", "ST depression in V1-V3", "T wave inversion in V1-V3", "Q waves in V1-V3"], correctAnswer: 1, category: "Cardiology" },
        { question: "What is the most common cause of acute epiglottitis in adults?", options: ["Haemophilus influenzae", "Streptococcus pyogenes", "Staphylococcus aureus", "Candida albicans"], correctAnswer: 0, category: "Emergency Medicine" },
        { question: "True or False: Type 2 diabetes is always insulin-dependent.", options: ["True", "False"], correctAnswer: 1, category: "Endocrinology", type: "TRUE_FALSE" },
        { question: "What is the Glasgow Coma Scale score for a patient who opens eyes to pain, makes incomprehensible sounds, and withdraws to pain?", options: ["6", "7", "8", "9"], correctAnswer: 2, category: "Emergency Medicine" },
        { question: "Which medication is contraindicated in patients with acute asthma?", options: ["Salbutamol", "Ipratropium", "Propranolol", "Montelukast"], correctAnswer: 2, category: "Pharmacology" },
        { question: "What is the normal anion gap range?", options: ["3-11 mEq/L", "8-12 mEq/L", "12-16 mEq/L", "20-30 mEq/L"], correctAnswer: 1, category: "Nephrology" },
        { question: "Which antibiotic is the first-line for community-acquired pneumonia?", options: ["Vancomycin", "Amoxicillin", "Metronidazole", "Gentamicin"], correctAnswer: 1, category: "Infectious Disease" },
        { question: "What is the most sensitive marker for acute kidney injury?", options: ["BUN", "Serum creatinine", "Urine output", "eGFR"], correctAnswer: 1, category: "Nephrology" },
        { question: "True or False: A patient with a GCS of 13 is considered to have a mild head injury.", options: ["True", "False"], correctAnswer: 0, category: "Emergency Medicine", type: "TRUE_FALSE" },
      ]
      for (const [i, q] of demoQuestions.entries()) {
        await db.question.create({
          data: {
            eventId: demoEvent.id,
            organizationId: demoOrg.id,
            question: q.question,
            type: (q as any).type || "MCQ",
            options: JSON.stringify(q.options),
            correctAnswer: q.correctAnswer,
            marks: 1,
            negativeMarks: 0,
            category: q.category,
            difficulty: "MEDIUM",
            order: i,
          },
        })
      }
      results.push(`Created ${demoQuestions.length} demo questions`)
    } else {
      results.push(`Demo questions already exist (${existingQs})`)
    }

    // ─── 10. Demo Quiz Link ──────────────────────────────────────────────
    let quizLink = await db.quizLink.findFirst({ where: { eventId: demoEvent.id } })
    if (!quizLink) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
      let quizSlug = ""
      for (let i = 0; i < 6; i++) quizSlug += chars.charAt(Math.floor(Math.random() * chars.length))
      quizLink = await db.quizLink.create({
        data: {
          eventId: demoEvent.id,
          slug: quizSlug,
          isActive: true,
          shuffleQuestions: true,
          timeLimit: 15,
          maxAttempts: 0,
          showResults: true,
          passThreshold: 60,
          requireFullscreen: true,
          autoSubmitOnExit: true,
          tabSwitchDetection: true,
          copyPasteBlocking: true,
          rightClickDisable: true,
          keyboardShortcutBlocking: true,
          devtoolsDetection: true,
          antiScreenshot: true,
          watermarkOverlay: true,
          aiProctor: false,
        },
      })
      results.push(`Created quiz link: ${quizSlug}`)
    } else {
      results.push(`Quiz link already exists: ${quizLink.slug}`)
    }

    // ─── 11. Demo Participant ─────────────────────────────────────────────
    const demoParticipant = await db.user.upsert({
      where: { email: "demo.participant@engagio.app" },
      update: { name: "Demo Participant" },
      create: { email: "demo.participant@engagio.app", name: "Demo Participant", role: "STUDENT" },
    })
    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: demoOrg.id, userId: demoParticipant.id } },
      update: { role: "PARTICIPANT", status: "ACTIVE" },
      create: { organizationId: demoOrg.id, userId: demoParticipant.id, role: "PARTICIPANT", status: "ACTIVE" },
    }).catch(() => {})
    results.push("Demo participant ready: demo.participant@engagio.app")

    // ─── 12. Super Admin ─────────────────────────────────────────────────
    const superAdmin = await db.user.upsert({
      where: { email: "superadmin@engagio.app" },
      update: { role: "ADMIN", name: "Super Admin" },
      create: { email: "superadmin@engagio.app", name: "Super Admin", role: "ADMIN" },
    })
    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: defaultOrg.id, userId: superAdmin.id } },
      update: {},
      create: { organizationId: defaultOrg.id, userId: superAdmin.id, role: "OWNER", status: "ACTIVE" },
    }).catch(() => {})
    results.push("Super admin ready: superadmin@engagio.app")

    results.push("")
    results.push("🎉 Setup complete! All demo data is ready.")
    results.push("")
    results.push("Demo accounts (use on login page Quick Demo tab):")
    results.push("  Org Admin:    demo.admin@engagio.app")
    results.push("  Participant:  demo.participant@engagio.app")
    results.push("")
    results.push(`Public URLs:`)
    results.push(`  Org page:   /?org=demo-medical`)
    results.push(`  Event page: /?event=medical-summit-2026`)
    results.push(`  Direct quiz: /?quiz=${quizLink?.slug}`)

    return NextResponse.json({
      success: true,
      steps: results,
    })
  } catch (error) {
    console.error("[/api/setup] error:", error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        steps: results,
      },
      { status: 500 }
    )
  }
}
