import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, ownsResource } from "@/lib/tenant";
import type {
  CertificateDto,
  CertStatus,
  CertTemplate,
  CertIssueCondition,
} from "@/types";

/**
 * Map a Prisma Certificate row (with event + user relations) to a full
 * CertificateDto, including the storage + revocation + provenance fields
 * added in CLOUD-EMAIL-1. This duplicates the (currently incomplete) toCertDto
 * helpers in sibling routes so the upload-png endpoint can return a complete
 * DTO without depending on them.
 */
function toCertDto(c: any): CertificateDto {
  return {
    id: c.id,
    eventId: c.eventId,
    userId: c.userId,
    attemptId: c.attemptId ?? null,
    certificateNumber: c.certificateNumber,
    verificationToken: c.verificationToken,
    template: (c.template ?? "modern") as CertTemplate,
    eligibilityType: (c.eligibilityType ?? "COMPLETED") as CertIssueCondition,
    recipientName: c.recipientName,
    issuedAt: c.issuedAt.toISOString(),
    issuedBy: c.issuedBy ?? null,
    status: (c.status ?? "VALID") as CertStatus,
    certificateUrl: c.certificateUrl ?? null,
    certificatePublicId: c.certificatePublicId ?? null,
    generatedAutomatically: c.generatedAutomatically ?? false,
    manualOverride: c.manualOverride ?? false,
    revokedAt: c.revokedAt ? c.revokedAt.toISOString() : null,
    revokedBy: c.revokedBy ?? null,
    revocationReason: c.revocationReason ?? null,
    createdAt: c.createdAt.toISOString(),
    event: c.event
      ? {
          id: c.event.id,
          title: c.event.title,
          certOrgName: c.event.certOrgName ?? null,
          certSigneeName: c.event.certSigneeName ?? null,
          certSigneeTitle: c.event.certSigneeTitle ?? null,
          certSigneeImage: c.event.certSigneeImage ?? null,
          certLogo: c.event.certLogo ?? null,
          certTemplate: (c.event.certTemplate ?? "modern") as CertTemplate,
          certPassingScore: c.event.certPassingScore ?? 60,
        }
      : undefined,
    user: c.user
      ? { name: c.user.name ?? null, email: c.user.email }
      : undefined,
  };
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/certificates/[id]/upload-png — admin only.
 *
 * Body: { pngDataUrl: string }  // canvas.toDataURL("image/png") output
 *
 * This endpoint is now a NO-OP for storage — the PNG is NOT uploaded to
 * Cloudinary or stored in the DB. The certificate PNG is generated and
 * downloaded on the CLIENT side directly from the canvas. This keeps
 * storage costs at zero.
 *
 * The endpoint still verifies auth + ownership and returns the certificate
 * DTO (without a certificateUrl) so the client can update its local state.
 *
 * Response: { certificate: CertificateDto, downloaded: true }
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "certificate.generate");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await ctx.params;

    const existing = await db.certificate.findUnique({
      where: { id },
      select: {
        id: true,
        certificateNumber: true,
        certificatePublicId: true,
      },
      include: { event: { select: { organizationId: true } } },
    });
    if (!existing || !ownsResource(existing.event, auth.ctx)) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 },
      );
    }

    // The PNG is generated and downloaded on the CLIENT side directly from
    // the canvas. We do NOT upload it to Cloudinary or store the base64 in
    // the DB. The client calls this endpoint just to mark the certificate
    // as "manually overridden" (admin action) — the download happens locally.
    const updated = await db.certificate.update({
      where: { id },
      data: {
        // Mark that an admin has manually (re)generated the PNG.
        manualOverride: true,
        // Clear any previously-stored URL — we no longer persist the PNG.
        certificateUrl: null,
        certificatePublicId: null,
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            certOrgName: true,
            certSigneeName: true,
            certSigneeTitle: true,
            certSigneeImage: true,
            certLogo: true,
            certTemplate: true,
            certPassingScore: true,
          },
        },
        user: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({ certificate: toCertDto(updated), downloaded: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
