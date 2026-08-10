import { NextRequest, NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { LandingSectionDto, LandingSectionType } from "@/types";

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

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
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const event = await db.event.findUnique({ where: { id }, select: { id: true } });
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
      { error: "Internal Server Error", detail: String(e) },
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
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const event = await db.event.findUnique({ where: { id }, select: { id: true } });
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
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
