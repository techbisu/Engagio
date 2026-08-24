import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTenantContext, auditLog, ownsResource } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/achievements/[id]/revoke
 *
 * Owner or admin. Sets `visibility = "PRIVATE"`. The public share link stops
 * working (the /api/share/[token] endpoint returns `{ visible: false }`).
 *
 * This is a soft-revoke: the achievement data is preserved and the owner can
 * restore visibility by PATCHing `visibility` back to "LINK_ONLY" or "PUBLIC".
 *
 * Returns `{ success: true }`.
 */
export async function POST(req: NextRequest, ctxParams: RouteContext) {
  try {
    const ctx = await requireTenantContext(req)
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }
    const { id } = await ctxParams.params

    const row = await db.shareableAchievement.findUnique({ where: { id } })
    if (!row || !ownsResource(row, ctx)) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 })
    }
    const isOwner = row.participantId === ctx.userId
    const isAdmin =
      ctx.isPlatformAdmin ||
      ctx.orgRole === "OWNER" ||
      ctx.orgRole === "ADMIN"
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.shareableAchievement.update({
      where: { id },
      data: { visibility: "PRIVATE" },
    })

    await auditLog(
      ctx,
      "ACHIEVEMENT_REVOKED",
      "ShareableAchievement",
      id,
      {}
    )

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[POST /api/achievements/[id]/revoke] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
