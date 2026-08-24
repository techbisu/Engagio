#!/bin/bash
# Build script for Vercel — auto-detects DB provider, creates tables, seeds data
set -e

SCHEMA="prisma/schema.prisma"
DB_URL="${DATABASE_URL:-}"

echo "[build] DATABASE_URL starts with: ${DB_URL:0:30}..."

# Production hardening: fail if using SQLite in production (data durability)
if [[ "$NODE_ENV" == "production" && "$DB_URL" == file:* ]]; then
  echo "[build] ERROR: SQLite is not allowed in production. Use PostgreSQL."
  exit 1
fi

# Production hardening: fail if secrets are missing
if [[ "$NODE_ENV" == "production" ]]; then
  if [[ -z "$NEXTAUTH_SECRET" || "$NEXTAUTH_SECRET" == "generate-with-openssl-rand-base64-32" ]]; then
    echo "[build] ERROR: NEXTAUTH_SECRET is not set or uses example value."
    exit 1
  fi
  if [[ -z "$SUPERADMIN_EMAIL" ]]; then
    echo "[build] ERROR: SUPERADMIN_EMAIL is not set."
    exit 1
  fi
fi


# Auto-switch Prisma provider based on DATABASE_URL
if [[ "$DB_URL" == postgresql://* ]] || [[ "$DB_URL" == postgres://* ]]; then
  echo "[build] PostgreSQL detected — switching provider"
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA"
elif [[ "$DB_URL" == file:* ]]; then
  echo "[build] SQLite detected — keeping provider"
else
  echo "[build] WARNING: Unknown DATABASE_URL format"
fi

# Generate Prisma client
echo "[build] Running prisma generate..."
npx prisma generate

# Production: run migrations, not db push
if [[ "$NODE_ENV" == "production" ]]; then
  echo "[build] Running prisma db push (production — applies schema changes)..."
  npx prisma db push
else
  echo "[build] Running prisma db push (dev)..."
  npx prisma db push --accept-data-loss
fi

# Seed demo data (plans, org, event, questions, quiz, users)
echo "[build] Running seed..."
node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  console.log('[seed] Starting...');

  // 1. Plans
  const planCount = await db.plan.count();
  if (planCount === 0) {
    await db.plan.createMany({ data: [
      { name: 'FREE', displayName: 'Free', limits: JSON.stringify({maxEvents:3,maxParticipantsPerEvent:100,maxMembers:3,customBranding:false,certificates:true,aiProctor:false}), priceMonthly: 0, priceYearly: 0, isActive: true },
      { name: 'STARTER', displayName: 'Starter', limits: JSON.stringify({maxEvents:10,maxParticipantsPerEvent:500,maxMembers:10,customBranding:true,certificates:true,aiProctor:false}), priceMonthly: 49900, priceYearly: 499900, isActive: true },
      { name: 'PROFESSIONAL', displayName: 'Professional', limits: JSON.stringify({maxEvents:50,maxParticipantsPerEvent:5000,maxMembers:50,customBranding:true,certificates:true,aiProctor:true,advancedSecurity:true}), priceMonthly: 299900, priceYearly: 2999900, isActive: true },
      { name: 'ENTERPRISE', displayName: 'Enterprise', limits: JSON.stringify({maxEvents:-1,maxParticipantsPerEvent:-1,maxMembers:-1,customBranding:true,certificates:true,aiProctor:true}), priceMonthly: 0, priceYearly: 0, isActive: true },
    ]});
    console.log('[seed] Created 4 plans');
  } else { console.log('[seed] Plans exist: ' + planCount); }

  const freePlan = await db.plan.findUnique({ where: { name: 'FREE' } });

  // 2. Plan Prices
  const priceCount = await db.planPrice.count();
  if (priceCount === 0) {
    const starter = await db.plan.findUnique({ where: { name: 'STARTER' } });
    const pro = await db.plan.findUnique({ where: { name: 'PROFESSIONAL' } });
    if (starter && pro) {
      await db.planPrice.createMany({ data: [
        { planId: starter.id, currency: 'INR', monthlyAmount: 49900, yearlyAmount: 499000, isActive: true },
        { planId: starter.id, currency: 'USD', monthlyAmount: 999, yearlyAmount: 9999, isActive: true },
        { planId: starter.id, currency: 'EUR', monthlyAmount: 799, yearlyAmount: 7999, isActive: true },
        { planId: starter.id, currency: 'GBP', monthlyAmount: 699, yearlyAmount: 6999, isActive: true },
        { planId: pro.id, currency: 'INR', monthlyAmount: 299900, yearlyAmount: 2999000, isActive: true },
        { planId: pro.id, currency: 'USD', monthlyAmount: 2999, yearlyAmount: 29999, isActive: true },
        { planId: pro.id, currency: 'EUR', monthlyAmount: 2499, yearlyAmount: 24999, isActive: true },
        { planId: pro.id, currency: 'GBP', monthlyAmount: 1999, yearlyAmount: 19999, isActive: true },
      ]});
      console.log('[seed] Created 8 plan prices');
    }
  } else { console.log('[seed] Plan prices exist: ' + priceCount); }

  // 3. Default Organization
  let defaultOrg = await db.organization.findUnique({ where: { slug: 'default' } });
  if (!defaultOrg) {
    defaultOrg = await db.organization.create({ data: { name: 'Default Organization', slug: 'default', status: 'ACTIVE', planId: freePlan?.id } });
    console.log('[seed] Created Default Organization');
  } else { console.log('[seed] Default Organization exists'); }

  // 4. Super Admin (with platformRole=SUPERADMIN)
  const sa = await db.user.upsert({ where: { email: 'superadmin@engagio.app' }, update: { role: 'ADMIN', platformRole: 'SUPERADMIN', name: 'Super Admin' }, create: { email: 'superadmin@engagio.app', name: 'Super Admin', role: 'ADMIN', platformRole: 'SUPERADMIN' } });
  await db.organizationMember.upsert({ where: { organizationId_userId: { organizationId: defaultOrg.id, userId: sa.id } }, update: {}, create: { organizationId: defaultOrg.id, userId: sa.id, role: 'OWNER', status: 'ACTIVE' } }).catch(() => {});
  console.log('[seed] Super Admin ready');

  // 5. Demo Organization
  let demoOrg = await db.organization.findUnique({ where: { slug: 'demo-medical' } });
  if (!demoOrg) {
    demoOrg = await db.organization.create({ data: { name: 'Demo Medical Association', slug: 'demo-medical', description: 'A demo medical association running a summit with Engagio.', primaryColor: '#10b981', secondaryColor: '#14b8a6', status: 'ACTIVE', industry: 'Medical', planId: freePlan?.id } });
    console.log('[seed] Created Demo Medical Association');
  } else { console.log('[seed] Demo org exists'); }

  // 6. Demo Admin
  const da = await db.user.upsert({ where: { email: 'demo.admin@engagio.app' }, update: { role: 'ADMIN', name: 'Dr. Demo Admin' }, create: { email: 'demo.admin@engagio.app', name: 'Dr. Demo Admin', role: 'ADMIN' } });
  await db.organizationMember.upsert({ where: { organizationId_userId: { organizationId: demoOrg.id, userId: da.id } }, update: { role: 'OWNER', status: 'ACTIVE' }, create: { organizationId: demoOrg.id, userId: da.id, role: 'OWNER', status: 'ACTIVE' } }).catch(() => {});
  console.log('[seed] Demo Admin ready');

  // 7. Demo Event
  let event = await db.event.findFirst({ where: { organizationId: demoOrg.id, title: 'Medical Summit 2026' } });
  if (!event) {
    event = await db.event.create({ data: { organizationId: demoOrg.id, title: 'Medical Summit 2026', slug: 'medical-summit-2026', description: 'A 2-day medical summit covering cardiology, emergency medicine, and recent advances.', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isActive: true, paymentMethod: 'FREE', certEnabled: true, certTemplate: 'modern', certIssueCondition: 'PASSED', certPassingScore: 60, certOrgName: 'Demo Medical Association' } });
    console.log('[seed] Created Medical Summit 2026');
  } else if (!event.slug) {
    event = await db.event.update({ where: { id: event.id }, data: { slug: 'medical-summit-2026' } });
    console.log('[seed] Updated event slug');
  } else { console.log('[seed] Event exists'); }

  // 8. Demo Questions
  const qCount = await db.question.count({ where: { eventId: event.id } });
  if (qCount === 0) {
    const qs = [
      { q: 'What is the first-line treatment for acute STEMI?', o: ['Beta blockers','Aspirin + P2Y12 inhibitor','ACE inhibitors','Statins'], a: 1, c: 'Cardiology' },
      { q: 'Which ECG finding is diagnostic of a posterior wall MI?', o: ['ST elevation in V1-V3','ST depression in V1-V3','T wave inversion','Q waves'], a: 1, c: 'Cardiology' },
      { q: 'What is the most common cause of acute epiglottitis in adults?', o: ['Haemophilus influenzae','Streptococcus pyogenes','Staphylococcus aureus','Candida'], a: 0, c: 'Emergency Medicine' },
      { q: 'True or False: Type 2 diabetes is always insulin-dependent.', o: ['True','False'], a: 1, c: 'Endocrinology', t: 'TRUE_FALSE' },
      { q: 'What is the Glasgow Coma Scale score for eyes to pain, incomprehensible sounds, withdraws to pain?', o: ['6','7','8','9'], a: 2, c: 'Emergency Medicine' },
      { q: 'Which medication is contraindicated in acute asthma?', o: ['Salbutamol','Ipratropium','Propranolol','Montelukast'], a: 2, c: 'Pharmacology' },
      { q: 'What is the normal anion gap range?', o: ['3-11 mEq/L','8-12 mEq/L','12-16 mEq/L','20-30 mEq/L'], a: 1, c: 'Nephrology' },
      { q: 'Which antibiotic is first-line for community-acquired pneumonia?', o: ['Vancomycin','Amoxicillin','Metronidazole','Gentamicin'], a: 1, c: 'Infectious Disease' },
      { q: 'What is the most sensitive marker for acute kidney injury?', o: ['BUN','Serum creatinine','Urine output','eGFR'], a: 1, c: 'Nephrology' },
      { q: 'True or False: A GCS of 13 is considered mild head injury.', o: ['True','False'], a: 0, c: 'Emergency Medicine', t: 'TRUE_FALSE' },
    ];
    for (let i = 0; i < qs.length; i++) {
      await db.question.create({ data: { eventId: event.id, organizationId: demoOrg.id, question: qs[i].q, type: qs[i].t || 'MCQ', options: JSON.stringify(qs[i].o), correctAnswer: qs[i].a, marks: 1, negativeMarks: 0, category: qs[i].c, difficulty: 'MEDIUM', order: i } });
    }
    console.log('[seed] Created 10 questions');
  } else { console.log('[seed] Questions exist: ' + qCount); }

  // 9. Demo Quiz Link
  let quiz = await db.quizLink.findFirst({ where: { eventId: event.id } });
  if (!quiz) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let slug = '';
    for (let i = 0; i < 6; i++) slug += chars[Math.floor(Math.random() * chars.length)];
    quiz = await db.quizLink.create({ data: { eventId: event.id, slug, isActive: true, shuffleQuestions: true, timeLimit: 15, maxAttempts: 0, showResults: true, passThreshold: 60, requireFullscreen: true, autoSubmitOnExit: true, tabSwitchDetection: true, copyPasteBlocking: true, rightClickDisable: true, keyboardShortcutBlocking: true, devtoolsDetection: true, antiScreenshot: true, watermarkOverlay: true, aiProctor: false } });
    console.log('[seed] Created quiz link: ' + slug);
  } else { console.log('[seed] Quiz link exists: ' + quiz.slug); }

  // 10. Demo Participant
  const dp = await db.user.upsert({ where: { email: 'demo.participant@engagio.app' }, update: { name: 'Demo Participant' }, create: { email: 'demo.participant@engagio.app', name: 'Demo Participant', role: 'STUDENT' } });
  await db.organizationMember.upsert({ where: { organizationId_userId: { organizationId: demoOrg.id, userId: dp.id } }, update: { role: 'PARTICIPANT', status: 'ACTIVE' }, create: { organizationId: demoOrg.id, userId: dp.id, role: 'PARTICIPANT', status: 'ACTIVE' } }).catch(() => {});
  console.log('[seed] Demo Participant ready');

  console.log('[seed] ✅ Complete!');
  console.log('[seed] Org URL: /?org=demo-medical');
  console.log('[seed] Event URL: /?event=medical-summit-2026');
  console.log('[seed] Quiz URL: /?quiz=' + quiz.slug);
  await db.\$disconnect();
}
main().catch(e => { console.error('[seed] ERROR:', e); process.exit(1); });
"

# Build Next.js
echo "[build] Running next build..."
npx next build
