import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderGatePassCard } from "@/lib/gate-pass-renderer";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/gate-passes/[id]/generate-card — generate the ID card PNG ON
 * DEMAND and return it directly as a download (NOT stored in the DB or
 * Cloudinary). This keeps storage costs at zero — the card is regenerated
 * each time the admin requests it.
 *
 * Returns a PNG image response (Content-Type: image/png) with a
 * Content-Disposition header for download.
 */
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

    // Generate the card PNG on demand.
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

    // Return the PNG directly — no DB save, no storage upload.
    const fileName = `gate-pass-${pass.passNumber}.png`;
    const headers = new Headers({
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    });
    // Convert Buffer to Uint8Array for the Response body.
    const pngBytes = new Uint8Array(png);
    return new NextResponse(pngBytes, { status: 200, headers });
  } catch (e) {
    console.error("[POST /api/gate-passes/[id]/generate-card] error:", e);
    return NextResponse.json({ error: "Internal Server Error", detail: "An unexpected error occurred" }, { status: 500 });
  }
}
