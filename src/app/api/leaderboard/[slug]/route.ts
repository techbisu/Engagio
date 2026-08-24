import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * GET /api/leaderboard/[slug]
 *
 * Public-ish leaderboard for a quiz link. Returns the top 20 completed
 * attempts ranked by score (desc) then timeTaken (asc).
 *
 * Publishing behaviour:
 * - If `quizLink.publishResults === false` (instant results): always return
 *   the leaderboard.
 * - If `quizLink.publishResults === true`: only return the leaderboard when
 *   at least one attempt for this link has `publishedAt != null`. Otherwise
 *   return `{ leaderboard: [], published: false, totalAttempts: N }` so the
 *   client can show a "Results not yet published" state.
 *
 * For privacy, the response surfaces only name + image (no email).
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { slug } = await ctx.params;
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const quizLink = await db.quizLink.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        publishResults: true,
        event: { select: { id: true, title: true } },
      },
    });

    if (!quizLink) {
      return NextResponse.json({ error: "Quiz link not found" }, { status: 404 });
    }

    const totalAttempts = await db.quizAttempt.count({
      where: { quizLinkId: quizLink.id, status: "COMPLETED" },
    });

    const publishedCount = await db.quizAttempt.count({
      where: { quizLinkId: quizLink.id, status: "COMPLETED", publishedAt: { not: null } },
    });

    const isPublishedGate =
      !quizLink.publishResults || publishedCount > 0;

    if (!isPublishedGate) {
      return NextResponse.json({
        quizLink: { slug: quizLink.slug, event: quizLink.event },
        leaderboard: [],
        published: false,
        totalAttempts,
      });
    }

    // For instant-publish links, only COMPLETED attempts count.
    // For publish-on-demand links, only show attempts that have been published.
    const where = quizLink.publishResults
      ? { quizLinkId: quizLink.id, status: "COMPLETED" as const, publishedAt: { not: null } }
      : { quizLinkId: quizLink.id, status: "COMPLETED" as const };

    const attempts = await db.quizAttempt.findMany({
      where,
      orderBy: [{ score: "desc" }, { timeTaken: "asc" }],
      take: 20,
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    const leaderboard = attempts.map((a, idx) => ({
      rank: idx + 1,
      userId: a.user.id,
      name: a.user.name,
      image: a.user.image ?? null,
      score: a.score ?? 0,
      totalMarks: a.totalMarks ?? 0,
      percentage: a.percentage ?? 0,
      passed: a.passed ?? false,
      timeTaken: a.timeTaken ?? 0,
      completedAt: a.completedAt ? a.completedAt.toISOString() : null,
    }));

    return NextResponse.json({
      quizLink: { slug: quizLink.slug, event: quizLink.event },
      leaderboard,
      published: true,
      totalAttempts,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
