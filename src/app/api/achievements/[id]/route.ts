import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTenantContext, auditLog, ownsResource } from "@/lib/tenant"
import {
  isAchievementTemplateId,
  isAchievementVisibility,
  toAchievementDto,
} from "@/lib/achievement-mapper"
import { deleteImage } from "@/lib/storage"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Resolve an achievement by id and verify the caller can access it.
 *
 * - Owner (participantId === ctx.userId): can view/edit.
 * - Org ADMIN+/OWNER or platform admin: can view/edit any achievement in their org.
 * - Otherwise: 403 forbidden.
 *
 * Also returns 404 if the achievement doesn't exist (don't leak existence).
 */
async function resolveAchievementForCaller(
  id: string,
  ctx: Awaited<ReturnType<typeof requireTenantContext>>,
  requireAdmin = false
) {
  if ("error" in ctx) {
    return { error: ctx.error, status: ctx.status as number }
  }
  const row = await db.shareableAchievement.findUnique({
    where: { id },
    include: { _count: { select: { shares: true } } },
  })
  if (!row || !ownsResource(row, ctx)) {
    return { error: "Achievement not found", status: 404 }
  }
  const isOwner = row.participantId === ctx.userId
  const isAdmin =
    ctx.isPlatformAdmin ||
    ctx.orgRole === "OWNER" ||
    ctx.orgRole === "ADMIN"
  if (!isOwner && !isAdmin) {
    return { error: "Forbidden", status: 403 }
  }
  if (requireAdmin && !isAdmin) {
    // Only admins (not owners) for some operations? Per spec: owner OR admin.
    // So we don't enforce this — kept for future use.
  }
  return { row, ctx, isOwner, isAdmin }
}

/** GET /api/achievements/[id] — fetch a single achievement. */
export async function GET(req: NextRequest, ctxParams: RouteContext) {
  try {
    const ctx = await requireTenantContext(req)
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }
    const { id } = await ctxParams.params
    const result = await resolveAchievementForCaller(id, ctx)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    // Return the raw DTO (no envelope) — matches the frontend's typing.
    return NextResponse.json(toAchievementDto(result.row))
  } catch (e) {
    console.error("[GET /api/achievements/[id]] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/achievements/[id]
 *
 * Owner or admin. Updates `visibility` and/or `templateId`. If `templateId`
 * changes, the cached image is invalidated (imageUrl/imagePublicId cleared)
 * and `dataVersion` is bumped so the next share regenerates the card.
 *
 * Body: `{ visibility?, templateId? }`
 */
export async function PATCH(req: NextRequest, ctxParams: RouteContext) {
  try {
    const ctx = await requireTenantContext(req)
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }
    const { id } = await ctxParams.params
    const result = await resolveAchievementForCaller(id, ctx)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const updates: {
      visibility?: string
      templateId?: string
      imageUrl?: null
      imagePublicId?: null
      dataVersion?: { increment: number }
    } = {}

    let templateChanged = false
    if (body?.visibility !== undefined) {
      if (!isAchievementVisibility(body.visibility)) {
        return NextResponse.json(
          { error: "Invalid `visibility`" },
          { status: 400 }
        )
      }
      updates.visibility = body.visibility
    }
    if (body?.templateId !== undefined) {
      if (!isAchievementTemplateId(body.templateId)) {
        return NextResponse.json(
          { error: "Invalid `templateId`" },
          { status: 400 }
        )
      }
      if (body.templateId !== result.row.templateId) {
        updates.templateId = body.templateId
        templateChanged = true
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(toAchievementDto(result.row))
    }

    // If template changed, invalidate cached image + bump version.
    // Also delete the old Cloudinary asset (best-effort).
    if (templateChanged) {
      updates.imageUrl = null
      updates.imagePublicId = null
      updates.dataVersion = { increment: 1 }
      if (result.row.imagePublicId) {
        deleteImage(result.row.imagePublicId).catch(() => {})
      }
    }

    const updated = await db.shareableAchievement.update({
      where: { id },
      data: updates,
      include: { _count: { select: { shares: true } } },
    })

    await auditLog(ctx, "ACHIEVEMENT_UPDATED", "ShareableAchievement", id, {
      visibility: updates.visibility,
      templateId: updates.templateId,
      templateChanged,
    })

    // Return the raw DTO — the frontend's PATCH is typed as
    // `api<ShareableAchievementDto>(...)`.
    return NextResponse.json(toAchievementDto(updated))
  } catch (e) {
    console.error("[PATCH /api/achievements/[id]] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/achievements/[id]
 *
 * Owner or admin. Deletes the achievement — cascades to AchievementShare.
 * Best-effort deletes the Cloudinary image asset.
 */
export async function DELETE(req: NextRequest, ctxParams: RouteContext) {
  try {
    const ctx = await requireTenantContext(req)
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }
    const { id } = await ctxParams.params
    const result = await resolveAchievementForCaller(id, ctx)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    // Best-effort: delete the Cloudinary image first.
    if (result.row.imagePublicId) {
      deleteImage(result.row.imagePublicId).catch(() => {})
    }

    await db.shareableAchievement.delete({ where: { id } })

    await auditLog(ctx, "ACHIEVEMENT_DELETED", "ShareableAchievement", id, {
      type: result.row.type,
      title: result.row.title,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[DELETE /api/achievements/[id]] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
