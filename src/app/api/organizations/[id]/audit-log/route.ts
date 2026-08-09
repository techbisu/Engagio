import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveOrgMembership } from "@/lib/org-api";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/organizations/[id]/audit-log
 *
 * Returns the last 100 audit log entries for the org, ordered by createdAt desc.
 * Includes the acting user's name + email. ADMIN+ only.
 *
 * NOTE: AuditLog doesn't define a `user` relation — fetch users separately.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const result = await resolveOrgMembership(id, "ADMIN");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const logs = await db.auditLog.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Fetch user info for all logs (no relation on AuditLog).
    const userIds = Array.from(
      new Set(logs.map((l) => l.userId).filter((u): u is string => !!u))
    );
    const users = userIds.length
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      logs: logs.map((l) => {
        const user = l.userId ? userById.get(l.userId) : undefined;
        return {
          id: l.id,
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          metadata: l.metadata,
          createdAt: l.createdAt.toISOString(),
          user: user
            ? { name: user.name, email: user.email }
            : null,
        };
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
