import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import type { EventDto } from "@/types";

/** Check the session for an admin role. Returns true if the caller is an admin. */
async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

/** Map a Prisma Event row (with _count) to EventDto. */
function toEventDto(e: any): EventDto {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    image: e.image ?? null,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate.toISOString(),
    isActive: e.isActive,
    requireRegistration: e.requireRegistration ?? false,
    createdAt: e.createdAt.toISOString(),
    questionCount: e._count?.questions ?? 0,
    linkCount: e._count?.quizLinks ?? 0,
    attemptCount: e._count?.attempts ?? 0,
    registrationCount: e._count?.registrations ?? 0,
    fieldCount: e._count?.fields ?? 0,
  };
}

/** GET /api/events — list all events (admin only). */
export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const events = await db.event.findMany({
      include: {
        _count: {
          select: {
            questions: true,
            attempts: true,
            quizLinks: true,
            registrations: true,
            fields: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const data = events.map(toEventDto);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** POST /api/events — create a new event (admin only). */
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { title, description, image, startDate, endDate, isActive, requireRegistration } = body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid startDate or endDate" },
        { status: 400 }
      );
    }
    if (end < start) {
      return NextResponse.json(
        { error: "endDate must be on or after startDate" },
        { status: 400 }
      );
    }

    const event = await db.event.create({
      data: {
        title: title.trim(),
        description: typeof description === "string" ? description : "",
        image: typeof image === "string" && image.trim() ? image.trim() : null,
        startDate: start,
        endDate: end,
        isActive: typeof isActive === "boolean" ? isActive : true,
        requireRegistration: typeof requireRegistration === "boolean" ? requireRegistration : false,
      },
      include: {
        _count: {
          select: {
            questions: true,
            attempts: true,
            quizLinks: true,
            registrations: true,
            fields: true,
          },
        },
      },
    });
    return NextResponse.json(toEventDto(event), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
