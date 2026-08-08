import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { generateQuizSlug } from "@/lib/utils";
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

/** GET /api/quiz-links — list all quiz links (admin only). */
export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const links = await db.quizLink.findMany({
      include: { event: { select: { id: true, title: true, description: true, image: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(links.map(toQuizLinkDto));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** POST /api/quiz-links — create a quiz link (admin only). */
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const {
      eventId,
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

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Generate a unique slug, retrying on collision up to 5 times.
    let slug = "";
    let attempt = 0;
    while (attempt < 5) {
      const candidate = generateQuizSlug(6);
      const clash = await db.quizLink.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!clash) {
        slug = candidate;
        break;
      }
      attempt++;
    }
    if (!slug) {
      return NextResponse.json(
        { error: "Failed to generate a unique slug. Please try again." },
        { status: 500 }
      );
    }

    // Optional expiresAt validation.
    let expiresAtDate: Date | null = null;
    if (expiresAt !== undefined && expiresAt !== null && expiresAt !== "") {
      expiresAtDate = new Date(expiresAt);
      if (isNaN(expiresAtDate.getTime())) {
        return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
      }
    }

    const created = await db.quizLink.create({
      data: {
        eventId,
        slug,
        isActive: typeof isActive === "boolean" ? isActive : true,
        shuffleQuestions: typeof shuffleQuestions === "boolean" ? shuffleQuestions : true,
        shuffleOptions: typeof shuffleOptions === "boolean" ? shuffleOptions : false,
        timeLimit:
          typeof timeLimit === "number" && timeLimit >= 0 ? Math.floor(timeLimit) : 30,
        maxAttempts:
          typeof maxAttempts === "number" && maxAttempts >= 0 ? Math.floor(maxAttempts) : 1,
        showResults: typeof showResults === "boolean" ? showResults : true,
        passThreshold:
          typeof passThreshold === "number" && passThreshold >= 0 && passThreshold <= 100
            ? Math.floor(passThreshold)
            : 40,
        requireFullscreen:
          typeof requireFullscreen === "boolean" ? requireFullscreen : true,
        expiresAt: expiresAtDate,
      },
      include: { event: { select: { id: true, title: true, description: true, image: true } } },
    });
    return NextResponse.json(toQuizLinkDto(created), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
