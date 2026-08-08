import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import type { QuestionDto } from "@/types";

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

function toQuestionDto(q: any): QuestionDto {
  return {
    id: q.id,
    eventId: q.eventId,
    question: q.question,
    options: parseJsonArray<string>(q.options),
    correctAnswer: q.correctAnswer,
    marks: q.marks,
    order: q.order,
    explanation: q.explanation ?? null,
    createdAt: q.createdAt.toISOString(),
  };
}

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/questions/[id] — update a question (admin only). */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const existing = await db.question.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const body = await req.json();
    const { question, options, correctAnswer, marks, explanation, order } = body || {};

    const data: Record<string, unknown> = {};
    if (typeof question === "string" && question.trim()) data.question = question.trim();
    if (typeof explanation === "string") data.explanation = explanation.trim() || null;
    if (typeof marks === "number" && marks > 0) data.marks = Math.floor(marks);
    if (typeof order === "number" && Number.isInteger(order)) data.order = order;

    // Validate options + correctAnswer together if either is provided.
    const effectiveOptions =
      Array.isArray(options) && options.length >= 2
        ? options.map((o: string) => o.trim()).filter(Boolean)
        : parseJsonArray<string>(existing.options);
    if (Array.isArray(options)) {
      if (effectiveOptions.length < 2) {
        return NextResponse.json(
          { error: "options must have at least 2 non-empty items" },
          { status: 400 }
        );
      }
      data.options = JSON.stringify(effectiveOptions);
    }
    if (correctAnswer !== undefined) {
      const correctIdx = Number(correctAnswer);
      if (
        !Number.isInteger(correctIdx) ||
        correctIdx < 0 ||
        correctIdx >= effectiveOptions.length
      ) {
        return NextResponse.json(
          { error: "correctAnswer must be a valid index into options" },
          { status: 400 }
        );
      }
      data.correctAnswer = correctIdx;
    }

    const updated = await db.question.update({ where: { id }, data });
    return NextResponse.json(toQuestionDto(updated));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** DELETE /api/questions/[id] — delete a question (admin only). */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const existing = await db.question.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    await db.question.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
