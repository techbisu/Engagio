import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTenantContext, auditLog, ownsResource } from "@/lib/tenant"
import { renderCard } from "@/lib/card-renderer"
import { parseAchievementData } from "@/lib/achievement-mapper"
import { buildShareUrl } from "@/lib/achievement"
import type { AchievementData, AchievementTemplateId, AchievementType } from "@/types"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/achievements/[id]/generate-image
 *
 * Owner or admin. Generates the card image ON DEMAND and returns it directly
 * as a PNG download (NOT stored in Cloudinary or DB). This keeps storage
 * costs at zero — the image is regenerated each time the user requests it.
 *
 * Returns a PNG image response (Content-Type: image/png) with a
 * Content-Disposition header for download.
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

    // Build the share URL for the QR code.
    const shareUrl = buildShareUrl(req, row.publicToken)
    const achievementData: AchievementData = parseAchievementData(row.achievementData)

    // Render the card (SVG + PNG buffer) on demand.
    const { png } = await renderCard({
      templateId: row.templateId as AchievementTemplateId,
      type: row.type as AchievementType,
      title: row.title,
      subtitle: row.subtitle,
      participantName: row.participantName,
      score: row.score,
      totalScore: row.totalScore,
      percentage: row.percentage,
      rank: row.rank,
      totalParticipants: row.totalParticipants,
      achievementData,
      orgLogoUrl: achievementData.orgLogoUrl ?? null,
      shareUrl,
    })

    await auditLog(
      ctx,
      "ACHIEVEMENT_IMAGE_GENERATED",
      "ShareableAchievement",
      id,
      { onDemand: true }
    )

    // Return the PNG directly — no storage upload, no DB save.
    const fileName = `achievement-${row.id.slice(-12)}.png`
    const headers = new Headers({
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    })
    // Convert Buffer to Uint8Array for the Response body.
    const pngBytes = new Uint8Array(png)
    return new NextResponse(pngBytes, { status: 200, headers })
  } catch (e) {
    console.error("[POST /api/achievements/[id]/generate-image] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
