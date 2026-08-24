import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/registrations/check?eventId=xxx
 * Check whether the current user is registered for the given event.
 *
 * Returns:
 *   - 401 if not authenticated.
 *   - 400 if `eventId` query param is missing.
 *   - 404 if the event does not exist.
 *   - 200 with `{ registered: false }` if not registered.
 *   - 200 with `{ registered: true, registration: { id, createdAt, data } }`
 *     if registered. `data` is parsed from JSON so the form can pre-fill on
 *     re-edit.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json(
        { error: "eventId query parameter is required" },
        { status: 400 }
      );
    }

    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const registration = await db.registration.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true, createdAt: true, data: true },
    });

    if (!registration) {
      return NextResponse.json({ registered: false });
    }

    let parsed: Record<string, string | number | boolean> = {};
    try {
      const p = JSON.parse(registration.data);
      if (p && typeof p === "object" && !Array.isArray(p)) {
        parsed = p as Record<string, string | number | boolean>;
      }
    } catch {
      parsed = {};
    }

    return NextResponse.json({
      registered: true,
      registration: {
        id: registration.id,
        createdAt: registration.createdAt.toISOString(),
        data: parsed,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
