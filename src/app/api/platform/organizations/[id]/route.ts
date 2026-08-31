import { NextRequest, NextResponse } from "next/server"
import { getServerSession, isDbPlatformAdmin } from "@/lib/auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { invalidatePlanCache } from "@/lib/entitlements"

async function requirePlatformAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  // DB-backed: re-fetch User.platformRole so demotions apply immediately.
  return isDbPlatformAdmin(session)
}

type RouteContext = { params: Promise<{ id: string }> }

/** PATCH /api/platform/organizations/[id] — update org status or plan */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requirePlatformAdmin())) {
      return NextResponse.json({ error: "Platform admin access required" }, { status: 403 })
    }

    const { id } = await ctx.params
    const body = await req.json()
    const { status, planId } = body

    const org = await db.organization.findUnique({ where: { id } })
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (typeof status === "string" && ["ACTIVE", "SUSPENDED", "ARCHIVED"].includes(status)) {
      data.status = status
    }
    if (typeof planId === "string") {
      const plan = await db.plan.findUnique({ where: { id: planId } })
      if (plan) {
        data.planId = planId
        // Create or update subscription — use findFirst + update/create
        // because Subscription.organizationId is NOT a unique field (only @@index).
        const existingSub = await db.subscription.findFirst({
          where: { organizationId: id },
          select: { id: true },
        })
        if (existingSub) {
          await db.subscription.update({
            where: { id: existingSub.id },
            data: { planId, status: "ACTIVE" },
          })
        } else {
          await db.subscription.create({
            data: { organizationId: id, planId, status: "ACTIVE" },
          })
        }
        invalidatePlanCache(id)
      }
    }

    const updated = await db.organization.update({
      where: { id },
      data,
      select: { id: true, name: true, status: true, planId: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PATCH /api/platform/organizations/[id]] error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
