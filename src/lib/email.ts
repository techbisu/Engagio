/**
 * Email abstraction — provides a uniform interface for sending transactional
 * emails. Initially backed by Resend. If RESEND_API_KEY is not configured,
 * email sending is a no-op (logged) and result publishing still works.
 *
 * To migrate to another provider (SES, Postmark, SendGrid) later, implement
 * the same `sendEmail()` interface.
 *
 * Env vars (optional — if absent, emails are skipped):
 *   RESEND_API_KEY
 *   EMAIL_FROM (e.g. "QuizMaster Pro <noreply@eventra.app>")
 *   APP_URL (base URL for links in emails, e.g. https://eventra.app)
 */

import { Resend } from "resend"

const API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM || "QuizMaster Pro <noreply@quizmaster.pro>"
const APP_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

export const emailConfigured = !!API_KEY

const resend = API_KEY ? new Resend(API_KEY) : null

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  /** Optional plain-text fallback. If omitted, derived from html. */
  text?: string
}

export interface SendEmailResult {
  sent: boolean
  messageId?: string
  error?: string
  /** Which provider handled the email (or "skipped" if not configured). */
  provider: "resend" | "skipped"
}

/**
 * Send a transactional email. If Resend is not configured, logs the email
 * and returns `{ sent: false, provider: "skipped" }` — the caller can
 * continue (email is not a hard dependency for result publishing).
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[email] RESEND_API_KEY not configured — skipping email to ${params.to}:\n` +
          `Subject: ${params.subject}\n` +
          `Body: ${(params.text || params.html.replace(/<[^>]+>/g, "")).slice(0, 200)}...`
      )
    }
    return { sent: false, provider: "skipped" }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })

    if (error) {
      console.error("[email] Resend error:", error)
      return { sent: false, error: error.message, provider: "resend" }
    }

    return { sent: true, messageId: data?.id, provider: "resend" }
  } catch (e: any) {
    console.error("[email] sendEmail exception:", e)
    return { sent: false, error: e?.message || String(e), provider: "resend" }
  }
}

/**
 * Send a "result published" notification email to a participant.
 * The CTA links to the app's authenticated my-results page (not an
 * unsecured URL — the participant must log in to see their result).
 */
export async function sendResultPublishedEmail(params: {
  to: string
  participantName: string
  eventTitle: string
  score?: number | null
  percentage?: number | null
  passed?: boolean | null
}): Promise<SendEmailResult> {
  const { to, participantName, eventTitle, score, percentage, passed } = params
  const myResultsUrl = `${APP_URL}/?view=student`

  const scoreText =
    percentage != null
      ? `<p style="font-size: 18px; margin: 16px 0;"><strong>Score: ${percentage}%</strong>${
          passed != null
            ? passed
              ? " — Passed ✓"
              : " — Did not pass"
            : ""
        }</p>`
      : ""

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your result is published</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px;">Result Published ✓</h1>
  </div>
  <div style="background: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 12px;">Hello ${escapeHtml(participantName)},</p>
    <p style="margin: 0 0 12px;">Your result for <strong>${escapeHtml(eventTitle)}</strong> is now available.</p>
    ${scoreText}
    <p style="margin: 16px 0; color: #64748b; font-size: 14px;">
      You can view your detailed result, including per-question review and category analysis, in your dashboard.
    </p>
    <a href="${myResultsUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 8px;">
      View My Result
    </a>
    <p style="margin: 24px 0 0; color: #94a3b8; font-size: 12px;">
      You received this email because you attempted the ${escapeHtml(eventTitle)} assessment. If you believe this was sent in error, please ignore this email.
    </p>
  </div>
  <p style="text-align: center; color: #cbd5e1; font-size: 11px; margin-top: 16px;">
    Powered by QuizMaster Pro
  </p>
</body>
</html>
  `.trim()

  return sendEmail({
    to,
    subject: `Your result for ${eventTitle} is now available`,
    html,
    text: `Hello ${participantName}, your result for ${eventTitle} is now available.${
      percentage != null ? ` Score: ${percentage}%.` : ""
    } View it at ${myResultsUrl}`,
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

/**
 * Get the status of the email provider for admin display.
 */
export function getEmailStatus(): {
  configured: boolean
  provider: "resend" | "disabled"
  from?: string
} {
  return {
    configured: emailConfigured,
    provider: emailConfigured ? "resend" : "disabled",
    from: FROM,
  }
}
