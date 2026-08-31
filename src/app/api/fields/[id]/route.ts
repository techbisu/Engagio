import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { requirePermission, ownsResource } from "@/lib/tenant";
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
 * PATCH /api/fields/[id] — update a registration field (admin only).
 * Body: any subset of { label, type, required, placeholder, helpText, options }.
 * For non-select types, `options` is cleared (ignored).
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const auth = await requirePermission(req, "registration.manage");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const orgCtx = auth.ctx;
    const { id } = await ctx.params;
    const existing = await db.eventField.findUnique({
      where: { id },
      include: { event: { select: { organizationId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }
    if (!ownsResource(existing.event, orgCtx)) {
      return NextResponse.json(
        { error: "Field not found" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { label, type, required, placeholder, helpText, options } = body as any;

    const data: Record<string, unknown> = {};

    // label
    if (label !== undefined) {
      if (typeof label !== "string" || !label.trim()) {
        return NextResponse.json(
          { error: "label must be a non-empty string" },
          { status: 400 }
        );
      }
      data.label = label.trim();
    }

    // type
    if (type !== undefined) {
      if (!isFieldType(type)) {
        return NextResponse.json(
          { error: `type must be one of: ${VALID_FIELD_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      data.type = type;
    }

    // required
    if (required !== undefined) {
      if (typeof required !== "boolean") {
        return NextResponse.json(
          { error: "required must be a boolean" },
          { status: 400 }
        );
      }
      data.required = required;
    }

    // placeholder
    if (placeholder !== undefined) {
      if (placeholder === null) {
        data.placeholder = null;
      } else if (typeof placeholder === "string") {
        data.placeholder = placeholder.trim() || null;
      } else {
        return NextResponse.json(
          { error: "placeholder must be a string or null" },
          { status: 400 }
        );
      }
    }

    // helpText
    if (helpText !== undefined) {
      if (helpText === null) {
        data.helpText = null;
      } else if (typeof helpText === "string") {
        data.helpText = helpText.trim() || null;
      } else {
        return NextResponse.json(
          { error: "helpText must be a string or null" },
          { status: 400 }
        );
      }
    }

    // options — only meaningful for select type.
    const effectiveType =
      typeof type === "string" ? type : existing.type;

    if (options !== undefined) {
      if (effectiveType === "select") {
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
        data.options = stringifyJson(options.map((o: string) => o.trim()));
      } else {
        // Non-select types: clear options.
        data.options = null;
      }
    } else if (
      type !== undefined &&
      type !== "select" &&
      existing.type === "select"
    ) {
      // Switching from select to another type: clear leftover options.
      data.options = null;
    }

    const updated = await db.eventField.update({ where: { id }, data });
    return NextResponse.json(toFieldDto(updated));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fields/[id] — delete a registration field (admin only).
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const auth = await requirePermission(req, "registration.manage");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const orgCtx = auth.ctx;
    const { id } = await ctx.params;
    const existing = await db.eventField.findUnique({
      where: { id },
      include: { event: { select: { organizationId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }
    if (!ownsResource(existing.event, orgCtx)) {
      return NextResponse.json(
        { error: "Field not found" },
        { status: 404 }
      );
    }
    await db.eventField.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
