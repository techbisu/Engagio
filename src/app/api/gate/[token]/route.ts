import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ token: string }> };

/** GET /api/gate/[token] — public gate pass verification (no auth) */
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;
    const pass = await db.gatePass.findUnique({
      where: { verifyToken: token },
      include: {
        event: {
          select: {
            id: true, title: true, slug: true,
            startDate: true, endDate: true,
            image: true,
            organization: { select: { name: true, logoUrl: true } },
          },
        },
      },
    });

    if (!pass) {
      return NextResponse.json({ error: "Gate pass not found" }, { status: 404 });
    }

    if (pass.status === "REVOKED") {
      return NextResponse.json({
        valid: false,
        revoked: true,
        revokedAt: pass.revokedAt?.toISOString(),
        reason: pass.revocationReason,
        passNumber: pass.passNumber,
        participantName: pass.participantName,
        eventTitle: pass.event.title,
      });
    }

    return NextResponse.json({
      valid: true,
      passNumber: pass.passNumber,
      participantName: pass.participantName,
      participantEmail: pass.participantEmail,
      eventTitle: pass.event.title,
      eventStartDate: pass.event.startDate.toISOString(),
      eventEndDate: pass.event.endDate.toISOString(),
      orgName: pass.event.organization?.name || "",
      status: pass.status,
      checkedIn: !!pass.checkedInAt,
      checkedInAt: pass.checkedInAt?.toISOString(),
      checkedOutAt: pass.checkedOutAt?.toISOString(),
      cardImageUrl: pass.cardImageUrl,
    });
  } catch (e) {
    console.error("[GET /api/gate/[token]] error:", e);
    return NextResponse.json({ error: "Internal Server Error", detail: String(e) }, { status: 500 });
  }
}
