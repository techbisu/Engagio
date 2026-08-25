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
 * GET /api/platform/users — list ALL users (paginated)
 *
 * Query params:
 *   - `search` (optional): search by email or name
 *   - `role` (optional): filter by role (ALL, ADMIN, PARTICIPANT)
 *   - `cursor` (optional): pagination cursor (id of last item)
 *   - `limit` (optional): page size, default 50, max 100
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await requirePlatformAdmin())) {
      return NextResponse.json({ error: "Platform admin access required" }, { status: 403 })
    }

    const url = new URL(req.url)
    const search = url.searchParams.get("search") || ""
    const role = url.searchParams.get("role") || "ALL"
    const cursor = url.searchParams.get("cursor")
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || String(PAGE_SIZE), 10) || PAGE_SIZE, 1), 100)

    const where: Record<string, unknown> = {}
    if (role !== "ALL") where.role = role
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ]
    }
    if (cursor) {
      where.id = { gt: cursor }
    }

    // Fetch one extra to determine if there's a next page
    const users = await db.user.findMany({
      where,
      include: {
        _count: {
          select: {
            attempts: true,
            registrations: true,
            certificates: true,
            organizations: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    })

    const hasNextPage = users.length > limit
    const items = hasNextPage ? users.slice(0, limit) : users
    const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null

    return NextResponse.json({
      users: items.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        image: u.image,
        role: u.role,
        locale: u.locale,
        createdAt: u.createdAt.toISOString(),
        stats: {
          attempts: u._count.attempts,
          registrations: u._count.registrations,
          certificates: u._count.certificates,
          organizations: u._count.organizations,
        },
      })),
      nextCursor,
      total: items.length,
    })
  } catch (error) {
    console.error("[GET /api/platform/users] error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
