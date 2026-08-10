// Demo data seed: Creates a demo organization, org admin, demo event with
// event slug + quiz link + questions, and a demo participant.
//
// Run: bun run scripts/seed-demo.ts
//
// Demo accounts:
//   demo.admin@engagio.app       → Org Admin of "Demo Medical Association"
//   demo.participant@engagio.app  → Participant who can take the demo quiz
//
// Public URLs:
//   /?org=demo-medical             → Org landing page
//   /?event=medical-summit-2026    → Event landing page
//   /?quiz=QUIZ_SLUG              → Direct quiz link

import { db } from "../src/lib/db"
import { generateQuizSlug } from "../src/lib/utils"

async function main() {
  console.log("🌱 Seeding demo data...")

  // ─── 1. Plans (if not seeded) ────────────────────────────────────────
  const planCount = await db.plan.count()
  if (planCount === 0) {
    await db.plan.createMany({
      data: [
        { name: "FREE", displayName: "Free", limits: JSON.stringify({ maxEvents: 3, maxParticipantsPerEvent: 100, maxMembers: 3, customBranding: false, certificates: true, aiProctor: false }), priceMonthly: 0, priceYearly: 0, isActive: true },
        { name: "STARTER", displayName: "Starter", limits: JSON.stringify({ maxEvents: 10, maxParticipantsPerEvent: 500, maxMembers: 10, customBranding: true, certificates: true, aiProctor: false }), priceMonthly: 49900, priceYearly: 499900, isActive: true },
        { name: "PROFESSIONAL", displayName: "Professional", limits: JSON.stringify({ maxEvents: 50, maxParticipantsPerEvent: 5000, maxMembers: 50, customBranding: true, certificates: true, aiProctor: true, advancedSecurity: true }), priceMonthly: 299900, priceYearly: 2999900, isActive: true },
        { name: "ENTERPRISE", displayName: "Enterprise", limits: JSON.stringify({ maxEvents: -1, maxParticipantsPerEvent: -1, maxMembers: -1, customBranding: true, certificates: true, aiProctor: true }), priceMonthly: 0, priceYearly: 0, isActive: true },
      ],
    })
    console.log("  ✓ Seeded 4 plans")
  } else {
    console.log(`  ✓ Plans already exist (${planCount})`)
  }

  const freePlan = await db.plan.findUnique({ where: { name: "FREE" } })

  // ─── 2. Default Organization (for superadmin) ────────────────────────
  let defaultOrg = await db.organization.findUnique({ where: { slug: "default" } })
  if (!defaultOrg) {
    defaultOrg = await db.organization.create({
      data: { name: "Default Organization", slug: "default", status: "ACTIVE", planId: freePlan?.id },
    })
    console.log("  ✓ Default Organization created")
  }

  // ─── 3. Super Admin ──────────────────────────────────────────────────
  const superAdmin = await db.user.upsert({
    where: { email: "superadmin@engagio.app" },
    update: { role: "ADMIN", name: "Super Admin" },
    create: { email: "superadmin@engagio.app", name: "Super Admin", role: "ADMIN" },
  })
  console.log(`  ✓ Super Admin: ${superAdmin.email}`)

  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: defaultOrg.id, userId: superAdmin.id } },
    update: {},
    create: { organizationId: defaultOrg.id, userId: superAdmin.id, role: "OWNER", status: "ACTIVE" },
  }).catch(() => {})

  // ─── 4. Demo Organization ────────────────────────────────────────────
  let demoOrg = await db.organization.findUnique({ where: { slug: "demo-medical" } })
  if (!demoOrg) {
    demoOrg = await db.organization.create({
      data: {
        name: "Demo Medical Association",
        slug: "demo-medical",
        description: "A demo medical association running a summit with Engagio. Participants can register and take online tests.",
        website: "https://example.com",
        email: "info@demo-medical.org",
        primaryColor: "#10b981",
        secondaryColor: "#14b8a6",
        status: "ACTIVE",
        industry: "Medical",
        planId: freePlan?.id,
      },
    })
    console.log(`  ✓ Demo Organization: ${demoOrg.name}`)
  } else {
    console.log(`  ✓ Demo Organization already exists`)
  }

  // ─── 5. Demo Org Admin ──────────────────────────────────────────────
  const demoAdmin = await db.user.upsert({
    where: { email: "demo.admin@engagio.app" },
    update: { role: "ADMIN", name: "Dr. Demo Admin" },
    create: { email: "demo.admin@engagio.app", name: "Dr. Demo Admin", role: "ADMIN" },
  })
  console.log(`  ✓ Demo Admin: ${demoAdmin.email}`)

  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: demoOrg.id, userId: demoAdmin.id } },
    update: { role: "OWNER", status: "ACTIVE" },
    create: { organizationId: demoOrg.id, userId: demoAdmin.id, role: "OWNER", status: "ACTIVE" },
  }).catch(() => {})

  // ─── 6. Demo Event (with slug!) ─────────────────────────────────────
  let demoEvent = await db.event.findFirst({
    where: { organizationId: demoOrg.id, title: "Medical Summit 2026" },
  })
  if (!demoEvent) {
    demoEvent = await db.event.create({
      data: {
        organizationId: demoOrg.id,
        title: "Medical Summit 2026",
        slug: "medical-summit-2026",
        description: "A 2-day medical summit covering cardiology, emergency medicine, and recent advances in treatment. Test your knowledge with this interactive quiz.",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        isActive: true,
        requireRegistration: false,
        paymentMethod: "FREE",
        certEnabled: true,
        certTemplate: "modern",
        certIssueCondition: "PASSED",
        certPassingScore: 60,
        certOrgName: "Demo Medical Association",
        certSigneeName: "Dr. Demo Admin",
        certSigneeTitle: "Conference Director",
      },
    })
    console.log(`  ✓ Demo Event: ${demoEvent.title} (slug: ${demoEvent.slug})`)
  } else {
    // Update slug if missing
    if (!demoEvent.slug) {
      demoEvent = await db.event.update({ where: { id: demoEvent.id }, data: { slug: "medical-summit-2026" } })
      console.log(`  ✓ Updated event slug: medical-summit-2026`)
    } else {
      console.log(`  ✓ Demo Event already exists (slug: ${demoEvent.slug})`)
    }
  }

  // ─── 7. Demo Questions ──────────────────────────────────────────────
  const questions = [
    { question: "What is the first-line treatment for acute STEMI?", options: ["Beta blockers", "Aspirin + P2Y12 inhibitor", "ACE inhibitors", "Statins"], correctAnswer: 1, marks: 1, explanation: "Dual antiplatelet therapy is the first-line treatment for STEMI.", category: "Cardiology", difficulty: "MEDIUM" },
    { question: "Which ECG finding is diagnostic of a posterior wall MI?", options: ["ST elevation in V1-V3", "ST depression in V1-V3", "T wave inversion in V1-V3", "Q waves in V1-V3"], correctAnswer: 1, marks: 1, explanation: "ST depression in V1-V3 is the reciprocal change indicating posterior wall MI.", category: "Cardiology", difficulty: "HARD" },
    { question: "What is the most common cause of acute epiglottitis in adults?", options: ["Haemophilus influenzae", "Streptococcus pyogenes", "Staphylococcus aureus", "Candida albicans"], correctAnswer: 0, marks: 1, explanation: "Haemophilus influenzae type b is the most common cause.", category: "Emergency Medicine", difficulty: "EASY" },
    { question: "True or False: Type 2 diabetes is always insulin-dependent.", options: ["True", "False"], correctAnswer: 1, marks: 1, explanation: "Type 2 is typically non-insulin-dependent initially.", category: "Endocrinology", difficulty: "EASY", type: "TRUE_FALSE" },
    { question: "What is the Glasgow Coma Scale score for a patient who opens eyes to pain, makes incomprehensible sounds, and withdraws to pain?", options: ["6", "7", "8", "9"], correctAnswer: 2, marks: 1, explanation: "E2 + V2 + M4 = GCS 8.", category: "Emergency Medicine", difficulty: "MEDIUM" },
    { question: "Which medication is contraindicated in patients with acute asthma?", options: ["Salbutamol", "Ipratropium", "Propranolol", "Montelukast"], correctAnswer: 2, marks: 1, explanation: "Non-selective beta-blockers can cause bronchospasm.", category: "Pharmacology", difficulty: "MEDIUM" },
    { question: "What is the normal anion gap range?", options: ["3-11 mEq/L", "8-12 mEq/L", "12-16 mEq/L", "20-30 mEq/L"], correctAnswer: 1, marks: 1, explanation: "Normal anion gap is 8-12 mEq/L.", category: "Nephrology", difficulty: "MEDIUM" },
    { question: "Which antibiotic is the first-line for community-acquired pneumonia?", options: ["Vancomycin", "Amoxicillin", "Metronidazole", "Gentamicin"], correctAnswer: 1, marks: 1, explanation: "Amoxicillin is first-line for CAP.", category: "Infectious Disease", difficulty: "EASY" },
    { question: "What is the most sensitive marker for acute kidney injury?", options: ["BUN", "Serum creatinine", "Urine output", "eGFR"], correctAnswer: 1, marks: 1, explanation: "Serum creatinine is the most commonly used marker.", category: "Nephrology", difficulty: "EASY" },
    { question: "True or False: A patient with a GCS of 13 is considered to have a mild head injury.", options: ["True", "False"], correctAnswer: 0, marks: 1, explanation: "GCS 13-15 = mild, 9-12 = moderate, ≤8 = severe.", category: "Emergency Medicine", difficulty: "EASY", type: "TRUE_FALSE" },
  ]

  const existingQuestions = await db.question.count({ where: { eventId: demoEvent.id } })
  if (existingQuestions === 0) {
    for (const [i, q] of questions.entries()) {
      await db.question.create({
        data: {
          eventId: demoEvent.id,
          organizationId: demoOrg.id,
          question: q.question,
          type: (q as any).type || "MCQ",
          options: JSON.stringify(q.options),
          correctAnswer: q.correctAnswer,
          marks: q.marks,
          negativeMarks: 0,
          category: q.category,
          difficulty: (q as any).difficulty || "MEDIUM",
          explanation: q.explanation,
          order: i,
        },
      })
    }
    console.log(`  ✓ ${questions.length} questions seeded`)
  } else {
    console.log(`  ✓ Questions already exist (${existingQuestions})`)
  }

  // ─── 8. Demo Quiz Link ──────────────────────────────────────────────
  let demoQuizLink = await db.quizLink.findFirst({ where: { eventId: demoEvent.id } })
  if (!demoQuizLink) {
    const slug = generateQuizSlug(6)
    demoQuizLink = await db.quizLink.create({
      data: {
        eventId: demoEvent.id,
        slug,
        isActive: true,
        shuffleQuestions: true,
        timeLimit: 15,
        maxAttempts: 0,
        showResults: true,
        publishResults: false,
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
    console.log(`  ✓ Quiz Link: ${demoQuizLink.slug}`)
  } else {
    console.log(`  ✓ Quiz Link already exists: ${demoQuizLink.slug}`)
  }

  // ─── 9. Demo Participant ─────────────────────────────────────────────
  const demoParticipant = await db.user.upsert({
    where: { email: "demo.participant@engagio.app" },
    update: { name: "Demo Participant" },
    create: { email: "demo.participant@engagio.app", name: "Demo Participant", role: "STUDENT" },
  })
  console.log(`  ✓ Demo Participant: ${demoParticipant.email}`)

  // Register participant as member of demo org
  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: demoOrg.id, userId: demoParticipant.id } },
    update: { role: "PARTICIPANT", status: "ACTIVE" },
    create: { organizationId: demoOrg.id, userId: demoParticipant.id, role: "PARTICIPANT", status: "ACTIVE" },
  }).catch(() => {})

  // ─── Done ───────────────────────────────────────────────────────────
  console.log("\n✅ Demo data seeded successfully!")
  console.log("\n📋 Demo Accounts:")
  console.log("  ┌────────────────────────────────────────────────────────────┐")
  console.log("  │ Org Admin    │ demo.admin@engagio.app       │ (any pw) │")
  console.log("  │ Participant  │ demo.participant@engagio.app │ (any pw) │")
  console.log("  └────────────────────────────────────────────────────────────┘")
  console.log(`\n🔗 Public URLs:`)
  console.log(`   Org page:     /?org=demo-medical`)
  console.log(`   Event page:   /?event=medical-summit-2026`)
  console.log(`   Direct quiz:  /?quiz=${demoQuizLink.slug}`)
  console.log("\n   Use the 'Quick Demo' tab on the login page for 1-click access.")
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
