import { db } from "@/lib/db"
import {
  generateCertificateNumber,
  generateVerificationToken,
} from "@/lib/cert"
import { sendResultPublishedEmail } from "@/lib/email"
import type { CertificateDto } from "@/types"

/**
 * Check whether a participant is eligible for a certificate based on the
 * event's certIssueCondition. Returns { eligible, reason }.
 */
export async function checkCertEligibility(
  eventId: string,
  userId: string
): Promise<{ eligible: boolean; reason: string; attemptId?: string }> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      certEnabled: true,
      certIssueCondition: true,
      certPassingScore: true,
    },
  })

  if (!event || !event.certEnabled) {
    return { eligible: false, reason: "Certificates not enabled for this event" }
  }

  // Find the best (highest-percentage) completed attempt for this user+event
  const attempts = await db.quizAttempt.findMany({
    where: {
      eventId,
      userId,
      status: { in: ["COMPLETED", "TIMEOUT", "CHEAT_DETECTED"] },
    },
    select: {
      id: true,
      percentage: true,
      passed: true,
      status: true,
    },
    orderBy: { percentage: "desc" },
  })

  if (attempts.length === 0) {
    return {
      eligible: false,
      reason: `No completed assessment (required: ${event.certIssueCondition})`,
    }
  }

  const best = attempts[0]

  switch (event.certIssueCondition) {
    case "PARTICIPATION":
      // Just needs a registration (checked by caller) — treat as eligible
      return { eligible: true, reason: "Participation", attemptId: best.id }
    case "COMPLETED":
      // Any completed attempt qualifies
      return { eligible: true, reason: "Assessment completed", attemptId: best.id }
    case "PASSED":
      if (best.passed === true && (best.percentage ?? 0) >= event.certPassingScore) {
        return {
          eligible: true,
          reason: `Passed with ${best.percentage}% (required: ${event.certPassingScore}%)`,
          attemptId: best.id,
        }
      }
      return {
        eligible: false,
        reason: `Score ${best.percentage}% below passing score ${event.certPassingScore}%`,
      }
    default:
      return { eligible: false, reason: `Unknown condition: ${event.certIssueCondition}` }
  }
}

/**
 * Generate a certificate for a participant. Idempotent — if a cert already
 * exists for (eventId, userId), returns the existing one (unless regenerate=true).
 *
 * If manualOverride=true, skips the eligibility check (admin override).
 */
export async function generateCertificate(opts: {
  eventId: string
  userId: string
  attemptId?: string
  issuedBy?: string // admin userId
  manualOverride?: boolean
  regenerate?: boolean
}): Promise<{ certificate: CertificateDto | null; created: boolean; reason: string }> {
  const { eventId, userId, attemptId, issuedBy, manualOverride = false, regenerate = false } = opts

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      certEnabled: true,
      certTemplate: true,
      certIssueCondition: true,
      certOrgName: true,
    },
  })

  if (!event) {
    return { certificate: null, created: false, reason: "Event not found" }
  }
  if (!event.certEnabled) {
    return { certificate: null, created: false, reason: "Certificates not enabled" }
  }

  // Check for existing certificate (idempotent)
  const existing = await db.certificate.findUnique({
    where: { eventId_userId: { eventId, userId } },
  })

  if (existing && !regenerate) {
    return {
      certificate: toCertDto(existing, event),
      created: false,
      reason: "Certificate already exists",
    }
  }

  // Eligibility check (skip if manualOverride)
  if (!manualOverride) {
    const elig = await checkCertEligibility(eventId, userId)
    if (!elig.eligible) {
      return { certificate: null, created: false, reason: elig.reason }
    }
    if (!attemptId && elig.attemptId) {
      opts.attemptId = elig.attemptId
    }
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })
  if (!user) {
    return { certificate: null, created: false, reason: "User not found" }
  }

  const recipientName = user.name || user.email

  if (existing && regenerate) {
    // Keep the same certificate number + verification token, update template + provenance
    const updated = await db.certificate.update({
      where: { id: existing.id },
      data: {
        template: event.certTemplate,
        eligibilityType: event.certIssueCondition,
        attemptId: opts.attemptId || existing.attemptId,
        status: "VALID", // reinstate if was revoked
        revokedAt: null,
        revokedBy: null,
        revocationReason: null,
        // Clear the old PNG URL — will be re-uploaded by the client after re-rendering
        certificateUrl: null,
        certificatePublicId: null,
        // Don't change generatedAutomatically/manualOverride flags on regenerate
        issuedBy: issuedBy || existing.issuedBy,
        issuedAt: new Date(),
      },
    })
    return {
      certificate: toCertDto(updated, event),
      created: false,
      reason: "Certificate regenerated",
    }
  }

  // Create new certificate
  const cert = await db.certificate.create({
    data: {
      eventId,
      userId,
      attemptId: opts.attemptId || null,
      certificateNumber: generateCertificateNumber(),
      verificationToken: generateVerificationToken(),
      template: event.certTemplate,
      eligibilityType: event.certIssueCondition,
      recipientName,
      issuedBy: issuedBy || null,
      status: "VALID",
      generatedAutomatically: !issuedBy, // auto-generated if no admin issued it
      manualOverride,
    },
  })

  return {
    certificate: toCertDto(cert, event),
    created: true,
    reason: manualOverride ? "Generated with manual override" : "Generated automatically",
  }
}

