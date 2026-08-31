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
 *
 * The certificate payload includes the template + org logo URL so the
 * verify page can render the certificate image (CertificateRenderer) for
 * visual verification, not just text details.
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
            organizationId: true,
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

    // Fetch org info (logo URL, name) for the certificate render
    let orgLogoUrl: string | null = null;
    let orgName: string | null = cert.event?.certOrgName ?? null;
    if (cert.event?.organizationId) {
      const org = await db.organization.findUnique({
        where: { id: cert.event.organizationId },
        select: { name: true, logoUrl: true },
      });
      if (org) {
        orgLogoUrl = org.logoUrl ?? null;
        // Prefer the org's actual name if certOrgName isn't set
        if (!orgName) orgName = org.name;
      }
    }

    const verified = cert.status === "VALID";
    return NextResponse.json({
      verified,
      revoked: !verified,
      certificate: {
        certificateNumber: cert.certificateNumber,
        verificationToken: cert.verificationToken,
        recipientName: cert.recipientName,
        template: cert.template,
        issuedAt: cert.issuedAt.toISOString(),
        status: cert.status,
        eventName: cert.event?.title ?? "Untitled event",
        orgName,
        orgLogoUrl,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
