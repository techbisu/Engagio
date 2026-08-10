import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

/** Platform admin only — checks User.role === "ADMIN" */
async function requirePlatformAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  return (session?.user as any)?.role === "ADMIN"
}

/** GET /api/platform/stats — platform-wide dashboard stats */
export async function GET(req: NextRequest) {
  try {
    if (!(await requirePlatformAdmin())) {
      return NextResponse.json({ error: "Platform admin access required" }, { status: 403 })
    }

    const [
      totalOrganizations,
      activeOrganizations,
      suspendedOrganizations,
      totalUsers,
      adminUsers,
      participantUsers,
      totalEvents,
      activeEvents,
      totalActivities,
      totalQuestions,
      totalQuizLinks,
      totalAttempts,
      completedAttempts,
      totalCertificates,
      validCertificates,
      totalAchievements,
      totalShares,
      totalPlans,
      activeSubscriptions,
      totalPayments,
      pendingPayments,
    ] = await Promise.all([
      db.organization.count(),
      db.organization.count({ where: { status: "ACTIVE" } }),
      db.organization.count({ where: { status: "SUSPENDED" } }),
      db.user.count(),
      db.user.count({ where: { role: "ADMIN" } }),
      db.user.count({ where: { role: "STUDENT" } }),
      db.event.count(),
      db.event.count({ where: { isActive: true } }),
      db.activity.count(),
      db.question.count(),
      db.quizLink.count(),
      db.quizAttempt.count(),
      db.quizAttempt.count({ where: { status: "COMPLETED" } }),
      db.certificate.count(),
      db.certificate.count({ where: { status: "VALID" } }),
      db.shareableAchievement.count(),
      db.achievementShare.count(),
      db.plan.count(),
      db.subscription.count({ where: { status: "ACTIVE" } }),
      db.registration.count({ where: { paymentStatus: { in: ["PENDING_VERIFICATION", "COMPLETED", "REJECTED"] } } }),
      db.registration.count({ where: { paymentStatus: "PENDING_VERIFICATION" } }),
    ])

    // Revenue estimate (sum of all COMPLETED subscription monthly amounts)
    const subscriptions = await db.subscription.findMany({
      where: { status: "ACTIVE" },
      include: { plan: { select: { priceMonthly: true, name: true } } },
    })
    const monthlyRevenue = subscriptions.reduce((sum, sub) => {
      return sum + (sub.plan?.priceMonthly || 0)
    }, 0)

    // Recent organizations (last 5)
    const recentOrgs = await db.organization.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        industry: true,
        createdAt: true,
        _count: { select: { events: true, members: true } },
      },
    })

    // Recent users (last 5)
    const recentUsers = await db.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    return NextResponse.json({
      organizations: { total: totalOrganizations, active: activeOrganizations, suspended: suspendedOrganizations },
      users: { total: totalUsers, admins: adminUsers, participants: participantUsers },
      content: {
        events: totalEvents,
        activeEvents,
        activities: totalActivities,
        questions: totalQuestions,
        quizLinks: totalQuizLinks,
      },
      assessments: {
        totalAttempts,
        completedAttempts,
        completionRate: totalAttempts > 0 ? Math.round((completedAttempts / totalAttempts) * 100) : 0,
      },
      certificates: { total: totalCertificates, valid: validCertificates },
      achievements: { total: totalAchievements, shares: totalShares },
      billing: {
        plans: totalPlans,
        activeSubscriptions,
        monthlyRevenue,
        pendingPayments,
        totalPayments,
      },
      recentOrganizations: recentOrgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        status: o.status,
        industry: o.industry,
        createdAt: o.createdAt.toISOString(),
        eventCount: o._count.events,
        memberCount: o._count.members,
      })),
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("[GET /api/platform/stats] error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(error) },
      { status: 500 }
    )
  }
}
