import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, ownsResource } from "@/lib/tenant";
import { uploadFile, deleteFile } from "@/lib/storage";
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
 * Uploads the rendered certificate PNG to the storage provider (Cloudinary
 * if configured, else base64 data URL fallback) and updates the Certificate
 * row with the resolved URL + publicId. If a PNG was previously uploaded,
 * the old Cloudinary asset is deleted first (best-effort).
 *
 * Response: { certificate: CertificateDto }
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { pngDataUrl } = body as { pngDataUrl?: unknown };
    if (typeof pngDataUrl !== "string" || !pngDataUrl.trim()) {
      return NextResponse.json(
        { error: "pngDataUrl is required" },
        { status: 400 },
      );
    }
    // Sanity: must be a PNG data URL (canvas.toDataURL output).
    if (!pngDataUrl.startsWith("data:image/png")) {
      return NextResponse.json(
        { error: "pngDataUrl must be a PNG data URL (data:image/png;base64,...)" },
        { status: 400 },
      );
    }

    // Replace any previously-uploaded PNG. deleteFile is a no-op when the
    // publicId is null (base64 fallback path) or when Cloudinary isn't
    // configured.
    await deleteFile(existing.certificatePublicId);

    // Use the certificate number as the public filename so regeneration
    // overwrites the same Cloudinary asset (overwrite:true in uploadFile).
    // Sanitize: keep alphanumerics + dashes only.
    const safeName = existing.certificateNumber
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    const uploaded = await uploadFile(pngDataUrl, "image/png", {
      folder: "certificates",
      filename: safeName || undefined,
    });

    const updated = await db.certificate.update({
      where: { id },
      data: {
        certificateUrl: uploaded.url,
        certificatePublicId: uploaded.publicId,
        // Mark that an admin has manually (re)generated the PNG asset.
        manualOverride: true,
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

    return NextResponse.json({ certificate: toCertDto(updated) });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
