import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { parseJsonArray, stringifyJson } from "@/lib/utils";
import {
  toQuestionDto,
  isValidQuestionType,
  isValidDifficulty,
} from "@/lib/question-mapper";
import type { MatchPair, QuestionDifficulty } from "@/types";

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
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

/** Normalize + validate the question payload for both POST and PATCH. */
function buildQuestionData(body: any, existing?: any) {
  const type = body.type ?? existing?.type ?? "MCQ";
  if (!isValidQuestionType(type)) {
    return { error: `type must be one of MCQ|TRUE_FALSE|FILL_BLANK|MATCHING|CODING (got "${type}")` };
  }

  const questionText =
    typeof body.question === "string" && body.question.trim()
      ? body.question.trim()
      : existing?.question;

  if (questionText === undefined || !questionText) {
    return { error: "question is required" };
  }

  // ----- Resolve options -----
  let options: string[] | null = null;
  if (Array.isArray(body.options)) {
    options = body.options
      .filter((o: unknown) => typeof o === "string" && o.trim())
      .map((o: string) => o.trim());
  } else if (existing?.options) {
    options = parseJsonArray<string>(existing.options);
  }

  // ----- Resolve correctAnswer -----
  let correctAnswer: number | null = null;
  if (body.correctAnswer !== undefined && body.correctAnswer !== null) {
    const n = Number(body.correctAnswer);
    if (Number.isInteger(n) && n >= 0) correctAnswer = n;
    else return { error: "correctAnswer must be a non-negative integer index" };
  } else if (existing !== undefined) {
    correctAnswer = existing.correctAnswer;
  }

  // ----- Resolve correctText -----
  let correctText: string | null = null;
  if (typeof body.correctText === "string") {
    correctText = body.correctText.trim() ? body.correctText.trim() : null;
  } else if (body.correctText === null) {
    correctText = null;
  } else if (existing !== undefined) {
    correctText = existing.correctText;
  }

  // ----- Resolve matchPairs -----
  let matchPairs: MatchPair[] | null = null;
  if (Array.isArray(body.matchPairs)) {
    if (!body.matchPairs.every((p: any) => p && typeof p.left === "string" && typeof p.right === "string")) {
      return { error: "matchPairs items must be { left: string, right: string }" };
    }
    matchPairs = body.matchPairs.map((p: any) => ({ left: p.left, right: p.right }));
  } else if (body.matchPairs === null) {
    matchPairs = null;
  } else if (existing !== undefined && existing.matchPairs) {
    try {
      const parsed = JSON.parse(existing.matchPairs);
      matchPairs = Array.isArray(parsed) ? (parsed as MatchPair[]) : null;
    } catch {
      matchPairs = null;
    }
  }

  // ----- Resolve codeLanguage -----
  let codeLanguage: string | null = null;
  if (typeof body.codeLanguage === "string") {
    codeLanguage = body.codeLanguage.trim() ? body.codeLanguage.trim() : null;
  } else if (body.codeLanguage === null) {
    codeLanguage = null;
  } else if (existing !== undefined) {
    codeLanguage = existing.codeLanguage;
  }

  // ----- Per-type validation -----
  switch (type) {
    case "MCQ": {
      if (!options || options.length < 2) {
        return { error: "MCQ requires options (min 2)" };
      }
      if (correctAnswer === null || correctAnswer >= options.length) {
        return { error: "correctAnswer must be a valid index into options" };
      }
      break;
    }
    case "TRUE_FALSE": {
      // Auto-generate True/False options if not provided.
      if (!options || options.length === 0) {
        options = ["True", "False"];
      } else if (options.length !== 2) {
        // If admin passed something, insist on 2.
        return { error: "TRUE_FALSE must have exactly 2 options (or none — auto-generated)" };
      }
      if (correctAnswer === null || (correctAnswer !== 0 && correctAnswer !== 1)) {
        return { error: "TRUE_FALSE correctAnswer must be 0 (True) or 1 (False)" };
      }
      break;
    }
    case "FILL_BLANK": {
      if (!correctText || !correctText.trim()) {
        return { error: "FILL_BLANK requires correctText" };
      }
      options = []; // no options for fill-blank
      break;
    }
    case "MATCHING": {
      if (!matchPairs || matchPairs.length < 2) {
        return { error: "MATCHING requires matchPairs (min 2 pairs)" };
      }
      options = [];
      break;
    }
    case "CODING": {
      if (!correctText || !correctText.trim()) {
        return { error: "CODING requires correctText (reference solution)" };
      }
      if (!codeLanguage) {
        return { error: "CODING requires codeLanguage" };
      }
      options = [];
      break;
    }
  }

  // ----- Resolve marks / negativeMarks / category / explanation -----
  const marks =
    typeof body.marks === "number" && body.marks > 0
      ? Math.floor(body.marks)
      : existing !== undefined
      ? existing.marks
      : 1;
  const negativeMarks =
    typeof body.negativeMarks === "number" && body.negativeMarks >= 0
      ? Math.floor(body.negativeMarks)
      : existing !== undefined
      ? existing.negativeMarks ?? 0
      : 0;
  const category =
    typeof body.category === "string"
      ? body.category.trim() || null
      : body.category === null
      ? null
      : existing?.category ?? null;
  const explanation =
    typeof body.explanation === "string"
      ? body.explanation.trim() || null
      : body.explanation === null
      ? null
      : existing?.explanation ?? null;

  // ----- Resolve imageUrl (base64 data URL, optional) -----
  let imageUrl: string | null = null;
  if (typeof body.imageUrl === "string") {
    // Accept only data URLs (base64) — no external URLs to keep storage local.
    imageUrl = body.imageUrl.startsWith("data:image/")
      ? body.imageUrl
      : body.imageUrl.trim() || null;
  } else if (body.imageUrl === null) {
    imageUrl = null;
  } else if (existing !== undefined) {
    imageUrl = existing.imageUrl ?? null;
  }

  // ----- Resolve difficulty (EASY | MEDIUM | HARD) -----
  let difficulty: QuestionDifficulty = "MEDIUM";
  if (isValidDifficulty(body.difficulty)) {
    difficulty = body.difficulty;
  } else if (existing !== undefined && existing.difficulty) {
    difficulty = existing.difficulty;
  }

  // ----- Resolve tags (JSON-encoded string[]) -----
  let tags: string[] | null = null;
  if (Array.isArray(body.tags)) {
    tags = body.tags
      .filter((t: unknown) => typeof t === "string" && t.trim())
      .map((t: string) => t.trim())
      .slice(0, 50); // sanity cap
  } else if (body.tags === null) {
    tags = null;
  } else if (existing !== undefined && existing.tags) {
    tags = parseJsonArray<string>(existing.tags);
  }

  return {
    data: {
      type,
      question: questionText,
      options: JSON.stringify(options ?? []),
      correctAnswer: correctAnswer ?? 0,
      correctText,
      matchPairs: matchPairs ? stringifyJson(matchPairs) : null,
      codeLanguage,
      marks,
      negativeMarks,
      category,
      explanation,
      imageUrl,
      difficulty,
      tags: tags ? JSON.stringify(tags) : null,
    },
  };
}

/** POST /api/questions — create a question (admin only). */
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { eventId } = body || {};

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const result = buildQuestionData(body);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
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
        ...result.data,
        order: nextOrder,
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
