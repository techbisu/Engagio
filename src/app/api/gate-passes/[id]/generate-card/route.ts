import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderGatePassCard } from "@/lib/gate-pass-renderer";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/gate-passes/[id]/generate-card — generate the ID card PNG */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const pass = await db.gatePass.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true, title: true, slug: true,
            startDate: true, endDate: true,
            image: true,
            organization: { select: { name: true, logoUrl: true, primaryColor: true } },
          },
        },
      },
    });

    if (!pass) {
      return NextResponse.json({ error: "Gate pass not found" }, { status: 404 });
    }

    // Generate the card PNG
    const { png } = await renderGatePassCard({
      passNumber: pass.passNumber,
      participantName: pass.participantName,
      participantEmail: pass.participantEmail,
      eventTitle: pass.event.title,
      eventStartDate: pass.event.startDate.toISOString(),
      eventEndDate: pass.event.endDate.toISOString(),
      eventImage: pass.event.image,
      orgName: pass.event.organization?.name || "",
      orgLogoUrl: pass.event.organization?.logoUrl || null,
      orgPrimaryColor: pass.event.organization?.primaryColor || "#10b981",
      verifyToken: pass.verifyToken,
      shareUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/gate/${pass.verifyToken}`,
    });

    // Update the gate pass with the card image
    const updated = await db.gatePass.update({
      where: { id },
      data: {
        cardImageUrl: `data:image/png;base64,${png.toString("base64")}`,
      },
    });

    return NextResponse.json({ gatePass: updated });
  } catch (e) {
    console.error("[POST /api/gate-passes/[id]/generate-card] error:", e);
    return NextResponse.json({ error: "Internal Server Error", detail: String(e) }, { status: 500 });
  }
}
