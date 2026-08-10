import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { toQuizLinkDto } from "@/app/api/quiz-links/route";

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/quiz-links/[id] — fetch a quiz link with its event (admin only). */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const link = await db.quizLink.findUnique({
      where: { id },
      include: { event: { select: { id: true, title: true, description: true, image: true } } },
    });
    if (!link) {
      return NextResponse.json({ error: "Quiz link not found" }, { status: 404 });
    }
    return NextResponse.json(toQuizLinkDto(link));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** PATCH /api/quiz-links/[id] — update a quiz link (admin only). */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const existing = await db.quizLink.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Quiz link not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      isActive,
      shuffleQuestions,
      shuffleOptions,
      timeLimit,
      maxAttempts,
      questionCount,
      showResults,
      publishResults,
      emailOnPublish,
      leaderboardEnabled,
      passThreshold,
      requireFullscreen,
      autoSubmitOnExit,
      tabSwitchDetection,
      copyPasteBlocking,
      rightClickDisable,
      keyboardShortcutBlocking,
      devtoolsDetection,
      antiScreenshot,
      watermarkOverlay,
      aiProctor,
      aiProctorFaceDetection,
      aiProctorMultiFace,
      aiProctorLookAway,
      expiresAt,
    } = body || {};

    const data: Record<string, unknown> = {};

    // Boolean toggles — only set when present and a boolean.
    const boolToggles: Record<string, unknown> = {
      isActive,
      shuffleQuestions,
      shuffleOptions,
      showResults,
      publishResults,
      emailOnPublish,
      leaderboardEnabled,
      requireFullscreen,
      autoSubmitOnExit,
      tabSwitchDetection,
      copyPasteBlocking,
      rightClickDisable,
      keyboardShortcutBlocking,
      devtoolsDetection,
      antiScreenshot,
      watermarkOverlay,
      aiProctor,
      aiProctorFaceDetection,
      aiProctorMultiFace,
      aiProctorLookAway,
    };
    for (const [key, val] of Object.entries(boolToggles)) {
      if (typeof val === "boolean") data[key] = val;
    }

    // Numeric fields
    if (typeof timeLimit === "number" && timeLimit >= 0) {
      data.timeLimit = Math.floor(timeLimit);
    }
    if (typeof maxAttempts === "number" && maxAttempts >= 0) {
      data.maxAttempts = Math.floor(maxAttempts);
    }
    if (
      typeof questionCount === "number" &&
      Number.isInteger(questionCount) &&
      questionCount >= 0
    ) {
      data.questionCount = questionCount;
    }
    if (typeof passThreshold === "number" && passThreshold >= 0 && passThreshold <= 100) {
      data.passThreshold = Math.floor(passThreshold);
    }

    // expiresAt: null clears it; otherwise validate the Date.
    if (expiresAt !== undefined) {
      if (expiresAt === null || expiresAt === "") {
        data.expiresAt = null;
      } else {
        const parsed = new Date(expiresAt);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
        }
        data.expiresAt = parsed;
      }
    }

    const updated = await db.quizLink.update({
      where: { id },
      data,
      include: { event: { select: { id: true, title: true, description: true, image: true } } },
    });
    return NextResponse.json(toQuizLinkDto(updated));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** DELETE /api/quiz-links/[id] — delete a quiz link (admin only). */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const existing = await db.quizLink.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Quiz link not found" }, { status: 404 });
    }
    await db.quizLink.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
