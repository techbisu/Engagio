import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/gate-passes/[id]/revoke — revoke a gate pass */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const ctxData = await requireTenantContext(req);
    if ("error" in ctxData) {
      return NextResponse.json({ error: ctxData.error }, { status: ctxData.status });
    }

    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    const pass = await db.gatePass.findUnique({ where: { id } });
    if (!pass) {
      return NextResponse.json({ error: "Gate pass not found" }, { status: 404 });
    }

    const updated = await db.gatePass.update({
      where: { id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedBy: session.user.id,
        revocationReason: reason || null,
      },
    });

    return NextResponse.json({ gatePass: updated });
  } catch (e) {
    console.error("[POST /api/gate-passes/[id]/revoke] error:", e);
    return NextResponse.json({ error: "Internal Server Error", detail: String(e) }, { status: 500 });
  }
}
