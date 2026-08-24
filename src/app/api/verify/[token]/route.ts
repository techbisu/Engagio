import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/verify/[token] — PUBLIC, no auth required.
 *
 * Returns the public-facing certificate info for the verification page.
 * Response shapes:
 *   { verified: true, certificate: { ... } }                              — VALID
 *   { verified: false, revoked: true, certificate: { ... } }              — REVOKED
 *   { error: "Certificate not found" }                                    — 404
 */
type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;
    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Invalid verification token" },
        { status: 400 },
      );
    }
    const cert = await db.certificate.findUnique({
      where: { verificationToken: token },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            certOrgName: true,
          },
        },
      },
    });
    if (!cert) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 },
      );
    }
    const verified = cert.status === "VALID";
    return NextResponse.json({
      verified,
      revoked: !verified,
      certificate: {
        certificateNumber: cert.certificateNumber,
        recipientName: cert.recipientName,
        template: cert.template,
        issuedAt: cert.issuedAt.toISOString(),
        status: cert.status,
        eventName: cert.event?.title ?? "Untitled event",
        orgName: cert.event?.certOrgName ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
