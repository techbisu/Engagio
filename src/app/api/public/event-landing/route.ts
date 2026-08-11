import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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

/**
 * GET /api/public/event-landing?eventId=ID
 *
 * PUBLIC — no auth required. Returns only VISIBLE sections for the event,
 * ordered by `order`.
 */
export async function GET(req: NextRequest) {
  try {
    const eventId = new URL(req.url).searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json(
        { error: "eventId query parameter is required" },
        { status: 400 }
      );
    }
    const event = await db.event.findUnique({
      where: { id: eventId, isActive: true },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const sections = await db.eventLandingSection.findMany({
      where: { eventId, isVisible: true },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(sections.map(toDto));
  } catch (error) {
    console.error("[GET /api/public/event-landing] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(error) },
      { status: 500 }
    );
  }
}
