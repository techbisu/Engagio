import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, ownsResource } from "@/lib/tenant";
import { toQuizLinkDto } from "@/app/api/quiz-links/route";

type RouteContext = { params: Promise<{ id: string }> };

/** Load a quiz link with its event's org id, for ownership checks. */
async function findLinkWithOrg(id: string) {
  return db.quizLink.findUnique({
    where: { id },
    include: {
      event: {
        select: { id: true, title: true, description: true, image: true, organizationId: true },
      },
    },
  });
}

/** GET /api/quiz-links/[id] — fetch a quiz link with its event (org-scoped admin). */
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "assessment.manage");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await ctx.params;
    const link = await findLinkWithOrg(id);
    if (!link || !ownsResource(link.event, auth.ctx)) {
      return NextResponse.json({ error: "Quiz link not found" }, { status: 404 });
    }
    return NextResponse.json(toQuizLinkDto(link));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/** PATCH /api/quiz-links/[id] — update a quiz link (org-scoped admin). */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "assessment.manage");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await ctx.params;
    const existing = await findLinkWithOrg(id);
    if (!existing || !ownsResource(existing.event, auth.ctx)) {
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
      showScore,
      showCategory,
      showAntiCheat,
      showReviewAnswers,
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
      showScore,
      showCategory,
      showAntiCheat,
      showReviewAnswers,
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
      include: { event: { select: { id: true, title: true, slug: true, description: true, image: true, organization: { select: { slug: true } } } } },
    });
    return NextResponse.json(toQuizLinkDto(updated));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/quiz-links/[id] — delete a quiz link (org-scoped admin). */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "assessment.manage");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await ctx.params;
    const existing = await findLinkWithOrg(id);
    if (!existing || !ownsResource(existing.event, auth.ctx)) {
      return NextResponse.json({ error: "Quiz link not found" }, { status: 404 });
    }
    await db.quizLink.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
