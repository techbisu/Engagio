import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import type {
  CertificateDto,
  CertIssueCondition,
  CertStatus,
  CertTemplate,
} from "@/types";

async function getSessionUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; name?: string | null; email?: string | null; role?: string }
    | undefined;
  return user;
}

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
      ? {
          name: c.user.name ?? null,
          email: c.user.email,
        }
      : undefined,
  };
}

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/certificates/[id] — fetch a single certificate. */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const cert = await db.certificate.findUnique({
      where: { id },
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
    if (!cert) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }
    // Participants can only see their own certificates.
    if (user.role !== "ADMIN" && cert.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ certificate: toCertDto(cert) });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/certificates/[id] — admin only.
 * Body:
 *   - { action: "revoke", reason?: string } — mark as REVOKED with optional reason
 *   - { action: "reinstate" }              — clear REVOKED status back to VALID
 *
 * Tracks revokedAt / revokedBy / revocationReason so revocations are auditable.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getSessionUser();
    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const existing = await db.certificate.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    }
    const body = await req.json();
    const action = body?.action as string | undefined;
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : null;
    let nextStatus: "VALID" | "REVOKED";
    let updateData: Record<string, unknown> = {};
    if (action === "revoke") {
      nextStatus = "REVOKED";
      updateData = {
        status: nextStatus,
        revokedAt: new Date(),
        revokedBy: user.id ?? null,
        revocationReason: reason || null,
      };
    } else if (action === "reinstate") {
      nextStatus = "VALID";
      updateData = {
        status: nextStatus,
        revokedAt: null,
        revokedBy: null,
        revocationReason: null,
      };
    } else {
      return NextResponse.json(
        { error: `Unknown action. Expected "revoke" or "reinstate".` },
        { status: 400 },
      );
    }
    const updated = await db.certificate.update({
      where: { id },
      data: updateData,
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
    return NextResponse.json({ success: true, certificate: toCertDto(updated) });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 },
    );
  }
}
