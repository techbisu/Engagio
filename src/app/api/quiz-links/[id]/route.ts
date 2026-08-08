import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import type { QuizLinkDto } from "@/types";

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

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
      showResults,
      passThreshold,
      requireFullscreen,
      expiresAt,
    } = body || {};

    const data: Record<string, unknown> = {};
    if (typeof isActive === "boolean") data.isActive = isActive;
    if (typeof shuffleQuestions === "boolean") data.shuffleQuestions = shuffleQuestions;
    if (typeof shuffleOptions === "boolean") data.shuffleOptions = shuffleOptions;
    if (typeof showResults === "boolean") data.showResults = showResults;
    if (typeof requireFullscreen === "boolean") data.requireFullscreen = requireFullscreen;
    if (typeof timeLimit === "number" && timeLimit >= 0) {
      data.timeLimit = Math.floor(timeLimit);
    }
    if (typeof maxAttempts === "number" && maxAttempts >= 0) {
      data.maxAttempts = Math.floor(maxAttempts);
    }
    if (typeof passThreshold === "number" && passThreshold >= 0 && passThreshold <= 100) {
      data.passThreshold = Math.floor(passThreshold);
    }
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
