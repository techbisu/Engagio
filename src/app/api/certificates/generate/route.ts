import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import {
  generateCertificateNumber,
  generateVerificationToken,
} from "@/lib/cert";
import type {
  CertificateDto,
  CertIssueCondition,
  CertStatus,
  CertTemplate,
} from "@/types";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; name?: string | null; email?: string | null; role?: string }
    | undefined;
  return user?.role === "ADMIN" ? user : null;
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

/**
 * Determine whether a user is eligible for a certificate under the given
 * cert issue condition for an event. Returns `{ eligible: boolean, attemptId?: string }`.
 *
 * - PARTICIPATION: needs a registration for the event.
 * - COMPLETED:     needs at least one COMPLETED / TIMEOUT / CHEAT_DETECTED attempt.
 * - PASSED:        needs at least one attempt with `passed === true` AND
 *                  `percentage >= event.certPassingScore`.
 */
async function checkEligibility(opts: {
  userId: string;
  eventId: string;
  condition: string;
  passingScore: number;
}): Promise<{ eligible: boolean; attemptId?: string; reason?: string }> {
  const { userId, eventId, condition, passingScore } = opts;

  if (condition === "PARTICIPATION") {
    const reg = await db.registration.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true },
    });
    if (!reg) {
      return {
        eligible: false,
        reason: "No registration found for this event",
      };
    }
    return { eligible: true };
  }

  // COMPLETED + PASSED both require at least one terminal attempt
  const attempts = await db.quizAttempt.findMany({
    where: {
      userId,
      eventId,
      status: { in: ["COMPLETED", "TIMEOUT", "CHEAT_DETECTED"] },
    },
    select: {
      id: true,
      status: true,
      percentage: true,
      passed: true,
    },
    orderBy: { completedAt: "desc" },
  });

  if (attempts.length === 0) {
    return {
      eligible: false,
      reason: "No completed attempts for this event",
    };
  }

  if (condition === "COMPLETED") {
    return { eligible: true, attemptId: attempts[0].id };
  }

  if (condition === "PASSED") {
    const passing = attempts.find(
      (a) =>
        a.passed === true &&
        a.percentage != null &&
        a.percentage >= passingScore,
    );
    if (!passing) {
      return {
        eligible: false,
        reason: `No attempt passed with score ≥ ${passingScore}%`,
      };
    }
    return { eligible: true, attemptId: passing.id };
  }

  // Unknown condition — be conservative.
  return { eligible: false, reason: `Unknown issue condition: ${condition}` };
}

/** Issue (or return the existing) certificate for a user/event. Idempotent.
 *  If `regenerate` is true and a cert exists, update it (keep cert number + token). */
