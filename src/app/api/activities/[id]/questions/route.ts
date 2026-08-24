import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { requirePermission, ownsResource } from "@/lib/tenant";
import {
  toActivityQuestionDto,
  isValidActivityQuestionType,
} from "@/lib/activity-mapper";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/activities/[id]/questions — list questions for an activity (authenticated). */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const activity = await db.activity.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }
    const questions = await db.activityQuestion.findMany({
      where: { activityId: id },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(questions.map(toActivityQuestionDto));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/** POST /api/activities/[id]/questions — create a question (org-scoped admin). */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "question.create");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await ctx.params;
    const activity = await db.activity.findUnique({
      where: { id },
      select: { id: true },
      include: { event: { select: { organizationId: true } } },
    });
    if (!activity || !ownsResource(activity.event, auth.ctx)) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const body = await req.json();
    const { text, type, options, required, sortOrder } = body || {};

    // ----- Validate text -----
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "text is required and must be non-empty" },
        { status: 400 }
      );
    }

    // ----- Validate type -----
    const qType = typeof type === "string" ? type : "SINGLE_CHOICE";
    if (!isValidActivityQuestionType(qType)) {
      return NextResponse.json(
        {
          error:
            "type must be one of SINGLE_CHOICE|MULTIPLE_CHOICE|RATING|TEXT|NUMBER|YES_NO|OPEN",
        },
        { status: 400 }
      );
    }

    // ----- Resolve options -----
    let optionList: string[] = [];
    if (Array.isArray(options)) {
      optionList = options
        .filter((o: unknown) => typeof o === "string" && o.trim())
        .map((o: string) => o.trim());
    }

    // Choice types must have at least 2 options.
    if (
      (qType === "SINGLE_CHOICE" || qType === "MULTIPLE_CHOICE") &&
      optionList.length < 2
    ) {
      return NextResponse.json(
        {
          error: `${qType} questions require at least 2 options`,
        },
        { status: 400 }
      );
    }
    // For other types options are ignored / allowed empty.
    if (
      qType === "TEXT" ||
      qType === "RATING" ||
      qType === "NUMBER" ||
      qType === "YES_NO" ||
      qType === "OPEN"
    ) {
      // options array is allowed but not required — keep whatever was provided
      // (will be empty array if not given). Don't reject.
    }

    // ----- sortOrder default: current max + 1 -----
    let nextSort: number;
    if (typeof sortOrder === "number" && Number.isInteger(sortOrder)) {
      nextSort = sortOrder;
    } else {
      const maxRow = await db.activityQuestion.aggregate({
        where: { activityId: id },
        _max: { sortOrder: true },
      });
      nextSort = (maxRow._max.sortOrder ?? -1) + 1;
    }

    const created = await db.activityQuestion.create({
      data: {
        activityId: id,
        text: text.trim(),
        type: qType,
        options: JSON.stringify(optionList),
        required: typeof required === "boolean" ? required : true,
        sortOrder: nextSort,
      },
    });

    return NextResponse.json(toActivityQuestionDto(created), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
