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
 * Uses @vercel/og (ImageResponse) which is preconfigured for Vercel's
 * serverless environment — no native binary issues.
 *
 * Cache for 1 hour (social crawlers re-fetch periodically; the cert content
 * is immutable so caching is safe).
 */
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

    const imageResponse = await renderCertOgByToken(token);
    if (!imageResponse) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 }
      );
    }

    // imageResponse is an ImageResponse (a Response object) from @vercel/og.
    // Add caching headers by cloning and augmenting.
    const headers = new Headers(imageResponse.headers);
    headers.set(
      "Cache-Control",
      "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
    );

    return new Response(imageResponse.body, {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error("[GET /api/og/cert/[token]] error:", e);
    return NextResponse.json(
      { error: "Failed to render image" },
      { status: 500 }
    );
  }
}
