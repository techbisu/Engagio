import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

async function requirePlatformAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  return (session?.user as any)?.role === "ADMIN"
}

/** GET /api/platform/organizations — list ALL organizations with stats */
export async function GET(req: NextRequest) {
  try {
    if (!(await requirePlatformAdmin())) {
      return NextResponse.json({ error: "Platform admin access required" }, { status: 403 })
    }

    const url = new URL(req.url)
    const search = url.searchParams.get("search") || ""
    const status = url.searchParams.get("status") || "ALL"

    const where: Record<string, unknown> = {}
    if (status !== "ALL") where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }

    const orgs = await db.organization.findMany({
      where,
      include: {
        _count: {
          select: {
            events: true,
            members: true,
            questions: true,
            certificates: true,
          },
        },
        plan: { select: { name: true, displayName: true } },
        subscription: { select: { status: true, currentPeriodEnd: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return NextResponse.json({
      organizations: orgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        status: org.status,
        industry: org.industry,
        email: org.email,
        website: org.website,
        billingCurrency: org.billingCurrency,
        plan: org.plan?.displayName || "Free",
        planName: org.plan?.name || "FREE",
        subscriptionStatus: org.subscription?.status || "NONE",
        createdAt: org.createdAt.toISOString(),
        stats: {
          events: org._count.events,
          members: org._count.members,
          questions: org._count.questions,
          certificates: org._count.certificates,
        },
      })),
      total: orgs.length,
    })
  } catch (error) {
    console.error("[GET /api/platform/organizations] error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(error) },
      { status: 500 }
    )
  }
}

/** PATCH /api/platform/organizations/[id] — change org status or plan */
// (handled in [id]/route.ts)
