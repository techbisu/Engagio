import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadImage, isCloudinaryConfigured } from "@/lib/storage";
import type {
  CertificateDto,
  CertStatus,
  CertTemplate,
  CertIssueCondition,
} from "@/types";

/**
 * Map a Prisma Certificate row (with event + user relations) to a full
 * CertificateDto.
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
 * POST /api/certificates/[id]/upload-png
 *
 * Called by the certificate owner (participant) OR an admin after the
 * CertificateRenderer canvas produces the PNG. The client sends the base64
 * PNG data URL; the server uploads it to Cloudinary and stores the URL +
 * public_id on the certificate record.
 *
 * The stored Cloudinary URL is used as:
 *   - og:image in the /verify/[token] page metadata (social media preview)
 *   - the image URL for social sharing (LinkedIn, Facebook, X, WhatsApp)
 *   - the download URL for the certificate PNG
 *
 * If Cloudinary is not configured, falls back to storing the base64 data URL
 * (works for download but NOT for og:image since crawlers can't fetch base64).
 *
 * Body: { pngDataUrl: string }  // canvas.toDataURL("image/png") output
 * Response: { certificate: CertificateDto, uploaded: boolean, url: string }
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await ctx.params;

    const cert = await db.certificate.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        certificateNumber: true,
        certificatePublicId: true,
        eventId: true,
        event: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!cert) {
      return NextResponse.json(
        { error: "Certificate not found" },
        { status: 404 }
      );
    }

    // Allow the cert owner OR an admin (with certificate.generate permission
    // on the event's org) to upload. This is needed because the participant
    // renders the cert on their device and uploads it.
    const isOwner = cert.userId === session.user.id;
    if (!isOwner) {
      // Check if the user is an admin for the event's org
      const { requirePermission, ownsResource } = await import("@/lib/tenant");
      const auth = await requirePermission(req, "certificate.generate");
      if (!auth.ok || !ownsResource(cert.event, auth.ctx)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Parse the body
    const body = await req.json();
    const { pngDataUrl } = body;
    if (!pngDataUrl || typeof pngDataUrl !== "string") {
      return NextResponse.json(
        { error: "pngDataUrl is required" },
        { status: 400 }
      );
    }

    // Extract the base64 data from the data URL
    // Format: "data:image/png;base64,iVBORw0KGgo..."
    const base64Match = pngDataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json(
        { error: "Invalid PNG data URL" },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(base64Match[1], "base64");

    // Upload to Cloudinary (or fall back to base64 if not configured)
    const uploadResult = await uploadImage(buffer, "image/png", {
      folder: "certificates",
      publicIdPrefix: `cert-${cert.certificateNumber}`,
      tags: ["certificate", cert.eventId],
    });

    // Update the cert record with the uploaded URL
    const updated = await db.certificate.update({
      where: { id },
      data: {
        certificateUrl: uploadResult.url,
        certificatePublicId: uploadResult.publicId ?? null,
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

    return NextResponse.json({
      certificate: toCertDto(updated),
      uploaded: uploadResult.isLocal ? false : true,
      url: uploadResult.url,
      cloudinaryConfigured: isCloudinaryConfigured(),
    });
  } catch (e) {
    console.error("[POST /api/certificates/[id]/upload-png] error:", e);
    return NextResponse.json(
      { error: "Failed to upload certificate image" },
      { status: 500 }
    );
  }
}
