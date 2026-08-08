import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import {
  toActivityDto,
  toActivityQuestionDto,
  fetchActivityQuizLink,
  isValidActivityType,
  parseActivitySettings,
} from "@/lib/activity-mapper";
import type { ActivitySettings } from "@/types";

/** Check the session for an admin role. Returns true if the caller is an admin. */
async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/activities/[id] — single activity with questions + counts.
 *  Admin sees everything. An authenticated participant is also allowed. */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const activity = await db.activity.findUnique({
      where: { id },
      include: {
        _count: {
          select: { questions: true, responses: true, participations: true },
        },
        questions: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }
    const quizLink = await fetchActivityQuizLink(activity.quizLinkId);
    return NextResponse.json({
      ...toActivityDto(activity, quizLink),
      questions: activity.questions.map(toActivityQuestionDto),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** PATCH /api/activities/[id] — update activity fields (admin only). */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const existing = await db.activity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      title,
      description,
      type,
      status,
      isEnabled,
      sortOrder,
      startsAt,
      endsAt,
      settings,
      session,
    } = body || {};

    const data: Record<string, unknown> = {};

    // ----- Simple scalar fields -----
    if (typeof title === "string" && title.trim()) {
      data.title = title.trim();
    }
    if (typeof description === "string") {
      data.description = description || null;
    }
    if (type !== undefined) {
      if (!isValidActivityType(type)) {
        return NextResponse.json(
          { error: "Invalid activity type" },
          { status: 400 }
        );
      }
      data.type = type;
    }
    if (typeof sortOrder === "number" && Number.isInteger(sortOrder)) {
      data.sortOrder = sortOrder;
    }
    if (typeof session === "string") {
      data.session = session.trim() || null;
    }

    // ----- Date fields -----
    if (startsAt !== undefined) {
      if (startsAt === null || startsAt === "") {
        data.startsAt = null;
      } else {
        const parsed = new Date(startsAt);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: "Invalid startsAt" },
            { status: 400 }
          );
        }
        data.startsAt = parsed;
      }
    }
    if (endsAt !== undefined) {
      if (endsAt === null || endsAt === "") {
        data.endsAt = null;
      } else {
        const parsed = new Date(endsAt);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: "Invalid endsAt" },
            { status: 400 }
          );
        }
        data.endsAt = parsed;
      }
    }

    // ----- settings (merged with defaults) -----
    if (settings !== undefined) {
      if (settings === null) {
        data.settings = JSON.stringify(parseActivitySettings(null));
      } else if (typeof settings === "object" && !Array.isArray(settings)) {
        // Merge new settings on top of existing ones (so partial updates work).
        const current = parseActivitySettings(existing.settings);
        const merged: ActivitySettings = { ...current, ...(settings as ActivitySettings) };
        data.settings = JSON.stringify(merged);
      } else {
        return NextResponse.json(
          { error: "settings must be an object" },
          { status: 400 }
        );
      }
    }

    // ----- status + isEnabled interplay -----
    if (typeof status === "string") {
      data.status = status;
      // Per spec: when setting to LIVE, force isEnabled=true. For CLOSED/COMPLETED
      // we keep the existing isEnabled (don't override).
      if (status === "LIVE") {
        data.isEnabled = true;
      }
    }
    if (typeof isEnabled === "boolean") {
      data.isEnabled = isEnabled;
    }

    const updated = await db.activity.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { questions: true, responses: true, participations: true },
        },
        questions: { orderBy: { sortOrder: "asc" } },
      },
    });
    const quizLink = await fetchActivityQuizLink(updated.quizLinkId);

    return NextResponse.json({
      ...toActivityDto(updated, quizLink),
      questions: updated.questions.map(toActivityQuestionDto),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** DELETE /api/activities/[id] — delete activity (cascades to children) (admin only). */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const existing = await db.activity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }
    await db.activity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
