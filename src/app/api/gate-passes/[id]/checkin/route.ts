import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/gate-passes/[id]/checkin — check in (or check out) a gate pass */
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

    const pass = await db.gatePass.findUnique({ where: { id } });
    if (!pass) {
      return NextResponse.json({ error: "Gate pass not found" }, { status: 404 });
    }

    if (pass.status === "REVOKED") {
      return NextResponse.json({ error: "This gate pass has been revoked" }, { status: 400 });
    }

    // Toggle check-in
    if (pass.checkedInAt && !pass.checkedOutAt) {
      // Already checked in → check out
      const updated = await db.gatePass.update({
        where: { id },
        data: {
          checkedOutAt: new Date(),
          status: "CHECKED_OUT",
        },
      });
      return NextResponse.json({ gatePass: updated, action: "checked_out" });
    } else {
      // Check in
      const updated = await db.gatePass.update({
        where: { id },
        data: {
          checkedInAt: new Date(),
          checkedInBy: session.user.id,
          checkedOutAt: null,
          status: "CHECKED_IN",
        },
      });
      return NextResponse.json({ gatePass: updated, action: "checked_in" });
    }
  } catch (e) {
    console.error("[POST /api/gate-passes/[id]/checkin] error:", e);
    return NextResponse.json({ error: "Internal Server Error", detail: String(e) }, { status: 500 });
  }
}
