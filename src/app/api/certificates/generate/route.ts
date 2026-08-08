import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import {
  generateCertificateNumber,
  generateVerificationToken,
} from "@/lib/cert";
import type {
  CertificateDto,
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
    recipientName: c.recipientName,
    issuedAt: c.issuedAt.toISOString(),
    status: (c.status ?? "VALID") as CertStatus,
    certificateUrl: c.certificateUrl ?? null,
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

/** Issue (or return the existing) certificate for a user/event. Idempotent. */
async function issueFor(opts: {
  userId: string;
  eventId: string;
  attemptId?: string;
}): Promise<{ certificate?: CertificateDto; error?: string; status?: number }> {
  const { userId, eventId, attemptId } = opts;

  // 1. Idempotent — return existing if already issued.
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
  if (existing) {
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

  // 3. Eligibility check
  const eligible = await checkEligibility({
    userId,
    eventId,
    condition: event.certIssueCondition ?? "COMPLETED",
    passingScore: event.certPassingScore ?? 60,
  });
  if (!eligible.eligible) {
    return {
      error: eligible.reason || "Participant does not meet the certificate issue condition",
      status: 400,
    };
  }

  // 4. Generate certificate
  const certificateNumber = generateCertificateNumber();
  const verificationToken = generateVerificationToken();
  const template = (event.certTemplate ?? "modern") as CertTemplate;
  const recipientName = user.name?.trim() || user.email;

  const created = await db.certificate.create({
    data: {
      eventId,
      userId,
      attemptId: attemptId ?? eligible.attemptId ?? null,
      certificateNumber,
      verificationToken,
      template,
      recipientName,
      status: "VALID",
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
 *   Single: { userId, eventId, attemptId? }
 *   Bulk:   { userIds: string[], eventId }
 *
 * Single response: { certificate: CertificateDto }
 * Bulk response:   { generated: number, certificates: CertificateDto[], errors: [{ userId, error }] }
 *
 * Always idempotent — if a certificate already exists for the (userId, eventId),
 * it's returned as-is without re-issuing.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { userId, eventId, attemptId, userIds } = body || {};

    // --- BULK ----------------------------------------------------------------
    if (Array.isArray(userIds) && eventId) {
      const results: CertificateDto[] = [];
      const errors: { userId: string; error: string }[] = [];
      for (const uid of userIds) {
        if (typeof uid !== "string" || !uid.trim()) continue;
        const r = await issueFor({ userId: uid, eventId });
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
      const r = await issueFor({ userId, eventId, attemptId });
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
