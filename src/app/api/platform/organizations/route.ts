import { NextRequest, NextResponse } from "next/server"
import { getServerSession, isDbPlatformAdmin } from "@/lib/auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

const PAGE_SIZE = 50

async function requirePlatformAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  return isDbPlatformAdmin(session)
}

/**
 * GET /api/platform/organizations — list ALL organizations (paginated)
 *
 * Query params:
 *   - `search` (optional): search by name, slug, or email
 *   - `status` (optional): filter by status (ALL, ACTIVE, SUSPENDED, ARCHIVED)
 *   - `cursor` (optional): pagination cursor
 *   - `limit` (optional): page size, default 50, max 100
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await requirePlatformAdmin())) {
      return NextResponse.json({ error: "Platform admin access required" }, { status: 403 })
    }

    const url = new URL(req.url)
    const search = url.searchParams.get("search") || ""
    const status = url.searchParams.get("status") || "ALL"
    const cursor = url.searchParams.get("cursor")
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || String(PAGE_SIZE), 10) || PAGE_SIZE, 1), 100)

    const where: Record<string, unknown> = {}
    if (status !== "ALL") where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }
    if (cursor) {
      where.id = { gt: cursor }
    }

    // Fetch one extra to determine if there's a next page
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
      take: limit + 1,
    })

    const hasNextPage = orgs.length > limit
    const items = hasNextPage ? orgs.slice(0, limit) : orgs
    const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null

    return NextResponse.json({
      organizations: items.map((org) => ({
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
      nextCursor,
      total: items.length,
    })
  } catch (error) {
    console.error("[GET /api/platform/organizations] error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
