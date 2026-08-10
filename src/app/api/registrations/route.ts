import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { stringifyJson } from "@/lib/utils";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/registrations — submit (or update) a registration for an event.
 * Authenticated only. Body: { eventId, data: { [fieldId]: value } }
 *
 * Validation:
 *  - Event must exist and have `requireRegistration === true` AND at least one field.
 *  - For every `required: true` field, the corresponding value must be present
 *    and non-empty (for checkbox → must be `true`; for others → non-empty
 *    string or valid number).
 *  - For `email` type fields, the value must match a basic email regex.
 *  - For `number` type fields, the value must parse to a valid number.
 *
 * Uses upsert on (eventId, userId) — re-submissions edit existing data.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { eventId, data } = body as any;
    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 }
      );
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return NextResponse.json({ error: "data must be an object" }, { status: 400 });
    }

    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true, requireRegistration: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (!event.requireRegistration) {
      return NextResponse.json(
        { error: "This event does not require registration" },
        { status: 400 }
      );
    }

    const fields = await db.eventField.findMany({
      where: { eventId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    if (fields.length === 0) {
      return NextResponse.json(
        { error: "This event does not require registration" },
        { status: 400 }
      );
    }

    // --- Step 1: Required-field presence check -------------------------------
    const missing: string[] = [];
    for (const f of fields) {
      if (!f.required) continue;
      const v = data[f.id];
      if (f.type === "checkbox") {
        if (v !== true) missing.push(f.id);
        continue;
      }
      let nonEmpty = false;
      if (typeof v === "number") {
        nonEmpty = !isNaN(v);
      } else if (typeof v === "string") {
        nonEmpty = v.trim().length > 0;
      } else if (typeof v === "boolean") {
        nonEmpty = v;
      }
      if (!nonEmpty) missing.push(f.id);
    }
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Missing required fields", missing },
        { status: 400 }
      );
    }

    // --- Step 2: Email format validation -------------------------------------
    for (const f of fields) {
      if (f.type !== "email") continue;
      const v = data[f.id];
      if (v === undefined || v === null || v === "") continue;
      if (typeof v !== "string" || !EMAIL_REGEX.test(v.trim())) {
        return NextResponse.json(
          { error: `Invalid email format for field "${f.label}"` },
          { status: 400 }
        );
      }
    }

    // --- Step 3: Normalize + validate values --------------------------------
    // (number coercion happens here; checked after required check so the
    // "missing required" error is returned first.)
    const cleanData: Record<string, string | number | boolean> = {};
    for (const f of fields) {
      const raw = data[f.id];

      if (f.type === "checkbox") {
        cleanData[f.id] = raw === true || raw === "true";
        continue;
      }

      if (f.type === "number") {
        if (raw === undefined || raw === null || raw === "") {
          cleanData[f.id] = "";
          continue;
        }
        const n = typeof raw === "number" ? raw : Number(raw);
        if (isNaN(n) || !isFinite(n)) {
          return NextResponse.json(
            { error: `Invalid number for field "${f.label}"` },
            { status: 400 }
          );
        }
        cleanData[f.id] = n;
        continue;
      }

      if (f.type === "email") {
        const s =
          typeof raw === "string"
            ? raw.trim()
            : raw === undefined || raw === null
            ? ""
            : String(raw);
        cleanData[f.id] = s;
        continue;
      }

      // text / tel / textarea / select / date → store as string.
      cleanData[f.id] =
        raw === undefined || raw === null
          ? ""
          : typeof raw === "string"
          ? raw
          : String(raw);
    }

    // --- Step 4: Upsert ------------------------------------------------------
    const registration = await db.registration.upsert({
      where: { eventId_userId: { eventId, userId } },
      update: { data: stringifyJson(cleanData) },
      create: {
        eventId,
        userId,
        data: stringifyJson(cleanData),
      },
      select: {
        id: true,
        eventId: true,
        userId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      id: registration.id,
      eventId: registration.eventId,
      userId: registration.userId,
      createdAt: registration.createdAt.toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
