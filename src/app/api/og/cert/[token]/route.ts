import { NextRequest, NextResponse } from "next/server";
import { renderCertOgByToken } from "@/lib/cert-og";

/**
 * GET /api/og/cert/[token]
 *
 * Public endpoint — no auth required. Returns a 1200×630 PNG of the
 * certificate, suitable for Open Graph / Twitter card previews.
 *
 * Used by social crawlers (LinkedIn, Facebook, X, WhatsApp) when a user
 * shares the /verify/[token] URL. The verify page's generateMetadata sets
 * og:image to this URL so the platform shows the certificate image in the
 * preview card.
 *
 * IMPLEMENTATION: Builds an SVG string manually (no Satori/JSX needed),
 * then converts to PNG using sharp (which IS in serverExternalPackages and
 * works on Vercel). This avoids the next/og + Satori runtime issues that
 * were causing 500 errors on Vercel's serverless environment.
 *
 * Uses the Node.js runtime (NOT edge) because it uses Prisma + sharp.
 * sharp is in serverExternalPackages and works on Vercel.
 *
 * Cache for 1 hour (social crawlers re-fetch periodically; the cert content
 * is immutable so caching is safe).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await ctx.params;
    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      );
    }

    const png = await renderCertOgByToken(token);
    if (!png) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 }
      );
    }

    return new NextResponse(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        "Content-Length": String(png.length),
      },
    });
  } catch (e) {
    console.error("[GET /api/og/cert/[token]] error:", e);
    if (e instanceof Error) {
      console.error("[GET /api/og/cert/[token]] stack:", e.stack);
    }
    return NextResponse.json(
      { error: "Failed to render image", details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
