import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { parseJsonArray, stringifyJson } from "@/lib/utils";
import type { EventFieldDto, EventFieldType } from "@/types";

const VALID_FIELD_TYPES: EventFieldType[] = [
  "text",
  "email",
  "number",
  "tel",
  "textarea",
  "select",
  "checkbox",
  "date",
];

function isFieldType(v: unknown): v is EventFieldType {
  return typeof v === "string" && (VALID_FIELD_TYPES as string[]).includes(v);
}

/** Map a Prisma EventField row to EventFieldDto (options parsed to string[]). */
function toFieldDto(f: any): EventFieldDto {
  return {
    id: f.id,
    eventId: f.eventId,
    label: f.label,
    type: f.type as EventFieldType,
    required: f.required,
    placeholder: f.placeholder ?? null,
    helpText: f.helpText ?? null,
    options: parseJsonArray<string>(f.options),
    order: f.order,
    createdAt: f.createdAt.toISOString(),
  };
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/events/[id]/fields
 * List all registration fields for an event (any authenticated user).
 * Ordered by `order` asc, then `createdAt` asc.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const event = await db.event.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const fields = await db.eventField.findMany({
      where: { eventId: id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(fields.map(toFieldDto));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[id]/fields
 * Create a new registration field (admin only).
 * Body: { label, type, required?, placeholder?, helpText?, options? }
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const event = await db.event.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { label, type, required, placeholder, helpText, options } = body as any;

    if (typeof label !== "string" || !label.trim()) {
      return NextResponse.json(
        { error: "label is required (non-empty string)" },
        { status: 400 }
      );
    }
    if (!isFieldType(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_FIELD_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    let optionsJson: string | null = null;
    if (type === "select") {
      if (
        !Array.isArray(options) ||
        options.length < 2 ||
        !options.every(
          (o: unknown) => typeof o === "string" && o.trim().length > 0
        )
      ) {
        return NextResponse.json(
          {
            error:
              "select fields require options (array of strings, min 2 non-empty)",
          },
          { status: 400 }
        );
      }
      optionsJson = stringifyJson(options.map((o: string) => o.trim()));
    }

    // Set order to current max + 1 (or 0 if none exist).
    const agg = await db.eventField.aggregate({
      where: { eventId: id },
      _max: { order: true },
    });
    const nextOrder = (agg._max.order ?? -1) + 1;

    const field = await db.eventField.create({
      data: {
        eventId: id,
        label: label.trim(),
        type,
        required: typeof required === "boolean" ? required : true,
        placeholder:
          typeof placeholder === "string" && placeholder.trim()
            ? placeholder.trim()
            : null,
        helpText:
          typeof helpText === "string" && helpText.trim()
            ? helpText.trim()
            : null,
        options: optionsJson,
        order: nextOrder,
      },
    });
    return NextResponse.json(toFieldDto(field), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
