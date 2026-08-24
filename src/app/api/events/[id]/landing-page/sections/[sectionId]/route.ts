import { enforceLimit, BODY_LIMITS } from "@/lib/body-limit";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, ownsResource } from "@/lib/tenant";
import type { LandingSectionDto, LandingSectionType } from "@/types";

function toDto(s: {
  id: string;
  eventId: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  data: string;
  order: number;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}): LandingSectionDto {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = s.data ? (JSON.parse(s.data) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  return {
    id: s.id,
    eventId: s.eventId,
    type: s.type as LandingSectionType,
    title: s.title,
    subtitle: s.subtitle,
    data: parsed,
    order: s.order,
    isVisible: s.isVisible,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

type RouteContext = { params: Promise<{ id: string; sectionId: string }> };

/**
 * GET /api/events/[id]/landing-page/sections/[sectionId]
 * Admin-only. Returns a single section.
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "event.update");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id, sectionId } = await ctx.params;
    const event = await db.event.findUnique({
      where: { id, organizationId: auth.ctx.orgId },
      select: { id: true, organizationId: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const section = await db.eventLandingSection.findFirst({
      where: { id: sectionId, eventId: id },
    });
    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    return NextResponse.json(toDto(section));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/events/[id]/landing-page/sections/[sectionId]
 * Admin-only. Updates title/subtitle/data/isVisible/order for a section.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "event.update");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id, sectionId } = await ctx.params;
    const event = await db.event.findUnique({ where: { id }, select: { id: true, organizationId: true } });
    if (!event || !ownsResource(event, auth.ctx)) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const existing = await db.eventLandingSection.findFirst({
      where: { id: sectionId, eventId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.title === "string") {
      data.title = body.title.trim() ? body.title.trim().slice(0, 200) : null;
    }
    if (typeof body.subtitle === "string") {
      data.subtitle = body.subtitle.trim()
        ? body.subtitle.trim().slice(0, 300)
        : null;
    }
    if (body.data !== undefined && typeof body.data === "object" && body.data !== null) {
      data.data = JSON.stringify(body.data);
    }
    if (typeof body.isVisible === "boolean") data.isVisible = body.isVisible;
    if (typeof body.order === "number" && Number.isFinite(body.order)) {
      data.order = Math.max(0, Math.floor(body.order));
    }

    const updated = await db.eventLandingSection.update({
      where: { id: sectionId },
      data,
    });
    return NextResponse.json(toDto(updated));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[id]/landing-page/sections/[sectionId]
 * Admin-only. Deletes a section. Remaining sections keep their order values;
 * the client re-normalizes orders on save (the PUT bulk endpoint).
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "event.update");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id, sectionId } = await ctx.params;
    const event = await db.event.findUnique({ where: { id }, select: { id: true, organizationId: true } });
    if (!event || !ownsResource(event, auth.ctx)) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const existing = await db.eventLandingSection.findFirst({
      where: { id: sectionId, eventId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
    await db.eventLandingSection.delete({ where: { id: sectionId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
