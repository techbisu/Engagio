import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import type { EventDto } from "@/types";

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

async function requireAuth(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user;
}

function toEventDto(e: any): EventDto {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    image: e.image ?? null,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate.toISOString(),
    isActive: e.isActive,
    createdAt: e.createdAt.toISOString(),
    questionCount: e._count?.questions ?? 0,
    linkCount: e._count?.quizLinks ?? 0,
    attemptCount: e._count?.attempts ?? 0,
  };
}

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/events/[id] — fetch a single event (any authenticated user). */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const event = await db.event.findUnique({
      where: { id },
      include: {
        _count: { select: { questions: true, attempts: true, quizLinks: true } },
      },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(toEventDto(event));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** PATCH /api/events/[id] — update an event (admin only). */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const body = await req.json();
    const { title, description, image, startDate, endDate, isActive } = body || {};

    const data: Record<string, unknown> = {};
    if (typeof title === "string" && title.trim()) data.title = title.trim();
    if (typeof description === "string") data.description = description;
    if (typeof image === "string") data.image = image.trim() || null;
    if (typeof isActive === "boolean") data.isActive = isActive;

    let start = existing.startDate;
    let end = existing.endDate;
    if (startDate !== undefined) {
      const parsed = new Date(startDate);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
      }
      start = parsed;
      data.startDate = parsed;
    }
    if (endDate !== undefined) {
      const parsed = new Date(endDate);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
      }
      end = parsed;
      data.endDate = parsed;
    }
    if (end < start) {
      return NextResponse.json(
        { error: "endDate must be on or after startDate" },
        { status: 400 }
      );
    }

    const updated = await db.event.update({
      where: { id },
      data,
      include: {
        _count: { select: { questions: true, attempts: true, quizLinks: true } },
      },
    });
    return NextResponse.json(toEventDto(updated));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** DELETE /api/events/[id] — delete an event (admin only). Cascades to children. */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    await db.event.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