/**
 * Auto-generate certificates for all eligible participants of an event.
 * Called after results are published (or after immediate submit).
 *
 * For each COMPLETED attempt without an existing certificate:
 *   - Check eligibility
 *   - If eligible, generate (async, non-blocking)
 */
export async function autoGenerateCertificates(
  eventId: string
): Promise<{ generated: number; skipped: number; errors: string[] }> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { certEnabled: true, certAutoGenerate: true },
  })

  if (!event || !event.certEnabled || !event.certAutoGenerate) {
    return { generated: 0, skipped: 0, errors: [] }
  }

  // Get all completed attempts for this event, grouped by user
  const attempts = await db.quizAttempt.findMany({
    where: { eventId, status: { in: ["COMPLETED", "TIMEOUT", "CHEAT_DETECTED"] } },
    select: { id: true, userId: true },
    orderBy: { percentage: "desc" },
  })

  const userIds = Array.from(new Set(attempts.map((a) => a.userId)))
  let generated = 0
  let skipped = 0
  const errors: string[] = []

  for (const userId of userIds) {
    try {
      const result = await generateCertificate({ eventId, userId })
      if (result.created) {
        generated++
      } else {
        skipped++
      }
    } catch (e: any) {
      errors.push(`User ${userId}: ${e?.message || String(e)}`)
    }
  }

  return { generated, skipped, errors }
}

/**
 * Send result-published email notifications to participants whose results
 * were just published. Called after the publish operation.
 *
 * Only sends if the quiz link's emailOnPublish is true.
 * Errors are logged but don't fail the publish operation.
 */
export async function sendPublishNotifications(opts: {
  quizLinkId: string
  attemptIds: string[]
}): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const { quizLinkId, attemptIds } = opts

  const link = await db.quizLink.findUnique({
    where: { id: quizLinkId },
    select: { emailOnPublish: true, eventId: true },
  })

  if (!link || !link.emailOnPublish || attemptIds.length === 0) {
    return { sent: 0, skipped: attemptIds.length, errors: [] }
  }

  const event = await db.event.findUnique({
    where: { id: link.eventId },
    select: { title: true },
  })

  const attempts = await db.quizAttempt.findMany({
    where: { id: { in: attemptIds } },
    select: {
      id: true,
      percentage: true,
      passed: true,
      userId: true,
    },
  })

  const userIds = Array.from(new Set(attempts.map((a) => a.userId)))
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const attempt of attempts) {
    const user = userMap.get(attempt.userId)
    if (!user?.email) {
      skipped++
      continue
    }
    try {
      const result = await sendResultPublishedEmail({
        to: user.email,
        participantName: user.name || user.email,
        eventTitle: event?.title || "your assessment",
        percentage: attempt.percentage,
        resultUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/?view=student`,
      })
      if (result.sent) {
        sent++
      } else {
        skipped++
      }
    } catch (e: any) {
      errors.push(`Email to ${user.email}: ${e?.message || String(e)}`)
    }
  }

  return { sent, skipped, errors }
}

/** Map a Prisma Certificate row to CertificateDto. */
function toCertDto(c: any, event?: any): CertificateDto {
  return {
    id: c.id,
    eventId: c.eventId,
    userId: c.userId,
    attemptId: c.attemptId ?? null,
    certificateNumber: c.certificateNumber,
    verificationToken: c.verificationToken,
    template: c.template,
    eligibilityType: c.eligibilityType,
    recipientName: c.recipientName,
    issuedAt: c.issuedAt?.toISOString?.() ?? c.issuedAt,
    issuedBy: c.issuedBy ?? null,
    status: c.status,
    certificateUrl: c.certificateUrl ?? null,
    certificatePublicId: c.certificatePublicId ?? null,
    generatedAutomatically: c.generatedAutomatically ?? false,
    manualOverride: c.manualOverride ?? false,
    revokedAt: c.revokedAt?.toISOString?.() ?? null,
    revokedBy: c.revokedBy ?? null,
    revocationReason: c.revocationReason ?? null,
    createdAt: c.createdAt?.toISOString?.() ?? c.createdAt,
    event: event
      ? {
          id: event.id,
          title: event.title,
          certOrgName: event.certOrgName ?? null,
        }
      : undefined,
  }
}
