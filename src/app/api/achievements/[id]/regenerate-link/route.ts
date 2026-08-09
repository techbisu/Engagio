import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTenantContext, auditLog, ownsResource } from "@/lib/tenant"
import { generatePublicToken, buildShareUrl } from "@/lib/achievement"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/achievements/[id]/regenerate-link
 *
 * Owner or admin. Generates a new `publicToken`. The old token becomes
 * invalid (anyone with the old link gets a 404 when fetching /api/share/[old]).
 *
 * Returns `{ publicToken, shareUrl }`.
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

    const newToken = generatePublicToken()
    const updated = await db.shareableAchievement.update({
      where: { id },
      data: { publicToken: newToken },
      select: { publicToken: true },
    })

    const shareUrl = buildShareUrl(req, updated.publicToken)

    await auditLog(
      ctx,
      "ACHIEVEMENT_LINK_REGENERATED",
      "ShareableAchievement",
      id,
      {}
    )

    return NextResponse.json({
      publicToken: updated.publicToken,
      shareUrl,
    })
  } catch (e) {
    console.error("[POST /api/achievements/[id]/regenerate-link] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    )
  }
}
