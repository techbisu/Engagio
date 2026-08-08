import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  requireTenantContext,
  auditLog,
  ownsResource,
} from "@/lib/tenant"
import {
  generatePublicToken,
  defaultTemplateForType,
} from "@/lib/achievement"
import {
  isAchievementType,
  isAchievementVisibility,
  isAchievementTemplateId,
  parseAchievementData,
  toAchievementDto,
} from "@/lib/achievement-mapper"
import type { AchievementData, ShareableAchievementDto } from "@/types"

/**
 * POST /api/achievements
 *
 * Create a new shareable achievement. Authenticated. The caller becomes the
 * participant (participantId = ctx.userId). The org context is resolved via
 * `requireTenantContext` — never trust a client-supplied organizationId.
 *
 * The card image is NOT generated here — it's generated lazily on first share
 * (or via the explicit /generate-image endpoint).
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireTenantContext(req)
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { type, title } = body ?? {}
    if (!isAchievementType(type)) {
      return NextResponse.json(
        { error: "Invalid or missing `type`" },
        { status: 400 }
      )
    }
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Missing required `title`" },
        { status: 400 }
      )
    }

    // Optional fields
    const eventId =
      typeof body.eventId === "string" && body.eventId.trim()
        ? body.eventId.trim()
        : null
    const activityId =
      typeof body.activityId === "string" && body.activityId.trim()
        ? body.activityId.trim()
        : null
    const subtitle =
      typeof body.subtitle === "string" && body.subtitle.trim()
        ? body.subtitle.trim().slice(0, 300)
        : null
    const score = Number.isFinite(body.score) ? Number(body.score) : null
    const totalScore = Number.isFinite(body.totalScore)
      ? Number(body.totalScore)
      : null
    const percentage = Number.isFinite(body.percentage)
      ? Math.max(0, Math.min(100, Math.round(Number(body.percentage))))
      : null
    const rank =
      Number.isFinite(body.rank) && Number(body.rank) > 0
        ? Math.floor(Number(body.rank))
        : null
    const totalParticipants =
      Number.isFinite(body.totalParticipants) && Number(body.totalParticipants) >= 0
        ? Math.floor(Number(body.totalParticipants))
        : null

    // Optional org-scoped validation: if eventId is provided, ensure it belongs
    // to the same org (prevents cross-org leaks via foreign keys).
    if (eventId) {
      const ev = await db.event.findUnique({
        where: { id: eventId },
        select: { id: true, organizationId: true },
      })
      if (!ev || !ownsResource(ev, ctx)) {
        return NextResponse.json(
          { error: "Event not found in current organization" },
          { status: 404 }
        )
      }
    }
    if (activityId) {
      // Activity inherits org scope transitively from its Event (no
      // direct organizationId column on the Activity model).
      const act = await db.activity.findUnique({
        where: { id: activityId },
        select: { id: true, event: { select: { id: true, organizationId: true } } },
      })
      const actOrgId = act?.event?.organizationId ?? null
      if (!act || !actOrgId || (!ctx.isPlatformAdmin && actOrgId !== ctx.orgId)) {
        return NextResponse.json(
          { error: "Activity not found in current organization" },
          { status: 404 }
        )
      }
    }

    const templateId = isAchievementTemplateId(body.templateId)
      ? body.templateId
      : defaultTemplateForType(type)
    const visibility = isAchievementVisibility(body.visibility)
      ? body.visibility
      : "LINK_ONLY"
    const certificateId =
      typeof body.certificateId === "string" && body.certificateId.trim()
        ? body.certificateId.trim()
        : null

    const achievementData: AchievementData = parseAchievementData(
      typeof body.achievementData === "string"
        ? body.achievementData
        : JSON.stringify(body.achievementData ?? {})
    )

    const participantName =
      ctx.userName?.trim() || ctx.userEmail || "Participant"

    const created = await db.shareableAchievement.create({
      data: {
        organizationId: ctx.orgId,
        eventId,
        activityId,
        participantId: ctx.userId,
        participantName,
        type,
        title: title.trim().slice(0, 300),
        subtitle,
        score,
        totalScore,
        percentage,
        rank,
        totalParticipants,
        achievementData: JSON.stringify(achievementData),
        publicToken: generatePublicToken(),
        visibility,
        templateId,
        certificateId,
      },
      include: { _count: { select: { shares: true } } },
    })

    await auditLog(ctx, "ACHIEVEMENT_CREATED", "ShareableAchievement", created.id, {
      type: created.type,
      title: created.title,
    })

    // Return the raw DTO — the frontend (api.ts) is typed as
    // `api<ShareableAchievementDto>(...)`, so no envelope wrapper.
    return NextResponse.json(toAchievementDto(created), { status: 201 })
  } catch (e) {
    console.error("[POST /api/achievements] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/achievements
 *
 * List the current user's shareable achievements. Includes a `shareCount`
 * for each.
 *
 * Query params:
 *   - ?participantId=<userId>   Admin-only — view another participant's achievements.
 *   - ?eventId=<id>             Filter by event (must belong to the org).
 *   - ?type=<type>              Filter by achievement type.
 *
 * Returns `{ achievements: ShareableAchievementDto[], total: number }`.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireTenantContext(req)
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const url = new URL(req.url)
    const requestedParticipant = url.searchParams.get("participantId")
    const eventIdFilter = url.searchParams.get("eventId") || undefined
    const typeFilter = url.searchParams.get("type") || undefined

    // Only admins (org ADMIN+ or platform admin) can view other participants' achievements.
    const wantsOtherParticipant =
      !!requestedParticipant && requestedParticipant !== ctx.userId
    const canViewOthers =
      ctx.isPlatformAdmin ||
      ctx.orgRole === "OWNER" ||
      ctx.orgRole === "ADMIN"
    if (wantsOtherParticipant && !canViewOthers) {
      return NextResponse.json(
        { error: "Insufficient permissions to view other participants' achievements" },
        { status: 403 }
      )
    }

    const where: {
      organizationId: string
      participantId?: string
      eventId?: string
      type?: string
    } = {
      organizationId: ctx.orgId,
      participantId: wantsOtherParticipant
        ? (requestedParticipant as string)
        : ctx.userId,
    }
    if (eventIdFilter) where.eventId = eventIdFilter
    if (typeFilter && isAchievementType(typeFilter)) where.type = typeFilter

    const rows = await db.shareableAchievement.findMany({
      where,
      include: { _count: { select: { shares: true } } },
      orderBy: { createdAt: "desc" },
    })

    const dtos: ShareableAchievementDto[] = rows.map(toAchievementDto)
    return NextResponse.json({ achievements: dtos, total: dtos.length })
  } catch (e) {
    console.error("[GET /api/achievements] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    )
  }
}
