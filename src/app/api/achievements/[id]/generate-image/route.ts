import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTenantContext, auditLog, ownsResource } from "@/lib/tenant"
import { generateAchievementImage } from "@/lib/achievement-image"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/achievements/[id]/generate-image
 *
 * Owner or admin. Generates the card image if not already generated, or
 * regenerates it when `?force=true` (or `{ force: true }` in the body).
 *
 * Returns `{ imageUrl, imagePublicId, dataVersion }`.
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

    // Determine `force` from query or body.
    const url = new URL(req.url)
    const forceQuery = url.searchParams.get("force") === "true"
    let forceBody = false
    try {
      const body = await req.json()
      forceBody = body?.force === true
    } catch {
      // Body is optional — ignore.
    }
    const force = forceQuery || forceBody

    const result = await generateAchievementImage(row, req, force)

    await auditLog(
      ctx,
      "ACHIEVEMENT_IMAGE_GENERATED",
      "ShareableAchievement",
      id,
      { force, dataVersion: result.dataVersion }
    )

    return NextResponse.json({
      imageUrl: result.imageUrl,
      imagePublicId: result.imagePublicId,
      dataVersion: result.dataVersion,
      isLocal: result.isLocal,
    })
  } catch (e) {
    console.error("[POST /api/achievements/[id]/generate-image] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    )
  }
}
