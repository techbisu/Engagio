import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { QuizLinkDto } from "@/types";

type RouteContext = { params: Promise<{ slug: string }> };

function toQuizLinkDto(link: any): QuizLinkDto {
  return {
    id: link.id,
    eventId: link.eventId,
    slug: link.slug,
    isActive: link.isActive,
    shuffleQuestions: link.shuffleQuestions,
    shuffleOptions: link.shuffleOptions,
    timeLimit: link.timeLimit,
    maxAttempts: link.maxAttempts,
    showResults: link.showResults,
    passThreshold: link.passThreshold,
    requireFullscreen: link.requireFullscreen,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
    event: link.event
      ? {
          id: link.event.id,
          title: link.event.title,
          description: link.event.description,
          image: link.event.image ?? null,
        }
      : undefined,
  };
}

/**
 * GET /api/quiz-links/by-slug/[slug]
 *
 * Public route — anyone with the link (including unauthenticated users)
 * can read this metadata so the landing page can show event info before login.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { slug } = await ctx.params;
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const link = await db.quizLink.findUnique({
      where: { slug },
      include: { event: { select: { id: true, title: true, description: true, image: true } } },
    });

    if (!link) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }
    if (!link.isActive) {
      return NextResponse.json({ error: "This quiz is no longer active." }, { status: 404 });
    }
    const hasExpired = !!link.expiresAt && link.expiresAt.getTime() < Date.now();
    if (hasExpired) {
      return NextResponse.json({ error: "This quiz link has expired." }, { status: 404 });
    }

    const questionCount = await db.question.count({ where: { eventId: link.eventId } });

    return NextResponse.json({
      quizLink: toQuizLinkDto(link),
      event: link.event
        ? {
            id: link.event.id,
            title: link.event.title,
            description: link.event.description,
            image: link.event.image ?? null,
          }
        : null,
      questionCount,
      timeLimit: link.timeLimit,
      passThreshold: link.passThreshold,
      maxAttempts: link.maxAttempts,
      requireFullscreen: link.requireFullscreen,
      isActive: link.isActive,
      hasExpired,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
