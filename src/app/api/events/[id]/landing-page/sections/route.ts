import { enforceLimit, BODY_LIMITS } from "@/lib/body-limit";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, ownsResource } from "@/lib/tenant";
import type { LandingSectionDto, LandingSectionType } from "@/types";

const ALLOWED_TYPES: LandingSectionType[] = [
  "HERO",
  "ABOUT",
  "SPEAKERS",
  "SCHEDULE",
  "SPONSORS",
  "VENUE",
  "AGENDA",
  "FAQ",
  "GALLERY",
  "CTA",
  "STATS",
  "CUSTOM",
];

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/events/[id]/landing-page/sections
 * Admin-only. Creates a new section. The new section is appended at the end
 * (order = current max + 1).
 *
 * Body: {
 *   type: LandingSectionType,
 *   title?: string,
 *   subtitle?: string,
 *   data?: Record<string, unknown>,
 *   isVisible?: boolean
 * }
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "event.update");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await ctx.params;
    const event = await db.event.findUnique({
      where: { id, organizationId: auth.ctx.orgId },
      select: { id: true, organizationId: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const type = String(body.type ?? "").toUpperCase() as LandingSectionType;
    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid section type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 200)
        : null;
    const subtitle =
      typeof body.subtitle === "string" && body.subtitle.trim()
        ? body.subtitle.trim().slice(0, 300)
        : null;
    const dataStr = JSON.stringify(
      body.data && typeof body.data === "object" ? body.data : {}
    );
    const isVisible =
      typeof body.isVisible === "boolean" ? body.isVisible : true;

    // Calculate next order = max(order) + 1 (or 0 if none exist yet).
    const last = await db.eventLandingSection.findFirst({
      where: { eventId: id },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (last?.order ?? -1) + 1;

    const created = await db.eventLandingSection.create({
      data: {
        eventId: id,
        type,
        title,
        subtitle,
        data: dataStr,
        order: nextOrder,
        isVisible,
      },
    });

    let parsed: Record<string, unknown> = {};
    try {
      parsed = created.data ? (JSON.parse(created.data) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }
    const dto: LandingSectionDto = {
      id: created.id,
      eventId: created.eventId,
      type: created.type as LandingSectionType,
      title: created.title,
      subtitle: created.subtitle,
      data: parsed,
      order: created.order,
      isVisible: created.isVisible,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
    return NextResponse.json(dto, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
