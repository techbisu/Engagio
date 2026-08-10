import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { generateQuizSlug } from "@/lib/utils";
import {
  toActivityDto,
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

/** GET /api/activities?eventId=xxx — list all activities for an event (admin only). */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const eventId = req.nextUrl.searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json(
        { error: "Missing eventId query param" },
        { status: 400 }
      );
    }
    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const activities = await db.activity.findMany({
      where: { eventId },
      include: {
        _count: {
          select: {
            questions: true,
            responses: true,
            participations: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    // Fetch quiz links in parallel for activities that reference one.
    const quizLinkIds = activities
      .map((a) => a.quizLinkId)
      .filter((id): id is string => !!id);
    const quizLinks = await Promise.all(
      quizLinkIds.map((id) =>
        db.quizLink.findUnique({
          where: { id },
          select: { id: true, slug: true, timeLimit: true },
        })
      )
    );
    const quizLinkMap = new Map(
      quizLinks
        .filter((ql): ql is NonNullable<typeof ql> => !!ql)
        .map((ql) => [ql.id, ql])
    );
    return NextResponse.json(
      activities.map((a) => toActivityDto(a, a.quizLinkId ? quizLinkMap.get(a.quizLinkId) ?? null : null))
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** POST /api/activities — create a new activity (admin only). */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const adminId = (session?.user as any)?.id ?? null;
    const body = await req.json();
    const {
      eventId,
      type,
      title,
      description,
      startsAt,
      endsAt,
      settings,
      quizLinkId,
      session: sessionLabel,
    } = body || {};

    // ----- Validate eventId -----
    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 }
      );
    }
    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // ----- Validate type -----
    if (!isValidActivityType(type)) {
      return NextResponse.json(
        {
          error:
            'type must be one of QUIZ|LIVE_QUIZ|POLL|SURVEY|FEEDBACK|Q_AND_A|VOTING|KNOWLEDGE_CHECK|PRE_POST_ASSESSMENT',
        },
        { status: 400 }
      );
    }

    // ----- Validate title -----
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "title is required and must be non-empty" },
        { status: 400 }
      );
    }

    // ----- Validate quizLinkId (only meaningful for QUIZ type) -----
    if (quizLinkId) {
      const ql = await db.quizLink.findUnique({
        where: { id: quizLinkId },
        select: { id: true, eventId: true },
      });
      if (!ql) {
        return NextResponse.json(
          { error: "quizLinkId does not exist" },
          { status: 400 }
        );
      }
      if (ql.eventId !== eventId) {
        return NextResponse.json(
          { error: "quizLinkId must belong to the same event" },
          { status: 400 }
        );
      }
    }

    // ----- Validate date inputs -----
    let startsAtDate: Date | null = null;
    let endsAtDate: Date | null = null;
    if (startsAt !== undefined && startsAt !== null && startsAt !== "") {
      startsAtDate = new Date(startsAt);
      if (isNaN(startsAtDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid startsAt" },
          { status: 400 }
        );
      }
    }
    if (endsAt !== undefined && endsAt !== null && endsAt !== "") {
      endsAtDate = new Date(endsAt);
      if (isNaN(endsAtDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid endsAt" },
          { status: 400 }
        );
      }
    }

    // ----- Merge settings (defaults + provided) -----
    const mergedSettings: ActivitySettings = {
      ...parseActivitySettings(null), // start from defaults
      ...(settings &&
      typeof settings === "object" &&
      !Array.isArray(settings)
        ? (settings as ActivitySettings)
        : {}),
    };

    // ----- Generate a unique slug -----
    let slug = "";
    let attempt = 0;
    while (attempt < 5) {
      const candidate = generateQuizSlug(6);
      const clash = await db.activity.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!clash) {
        slug = candidate;
        break;
      }
      attempt++;
    }
    if (!slug) {
      return NextResponse.json(
        { error: "Failed to generate a unique slug. Please try again." },
        { status: 500 }
      );
    }

    // ----- sortOrder: current max + 1 -----
    const maxRow = await db.activity.aggregate({
      where: { eventId },
      _max: { sortOrder: true },
    });
    const nextSort = (maxRow._max.sortOrder ?? -1) + 1;

    const created = await db.activity.create({
      data: {
        eventId,
        type,
        title: title.trim(),
        description:
          typeof description === "string" ? description : null,
        status: "DRAFT",
        isEnabled: true,
        sortOrder: nextSort,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        settings: JSON.stringify(mergedSettings),
        quizLinkId: typeof quizLinkId === "string" ? quizLinkId : null,
        session:
          typeof sessionLabel === "string" && sessionLabel.trim()
            ? sessionLabel.trim()
            : null,
        slug,
        createdBy: adminId,
      },
      include: {
        _count: {
          select: { questions: true, responses: true, participations: true },
        },
      },
    });
    const quizLink = await fetchActivityQuizLink(created.quizLinkId);

    return NextResponse.json(toActivityDto(created, quizLink), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
