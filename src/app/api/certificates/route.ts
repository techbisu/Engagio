import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { requirePermission, type TenantContext } from "@/lib/tenant";
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
    const url = new URL(req.url);
    const wantsAll = url.searchParams.get("all") === "true";
    const eventIdFilter = url.searchParams.get("eventId") || undefined;

    // The admin (`all=true`) view is org-scoped and permission-gated. The
    // default view (a user's own certificates) is available to every
    // authenticated user — participants must NOT be blocked from their own
    // certificates by the admin permission.
    let scopeAll = false;
    let adminCtx: TenantContext | null = null;
    if (wantsAll) {
      const auth = await requirePermission(req, "certificate.view");
      if (!auth.ok) {
        // Legacy single-tenant admins without an org membership can't be
        // scoped — return empty rather than leaking cross-tenant rows.
        if (auth.legacyAdmin) {
          return NextResponse.json({ certificates: [], total: 0 });
        }
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
      scopeAll = true;
      adminCtx = auth.ctx;
    }

    const where: Record<string, unknown> = {};
    if (!scopeAll) {
      where.userId = user.id;
    } else {
      where.event = { organizationId: adminCtx!.orgId };
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
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
