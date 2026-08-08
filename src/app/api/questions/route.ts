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

/** GET /api/questions?eventId=xxx — list questions for an event (admin only). */
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const eventId = req.nextUrl.searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json({ error: "Missing eventId query param" }, { status: 400 });
    }
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const questions = await db.question.findMany({
      where: { eventId },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(questions.map(toQuestionDto));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** POST /api/questions — create a question (admin only). */
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { eventId, question, options, correctAnswer, marks, explanation } = body || {};

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }
    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }
    if (!Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: "options must be an array with at least 2 items" },
        { status: 400 }
      );
    }
    if (!options.every((o) => typeof o === "string" && o.trim())) {
      return NextResponse.json(
        { error: "all options must be non-empty strings" },
        { status: 400 }
      );
    }
    const correctIdx = Number(correctAnswer);
    if (
      !Number.isInteger(correctIdx) ||
      correctIdx < 0 ||
      correctIdx >= options.length
    ) {
      return NextResponse.json(
        { error: "correctAnswer must be a valid index into options" },
        { status: 400 }
      );
    }

    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Determine next order index for this event.
    const lastQuestion = await db.question.findFirst({
      where: { eventId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (lastQuestion?.order ?? -1) + 1;

    const created = await db.question.create({
      data: {
        eventId,
        question: question.trim(),
        options: JSON.stringify(options.map((o: string) => o.trim())),
        correctAnswer: correctIdx,
        marks: typeof marks === "number" && marks > 0 ? Math.floor(marks) : 1,
        order: nextOrder,
        explanation:
          typeof explanation === "string" && explanation.trim()
            ? explanation.trim()
            : null,
      },
    });
    return NextResponse.json(toQuestionDto(created), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
