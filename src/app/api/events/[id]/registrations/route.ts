import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import type { RegistrationDto } from "@/types";

/** Map a Prisma Registration row (with `user` relation) to RegistrationDto. */
function toRegistrationDto(r: any): RegistrationDto {
  let data: Record<string, string | number | boolean> = {};
  try {
    const parsed = JSON.parse(r.data);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, string | number | boolean>;
    }
  } catch {
    data = {};
  }
  return {
    id: r.id,
    eventId: r.eventId,
    userId: r.userId,
    data,
    createdAt: r.createdAt.toISOString(),
    user: r.user
      ? {
          name: r.user.name ?? null,
          email: r.user.email,
          image: r.user.image ?? null,
        }
      : undefined,
  };
}

/** Escape a single CSV cell value (RFC 4180 style). */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "boolean") s = v ? "true" : "false";
  else if (typeof v === "number") s = String(v);
  else s = String(v);
  // Quote when value contains comma, double-quote, CR or LF.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/events/[id]/registrations
 * Admin only. List all registrations for an event (newest first, limit 500).
 *
 * Query params:
 *   - `format=csv` → returns a CSV file (text/csv) with columns:
 *     `name, email, <field labels in order>, registered_at`.
 *     Otherwise → JSON `RegistrationDto[]`.
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
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

    // Fetch fields ordered (used for both CSV columns and value lookups).
    const fields = await db.eventField.findMany({
      where: { eventId: id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, label: true },
    });

    const registrations = await db.registration.findMany({
      where: { eventId: id },
      include: {
        user: {
          select: { name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const url = new URL(req.url);
    const format = url.searchParams.get("format");

    if (format === "csv") {
      const header = [
        "name",
        "email",
        ...fields.map((f) => f.label),
        "registered_at",
      ];
      const lines: string[] = [header.map(csvCell).join(",")];

      for (const r of registrations) {
        let parsed: Record<string, string | number | boolean> = {};
        try {
          const p = JSON.parse(r.data);
          if (p && typeof p === "object" && !Array.isArray(p)) {
            parsed = p as Record<string, string | number | boolean>;
          }
        } catch {
          parsed = {};
        }

        const row = [
          r.user?.name ?? "",
          r.user?.email ?? "",
          ...fields.map((f) => {
            const v = parsed[f.id];
            return v === undefined ? "" : v;
          }),
          r.createdAt.toISOString(),
        ];
        lines.push(row.map(csvCell).join(","));
      }

      const csv = lines.join("\n");
      const filename = `registrations-${id}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json(registrations.map(toRegistrationDto));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
