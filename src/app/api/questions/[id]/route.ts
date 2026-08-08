import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import {
  toQuestionDto,
  isValidQuestionType,
  isValidDifficulty,
} from "@/lib/question-mapper";
import { parseJsonArray, stringifyJson } from "@/lib/utils";
import type { MatchPair, QuestionDifficulty } from "@/types";

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
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

    // Determine the effective type (new one if provided, else existing).
    const type = body.type !== undefined ? body.type : existing.type;
    if (body.type !== undefined && !isValidQuestionType(type)) {
      return NextResponse.json(
        { error: `type must be one of MCQ|TRUE_FALSE|FILL_BLANK|MATCHING|CODING (got "${body.type}")` },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};

    // ---- Type ----
    if (body.type !== undefined) data.type = type;

    // ---- question text ----
    if (typeof body.question === "string" && body.question.trim()) {
      data.question = body.question.trim();
    }

    // ---- explanation ----
    if (typeof body.explanation === "string") {
      data.explanation = body.explanation.trim() || null;
    } else if (body.explanation === null) {
      data.explanation = null;
    }

    // ---- marks / negativeMarks ----
    if (typeof body.marks === "number" && body.marks > 0) {
      data.marks = Math.floor(body.marks);
    }
    if (typeof body.negativeMarks === "number" && body.negativeMarks >= 0) {
      data.negativeMarks = Math.floor(body.negativeMarks);
    }

    // ---- order ----
    if (typeof body.order === "number" && Number.isInteger(body.order)) {
      data.order = body.order;
    }

    // ---- category ----
    if (typeof body.category === "string") {
      data.category = body.category.trim() || null;
    } else if (body.category === null) {
      data.category = null;
    }

    // ---- codeLanguage ----
    if (typeof body.codeLanguage === "string") {
      data.codeLanguage = body.codeLanguage.trim() || null;
    } else if (body.codeLanguage === null) {
      data.codeLanguage = null;
    }

    // ---- correctText ----
    if (typeof body.correctText === "string") {
      data.correctText = body.correctText.trim() || null;
    } else if (body.correctText === null) {
      data.correctText = null;
    }

    // ---- matchPairs ----
    if (Array.isArray(body.matchPairs)) {
      if (
        !body.matchPairs.every(
          (p: any) => p && typeof p.left === "string" && typeof p.right === "string"
        )
      ) {
        return NextResponse.json(
          { error: "matchPairs items must be { left: string, right: string }" },
          { status: 400 }
        );
      }
      const pairs: MatchPair[] = body.matchPairs.map((p: any) => ({
        left: p.left,
        right: p.right,
      }));
      data.matchPairs = pairs.length > 0 ? stringifyJson(pairs) : null;
    } else if (body.matchPairs === null) {
      data.matchPairs = null;
    }

    // ---- imageUrl (base64 data URL, optional) ----
    if (typeof body.imageUrl === "string") {
      data.imageUrl = body.imageUrl.startsWith("data:image/")
        ? body.imageUrl
        : body.imageUrl.trim() || null;
    } else if (body.imageUrl === null) {
      data.imageUrl = null;
    }

    // ---- difficulty (EASY | MEDIUM | HARD) ----
    if (body.difficulty !== undefined) {
      if (body.difficulty === null) {
        data.difficulty = "MEDIUM";
      } else if (isValidDifficulty(body.difficulty)) {
        data.difficulty = body.difficulty as QuestionDifficulty;
      } else {
        return NextResponse.json(
          {
            error:
              "difficulty must be one of EASY|MEDIUM|HARD",
          },
          { status: 400 }
        );
      }
    }

    // ---- tags (JSON string[]) ----
    if (Array.isArray(body.tags)) {
      const tags: string[] = body.tags
        .filter((t: unknown) => typeof t === "string" && t.trim())
        .map((t: string) => t.trim())
        .slice(0, 50);
      data.tags = tags.length > 0 ? JSON.stringify(tags) : null;
    } else if (body.tags === null) {
      data.tags = null;
    }

    // ---- options + correctAnswer (validated jointly per-type) ----
    // Build the effective options for validation against correctAnswer.
    let effectiveOptions: string[] = parseJsonArray<string>(existing.options);
    if (Array.isArray(body.options)) {
      effectiveOptions = body.options
        .filter((o: unknown) => typeof o === "string" && o.trim())
        .map((o: string) => o.trim());
    }

    // Compute the effective correctAnswer (the new one if provided, else existing).
    const effectiveCorrectAnswer =
      body.correctAnswer !== undefined && body.correctAnswer !== null
        ? Number(body.correctAnswer)
        : existing.correctAnswer;

    // Per-type validation, applying auto-generation where appropriate.
    switch (type) {
      case "MCQ": {
        if (effectiveOptions.length < 2) {
          return NextResponse.json(
            { error: "MCQ requires options (min 2 non-empty)" },
            { status: 400 }
          );
        }
        if (
          !Number.isInteger(effectiveCorrectAnswer) ||
          effectiveCorrectAnswer < 0 ||
          effectiveCorrectAnswer >= effectiveOptions.length
        ) {
          return NextResponse.json(
            { error: "correctAnswer must be a valid index into options" },
            { status: 400 }
          );
        }
        if (Array.isArray(body.options)) data.options = JSON.stringify(effectiveOptions);
        if (body.correctAnswer !== undefined) data.correctAnswer = effectiveCorrectAnswer;
        // If switching to MCQ from another type, clear matchPairs/correctText/codeLanguage.
        if (existing.type !== "MCQ") {
          data.matchPairs = null;
          data.correctText = null;
          data.codeLanguage = null;
        }
        break;
      }
      case "TRUE_FALSE": {
        let opts = effectiveOptions;
        if (opts.length === 0) opts = ["True", "False"];
        if (opts.length !== 2) {
          return NextResponse.json(
            { error: "TRUE_FALSE must have exactly 2 options (or none — auto-generated)" },
            { status: 400 }
          );
        }
        if (effectiveCorrectAnswer !== 0 && effectiveCorrectAnswer !== 1) {
          return NextResponse.json(
            { error: "TRUE_FALSE correctAnswer must be 0 (True) or 1 (False)" },
            { status: 400 }
          );
        }
        // Always (re)store the canonical True/False options.
        data.options = JSON.stringify(opts);
        data.correctAnswer = effectiveCorrectAnswer;
        if (existing.type !== "TRUE_FALSE") {
          data.matchPairs = null;
          data.correctText = null;
          data.codeLanguage = null;
        }
        break;
      }
      case "FILL_BLANK": {
        const effectiveCorrectText =
          typeof body.correctText === "string"
            ? body.correctText.trim() || null
            : existing.correctText;
        if (!effectiveCorrectText) {
          return NextResponse.json(
            { error: "FILL_BLANK requires correctText" },
            { status: 400 }
          );
        }
        data.options = JSON.stringify([]);
        data.matchPairs = null;
        data.codeLanguage = null;
        // correctAnswer ignored for FILL_BLANK; reset to 0 for safety.
        data.correctAnswer = 0;
        break;
      }
      case "MATCHING": {
        let pairs: MatchPair[] = [];
        if (Array.isArray(body.matchPairs) && body.matchPairs.length > 0) {
          pairs = body.matchPairs.map((p: any) => ({ left: p.left, right: p.right }));
        } else if (existing.matchPairs) {
          try {
            const parsed = JSON.parse(existing.matchPairs);
            if (Array.isArray(parsed)) pairs = parsed as MatchPair[];
          } catch {
            /* ignore */
          }
        }
        if (pairs.length < 2) {
          return NextResponse.json(
            { error: "MATCHING requires matchPairs (min 2 pairs)" },
            { status: 400 }
          );
        }
        data.options = JSON.stringify([]);
        data.correctText = null;
        data.codeLanguage = null;
        data.correctAnswer = 0;
        break;
      }
      case "CODING": {
        const effectiveCorrectText =
          typeof body.correctText === "string"
            ? body.correctText.trim() || null
            : existing.correctText;
        const effectiveCodeLanguage =
          typeof body.codeLanguage === "string"
            ? body.codeLanguage.trim() || null
            : existing.codeLanguage;
        if (!effectiveCorrectText) {
          return NextResponse.json(
            { error: "CODING requires correctText (reference solution)" },
            { status: 400 }
          );
        }
        if (!effectiveCodeLanguage) {
          return NextResponse.json(
            { error: "CODING requires codeLanguage" },
            { status: 400 }
          );
        }
        data.options = JSON.stringify([]);
        data.matchPairs = null;
        data.correctAnswer = 0;
        break;
      }
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