async function issueFor(opts: {
  userId: string;
  eventId: string;
  attemptId?: string;
  manualOverride?: boolean;
  issuedBy?: string;
  regenerate?: boolean;
}): Promise<{ certificate?: CertificateDto; error?: string; status?: number }> {
  const { userId, eventId, attemptId, manualOverride, issuedBy, regenerate } = opts;

  // 1. Idempotent — return existing if already issued (unless regenerate=true).
  const existing = await db.certificate.findFirst({
    where: { eventId, userId },
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
  if (existing && !regenerate) {
    return { certificate: toCertDto(existing) };
  }

  // 2. Load user + event config
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return { error: "User not found", status: 404 };
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      certEnabled: true,
      certTemplate: true,
      certIssueCondition: true,
      certPassingScore: true,
      certOrgName: true,
      certSigneeName: true,
      certSigneeTitle: true,
      certSigneeImage: true,
      certLogo: true,
    },
  });
  if (!event) {
    return { error: "Event not found", status: 404 };
  }

  // 3. Eligibility check (skipped when manualOverride is true OR regenerate is true)
  let eligibleAttemptId: string | undefined = attemptId;
  const condition = (event.certIssueCondition ?? "COMPLETED") as string;
  if (!manualOverride && !regenerate) {
    const eligible = await checkEligibility({
      userId,
      eventId,
      condition,
      passingScore: event.certPassingScore ?? 60,
    });
    if (!eligible.eligible) {
      return {
        error: eligible.reason || "Participant does not meet the certificate issue condition",
        status: 400,
      };
    }
    eligibleAttemptId = attemptId ?? eligible.attemptId;
  }

  const template = (event.certTemplate ?? "modern") as CertTemplate;
  const recipientName = user.name?.trim() || user.email;

  // 4. REGENERATE path — keep cert number + token, update template + reset status
  if (existing && regenerate) {
    const updated = await db.certificate.update({
      where: { id: existing.id },
      data: {
        template,
        eligibilityType: condition,
        attemptId: eligibleAttemptId ?? existing.attemptId ?? null,
        status: "VALID", // reinstate if was revoked
        revokedAt: null,
        revokedBy: null,
        revocationReason: null,
        // Clear the old PNG URL — client will re-render + re-upload
        certificateUrl: null,
        certificatePublicId: null,
        issuedBy: issuedBy ?? existing.issuedBy,
        issuedAt: new Date(),
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
    return { certificate: toCertDto(updated) };
  }

  // 5. CREATE path — new certificate
  const certificateNumber = generateCertificateNumber();
  const verificationToken = generateVerificationToken();

  const created = await db.certificate.create({
    data: {
      eventId,
      userId,
      attemptId: eligibleAttemptId ?? null,
      certificateNumber,
      verificationToken,
      template,
      eligibilityType: condition,
      recipientName,
      status: "VALID",
      issuedBy: issuedBy ?? null,
      generatedAutomatically: false,
      manualOverride: !!manualOverride,
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

  return { certificate: toCertDto(created) };
}

/**
 * POST /api/certificates/generate — admin only.
 *
 * Body shapes:
 *   Single: { userId, eventId, attemptId?, manualOverride?, regenerate? }
 *   Bulk:   { userIds: string[], eventId, manualOverride? }
 *
 * Single response: { certificate: CertificateDto }
 * Bulk response:   { generated: number, certificates: CertificateDto[], errors: [{ userId, error }] }
 *
 * Always idempotent — if a certificate already exists for the (userId, eventId),
 * it's returned as-is without re-issuing (unless `regenerate: true`).
 *
 * When `manualOverride: true` is set, the server-side eligibility check is
 * skipped (admin override). The resulting certificate's `manualOverride`
 * field is set to true so the override is auditable.
 *
 * When `regenerate: true` is set (single-issue only), if a cert already
 * exists, it's updated (same cert number + verification token, updated
 * template + status reset to VALID, PNG URL cleared for re-upload).
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { userId, eventId, attemptId, userIds, manualOverride, regenerate } = body || {};
    const issuedBy = (admin as { id?: string }).id ?? null;

    // --- BULK ----------------------------------------------------------------
    if (Array.isArray(userIds) && eventId) {
      const results: CertificateDto[] = [];
      const errors: { userId: string; error: string }[] = [];
      for (const uid of userIds) {
        if (typeof uid !== "string" || !uid.trim()) continue;
        const r = await issueFor({
          userId: uid,
          eventId,
          manualOverride: !!manualOverride,
          issuedBy,
        });
        if (r.certificate) {
          results.push(r.certificate);
        } else {
          errors.push({
            userId: uid,
            error: r.error || "Unknown error",
          });
        }
      }
      return NextResponse.json({
        generated: results.length,
        certificates: results,
        errors,
      });
    }

    // --- SINGLE -------------------------------------------------------------
    if (userId && eventId) {
      const r = await issueFor({
        userId,
        eventId,
        attemptId,
        manualOverride: !!manualOverride,
        issuedBy,
        regenerate: !!regenerate,
      });
      if (r.certificate) {
        return NextResponse.json({ certificate: r.certificate });
      }
      return NextResponse.json(
        { error: r.error || "Failed to generate certificate" },
        { status: r.status || 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Expected { userId, eventId } for single-issue or { userIds: string[], eventId } for bulk-issue.",
      },
      { status: 400 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 },
    );
  }
}
