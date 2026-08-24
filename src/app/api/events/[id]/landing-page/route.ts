import { checkBodySize, BODY_LIMITS } from "@/lib/body-limit";
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

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/events/[id]/landing-page
 * Admin-only. Returns ALL sections (including hidden) for the event, ordered.
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
    const { id } = await ctx.params;
    const event = await db.event.findUnique({
      where: { id, organizationId: auth.ctx.orgId },
      select: { id: true, organizationId: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const sections = await db.eventLandingSection.findMany({
      where: { eventId: id },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(sections.map(toDto));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/events/[id]/landing-page
 * Admin-only. Bulk update section order and/or visibility.
 * Body: { sections: Array<{ id: string, order?: number, isVisible?: boolean }> }
 */
export async function PUT(req: NextRequest, ctx: RouteContext) {
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
    const incoming = body?.sections;
    if (!Array.isArray(incoming)) {
      return NextResponse.json(
        { error: "Expected { sections: [...] }" },
        { status: 400 }
      );
    }

    // Run updates in parallel; each one is scoped to this event for safety.
    await db.$transaction(
      incoming
        .filter(
          (s): s is { id: string; order?: number; isVisible?: boolean } =>
            typeof s === "object" && s !== null && typeof s.id === "string"
        )
        .map((s) =>
          db.eventLandingSection.updateMany({
            where: { id: s.id, eventId: id },
            data: {
              ...(typeof s.order === "number" ? { order: s.order } : {}),
              ...(typeof s.isVisible === "boolean"
                ? { isVisible: s.isVisible }
                : {}),
            },
          })
        )
    );

    const sections = await db.eventLandingSection.findMany({
      where: { eventId: id },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(sections.map(toDto));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
