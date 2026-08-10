import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import {
  toActivityQuestionDto,
  isValidActivityQuestionType,
} from "@/lib/activity-mapper";

/** Check the session for an admin role. Returns true if the caller is an admin. */
async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

type RouteContext = { params: Promise<{ id: string; qid: string }> };

/** PATCH /api/activities/[id]/questions/[qid] — update a question (admin only). */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id, qid } = await ctx.params;
    const existing = await db.activityQuestion.findFirst({
      where: { id: qid, activityId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const body = await req.json();
    const { text, type, options, required, sortOrder } = body || {};

    const data: Record<string, unknown> = {};

    if (typeof text === "string") {
      if (!text.trim()) {
        return NextResponse.json(
          { error: "text must be non-empty" },
          { status: 400 }
        );
      }
      data.text = text.trim();
    }

    if (type !== undefined) {
      if (!isValidActivityQuestionType(type)) {
        return NextResponse.json(
          { error: "Invalid question type" },
          { status: 400 }
        );
      }
      data.type = type;
    }

    if (Array.isArray(options)) {
      const optionList = options
        .filter((o: unknown) => typeof o === "string" && o.trim())
        .map((o: string) => o.trim());

      const effectiveType = (data.type as string) ?? existing.type;
      if (
        (effectiveType === "SINGLE_CHOICE" ||
          effectiveType === "MULTIPLE_CHOICE") &&
        optionList.length < 2
      ) {
        return NextResponse.json(
          {
            error: `${effectiveType} questions require at least 2 options`,
          },
          { status: 400 }
        );
      }
      data.options = JSON.stringify(optionList);
    }

    if (typeof required === "boolean") {
      data.required = required;
    }
    if (typeof sortOrder === "number" && Number.isInteger(sortOrder)) {
      data.sortOrder = sortOrder;
    }

    const updated = await db.activityQuestion.update({
      where: { id: qid },
      data,
    });

    return NextResponse.json(toActivityQuestionDto(updated));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** DELETE /api/activities/[id]/questions/[qid] — delete a question (admin only). */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id, qid } = await ctx.params;
    const existing = await db.activityQuestion.findFirst({
      where: { id: qid, activityId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    // ActivityResponse.questionId has onDelete: SetNull, so existing responses
    // keep their data but lose the FK link.
    await db.activityQuestion.delete({ where: { id: qid } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
