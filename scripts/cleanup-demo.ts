// Cleanup script: Removes demo organization, events, questions, quiz links,
// and related test data. Keeps the Default Organization and Super Admin.
//
// Run: bun run scripts/cleanup-demo.ts
//
// WARNING: This will DELETE demo data. Make sure you have backups if needed.

import { db } from "../src/lib/db"

async function main() {
  console.log("🧹 Cleaning up demo data...")

  // Find the demo organization
  const demoOrg = await db.organization.findUnique({ where: { slug: "demo-medical" } })
  
  if (!demoOrg) {
    console.log("  ✓ Demo organization not found (already cleaned up)")
    return
  }

  console.log(`  Found demo org: ${demoOrg.name} (${demoOrg.id})`)

  // Delete in order of dependencies

  // 1. Delete quiz attempts (depends on QuizLink and User)
  const attempts = await db.quizAttempt.deleteMany({
    where: { event: { organizationId: demoOrg.id } }
  })
  console.log(`  ✓ Deleted ${attempts.count} quiz attempts`)

  // 2. Delete quiz links (depends on Event)
  const quizLinks = await db.quizLink.deleteMany({
    where: { event: { organizationId: demoOrg.id } }
  })
  console.log(`  ✓ Deleted ${quizLinks.count} quiz links`)

  // 3. Delete questions (depends on Event)
  const questions = await db.question.deleteMany({
    where: { event: { organizationId: demoOrg.id } }
  })
  console.log(`  ✓ Deleted ${questions.count} questions`)

  // 4. Delete registrations (depends on Event and User)
  const registrations = await db.registration.deleteMany({
    where: { event: { organizationId: demoOrg.id } }
  })
  console.log(`  ✓ Deleted ${registrations.count} registrations`)

  // 5. Delete certificates (depends on Event and User)
  const certificates = await db.certificate.deleteMany({
    where: { event: { organizationId: demoOrg.id } }
  })
  console.log(`  ✓ Deleted ${certificates.count} certificates`)

  // 6. Delete activities and related data
  const activities = await db.activity.findMany({
    where: { eventId: { in: (await db.event.findMany({ where: { organizationId: demoOrg.id }, select: { id: true } })).map(e => e.id) } }
  })
  
  for (const activity of activities) {
    await db.activityResponse.deleteMany({ where: { activityId: activity.id } })
    await db.activityQuestion.deleteMany({ where: { activityId: activity.id } })
    await db.activityParticipation.deleteMany({ where: { activityId: activity.id } })
  }
  const deletedActivities = await db.activity.deleteMany({
    where: { event: { organizationId: demoOrg.id } }
  })
  console.log(`  ✓ Deleted ${deletedActivities.count} activities`)

  // 7. Delete events
  const events = await db.event.deleteMany({
    where: { organizationId: demoOrg.id }
  })
  console.log(`  ✓ Deleted ${events.count} events`)

  // 8. Delete organization members
  const members = await db.organizationMember.deleteMany({
    where: { organizationId: demoOrg.id }
  })
  console.log(`  ✓ Deleted ${members.count} organization members`)

  // 9. Delete organization invitations
  const invitations = await db.organizationInvitation.deleteMany({
    where: { organizationId: demoOrg.id }
  })
  console.log(`  ✓ Deleted ${invitations.count} organization invitations`)

  // 10. Delete audit logs
  const auditLogs = await db.auditLog.deleteMany({
    where: { organizationId: demoOrg.id }
  })
  console.log(`  ✓ Deleted ${auditLogs.count} audit logs`)

  // 11. Delete organization domains
  const domains = await db.organizationDomain.deleteMany({
    where: { organizationId: demoOrg.id }
  })
  console.log(`  ✓ Deleted ${domains.count} organization domains`)

  // 12. Delete payment configs
  const paymentConfigs = await db.paymentProviderConfig.deleteMany({
    where: { organizationId: demoOrg.id }
  })
  console.log(`  ✓ Deleted ${paymentConfigs.count} payment configs`)

  // 13. Delete gate passes
  const gatePasses = await db.gatePass.deleteMany({
    where: { event: { organizationId: demoOrg.id } }
  })
  console.log(`  ✓ Deleted ${gatePasses.count} gate passes`)

  // 14. Delete achievement shares and achievements
  const achievements = await db.shareableAchievement.findMany({
    where: { organizationId: demoOrg.id }
  })
  for (const achievement of achievements) {
    await db.achievementShare.deleteMany({ where: { achievementId: achievement.id } })
  }
  const deletedAchievements = await db.shareableAchievement.deleteMany({
    where: { organizationId: demoOrg.id }
  })
  console.log(`  ✓ Deleted ${deletedAchievements.count} achievements`)

  // 15. Delete landing page sections
  const landingSections = await db.eventLandingSection.deleteMany({
    where: { event: { organizationId: demoOrg.id } }
  })
  console.log(`  ✓ Deleted ${landingSections.count} landing page sections`)

  // 16. Delete event fields
  const eventFields = await db.eventField.deleteMany({
    where: { event: { organizationId: demoOrg.id } }
  })
  console.log(`  ✓ Deleted ${eventFields.count} event fields`)

  // 17. Delete the organization itself
  await db.organization.delete({ where: { id: demoOrg.id } })
  console.log(`  ✓ Deleted demo organization: ${demoOrg.name}`)

  // 18. Clean up demo users (optional - keeps super admin)
  const demoUsers = await db.user.findMany({
    where: {
      email: { in: ["demo.admin@engagio.app", "demo.participant@engagio.app"] }
    }
  })
  
  for (const user of demoUsers) {
    // Delete user's sessions and accounts first
    await db.session.deleteMany({ where: { userId: user.id } })
    await db.account.deleteMany({ where: { userId: user.id } })
    await db.user.delete({ where: { id: user.id } })
    console.log(`  ✓ Deleted demo user: ${user.email}`)
  }

  console.log("\n✅ Demo data cleanup complete!")
  console.log("\n📋 Remaining accounts:")
  console.log("  Super Admin: superadmin@engagio.app")
  console.log("  Default Organization: /org/default")
}

main()
  .catch((e) => { console.error("❌ Cleanup failed:", e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })
