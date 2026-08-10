import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

async function requirePlatformAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  return (session?.user as any)?.role === "ADMIN"
}

/** GET /api/platform/users — list ALL users */
export async function GET(req: NextRequest) {
  try {
    if (!(await requirePlatformAdmin())) {
      return NextResponse.json({ error: "Platform admin access required" }, { status: 403 })
    }

    const url = new URL(req.url)
    const search = url.searchParams.get("search") || ""
    const role = url.searchParams.get("role") || "ALL"

    const where: Record<string, unknown> = {}
    if (role !== "ALL") where.role = role
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ]
    }

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
      take: 200,
    })

    return NextResponse.json({
      users: users.map((u) => ({
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
      total: users.length,
    })
  } catch (error) {
    console.error("[GET /api/platform/users] error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(error) },
      { status: 500 }
    )
  }
}
