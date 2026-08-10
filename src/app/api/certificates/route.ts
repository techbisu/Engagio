import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import type {
  CertificateDto,
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

/** Map a Prisma Certificate row (with relations) to CertificateDto. */
function toCertDto(c: any): CertificateDto {
  return {
    id: c.id,
    eventId: c.eventId,
    userId: c.userId,
    attemptId: c.attemptId ?? null,
    certificateNumber: c.certificateNumber,
    verificationToken: c.verificationToken,
    template: (c.template ?? "modern") as CertTemplate,
    eligibilityType: (c.eligibilityType ?? "COMPLETED") as
      | "PARTICIPATION"
      | "COMPLETED"
      | "PASSED",
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

/**
 * GET /api/certificates
 *  - Admin (?all=true):  all certificates (optionally filtered by ?eventId=)
 *  - Participant (default):   only the current user's certificates
 *
 * Always returns: { certificates: CertificateDto[], total: number }
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isAdmin = user.role === "ADMIN";
    const url = new URL(req.url);
    const wantsAll = url.searchParams.get("all") === "true";
    const eventIdFilter = url.searchParams.get("eventId") || undefined;

    // Participants can never request ?all=true — silently ignore and return only
    // their own rows to avoid leaking other users' certificates.
    const scopeAll = isAdmin && wantsAll;

    const where: {
      userId?: string;
      eventId?: string;
    } = {};
    if (!scopeAll) {
      where.userId = user.id;
    }
    if (eventIdFilter) {
      where.eventId = eventIdFilter;
    }

    const certificates = await db.certificate.findMany({
      where,
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
        // Only include the user relation when the caller is an admin (PII).
        ...(scopeAll
          ? {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            }
          : {}),
      },
      orderBy: { issuedAt: "desc" },
    });

    const dtos = certificates.map(toCertDto);
    return NextResponse.json({ certificates: dtos, total: dtos.length });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 },
    );
  }
}
