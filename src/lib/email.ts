/**
 * Email abstraction layer.
 *
 * All emails go through this module so the provider can be swapped
 * (Resend → SendGrid → Postmark → SES) without changing application code.
 *
 * Current provider: Resend (via direct API, no SDK).
 *
 * Env vars:
 *   RESEND_API_KEY   — Resend API key (optional)
 *   EMAIL_FROM       — From address (default: noreply@quizmaster.pro)
 *
 * If RESEND_API_KEY is not configured, `sendEmail` returns a success
 * status with `sent: false` and logs a warning — email is NEVER a hard
 * dependency for business logic (result publishing, certificate issuance).
 */

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  /** Optional plain-text fallback. */
  text?: string
}

export interface SendEmailResult {
  sent: boolean
  /** When false, the reason (e.g. "email not configured"). */
  reason?: string
  /** Provider message ID (when sent). */
  messageId?: string
}

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@quizmaster.pro"

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY
}

/**
 * Send an email via Resend.
 *
 * If RESEND_API_KEY is not set, returns `{ sent: false, reason: "..." }`
 * without throwing — callers can continue their flow.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    console.warn(
      `[email] RESEND_API_KEY not configured — skipping email to ${input.to} (subject: "${input.subject}")`
    )
    return {
      sent: false,
      reason: "Email provider not configured (set RESEND_API_KEY)",
    }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[email] Resend API error (${res.status}):`, text)
      return {
        sent: false,
        reason: `Resend API error: ${res.status}`,
      }
    }

    const data = (await res.json()) as { id?: string }
    return {
      sent: true,
      messageId: data.id,
    }
  } catch (error) {
    console.error("[email] sendEmail error:", error)
    return {
      sent: false,
      reason: String(error),
    }
  }
}

/**
 * Send a "result published" notification email to a participant.
 * Non-blocking — returns `{ sent: false }` if email isn't configured.
 */
export async function sendResultPublishedEmail(params: {
  to: string
  participantName: string
  eventTitle: string
  score?: number | null
  percentage?: number | null
  resultUrl: string
}): Promise<SendEmailResult> {
  const { participantName, eventTitle, percentage, resultUrl } = params
  const scoreText =
    percentage != null ? `<p style="margin:0;font-size:32px;font-weight:700;color:#10b981;">${percentage}%</p>` : ""

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#10b981,#14b8a6);padding:24px;border-radius:12px 12px 0 0;color:white;">
      <h1 style="margin:0;font-size:22px;">Result Published ✓</h1>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px;color:#475569;">Hello ${escapeHtml(participantName)},</p>
      <p style="margin:0 0 16px;color:#475569;">Your result for <strong style="color:#0f172a;">${escapeHtml(eventTitle)}</strong> is now available.</p>
      ${scoreText}
      <a href="${escapeHtml(resultUrl)}" style="display:inline-block;margin:24px 0 0;padding:12px 24px;background:#10b981;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View My Result</a>
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">If the button doesn't work, copy this URL: ${escapeHtml(resultUrl)}</p>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center;">Powered by QuizMaster Pro</p>
  </body>
</html>`

  return sendEmail({
    to: params.to,
    subject: `Your result for ${eventTitle} is now available`,
    html,
    text: `Hello ${participantName}, your result for ${eventTitle} is now available. View it at ${resultUrl}`,
  })
}

/**
 * Send a certificate issued notification email.
 */
export async function sendCertificateIssuedEmail(params: {
  to: string
  participantName: string
  eventTitle: string
  certificateNumber: string
  verifyUrl: string
}): Promise<SendEmailResult> {
  const { participantName, eventTitle, certificateNumber, verifyUrl } = params

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;">
    <div style="background:linear-gradient(135deg,#10b981,#14b8a6);padding:24px;border-radius:12px 12px 0 0;color:white;">
      <h1 style="margin:0;font-size:22px;">Certificate Issued 🎓</h1>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px;color:#475569;">Hello ${escapeHtml(participantName)},</p>
      <p style="margin:0 0 16px;color:#475569;">Congratulations! You've been issued a certificate for completing <strong style="color:#0f172a;">${escapeHtml(eventTitle)}</strong>.</p>
      <p style="margin:16px 0 4px;font-size:12px;color:#94a3b8;">Certificate Number</p>
      <p style="margin:0 0 16px;font-family:monospace;font-size:16px;color:#0f172a;">${escapeHtml(certificateNumber)}</p>
      <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;margin:8px 0 0;padding:12px 24px;background:#10b981;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View Certificate</a>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center;">Powered by QuizMaster Pro</p>
  </body>
</html>`

  return sendEmail({
    to: params.to,
    subject: `Your certificate for ${eventTitle} is ready`,
    html,
    text: `Hello ${participantName}, your certificate for ${eventTitle} (number: ${certificateNumber}) has been issued. Verify at ${verifyUrl}`,
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// ─── Compatibility for the admin storage-status endpoint ────────────────────

export interface EmailStatus {
  configured: boolean
  provider: "resend" | "none"
  fromAddress: string
}

export function getEmailStatus(): EmailStatus {
  return {
    configured: isEmailConfigured(),
    provider: isEmailConfigured() ? "resend" : "none",
    fromAddress: EMAIL_FROM,
  }
}
