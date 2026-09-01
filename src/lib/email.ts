/**
 * Email service for Engagio.
 *
 * - All emails go through this module so the provider can be swapped without
 *   changing application code. Current provider: Resend (direct REST API).
 * - Email is NEVER a hard dependency for business logic — when RESEND_API_KEY
 *   is missing or a send fails, `sendEmail` returns `{ sent: false, ... }`
 *   and the caller can continue.
 * - Sends are non-blocking (fire-and-forget encouraged) but the underlying
 *   fetch uses AbortController + per-attempt timeout + light retry so a
 *   slow / flapping provider doesn't hang any caller.
 *
 * Env vars:
 *   RESEND_API_KEY  — Resend API key (optional, but recommended in prod)
 *   EMAIL_FROM      — From address (default: noreply@engagio.app)
 *   EMAIL_REPLY_TO  — Optional Reply-To header
 *   EMAIL_TIMEOUT_MS — Per-attempt HTTP timeout (default 8000)
 *   EMAIL_RETRY     — Retry attempts on network / 5xx (default 1)
 */

export interface SendEmailAttachment {
  filename: string
  content: string // base64
  type?: string
  disposition?: "attachment" | "inline"
}

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  /** Plain-text fallback. Auto-generated from html if not provided. */
  text?: string
  /** Optional Reply-To header. Falls back to EMAIL_REPLY_TO env. */
  replyTo?: string
  /** Optional attachments (base64-encoded). */
  attachments?: SendEmailAttachment[]
  /** Tag used for analytics in the Resend dashboard. */
  tag?: string
}

export type EmailFailureReason =
  | "EMAIL_NOT_CONFIGURED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR"
  | "RATE_LIMITED"
  | "INVALID_RECIPIENT"
  | "UNKNOWN"

export interface SendEmailResult {
  sent: boolean
  reason?: EmailFailureReason | string
  messageId?: string
  /** When true, caller may safely retry (transient failure). */
  retryable?: boolean
}

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || "Engagio <noreply@engagio.app>"
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO
const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS || 8000)
const EMAIL_RETRY = Math.max(0, Number(process.env.EMAIL_RETRY ?? 1))
const EMAIL_API_BASE = "https://api.resend.com"

/** Hard cap so a misconfigured env can't make the request hang. */
const MAX_TIMEOUT_MS = 15_000

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY
}

/**
 * Send an email via Resend. Async, with timeout + retry. Always resolves
 * with a structured `SendEmailResult` — never throws.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    console.warn(
      `[email] RESEND_API_KEY not configured — skipping email to ${formatRecipients(input.to)} (subject: "${input.subject}")`
    )
    return {
      sent: false,
      reason: "EMAIL_NOT_CONFIGURED",
      retryable: false,
    }
  }

  const recipients = normalizeRecipients(input.to)
  if (recipients.length === 0) {
    return {
      sent: false,
      reason: "INVALID_RECIPIENT",
      retryable: false,
    }
  }

  const payload = {
    from: EMAIL_FROM,
    to: recipients,
    subject: input.subject,
    html: input.html,
    text: input.text ?? htmlToPlainText(input.html),
    ...(input.replyTo || EMAIL_REPLY_TO ? { reply_to: input.replyTo || EMAIL_REPLY_TO } : {}),
    ...(input.attachments && input.attachments.length > 0
      ? { attachments: input.attachments }
      : {}),
    ...(input.tag ? { tags: [{ name: input.tag }] } : {}),
  }

  const attempts = EMAIL_RETRY + 1
  let lastError: SendEmailResult | null = null

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await sendOnce(payload)
    if (result.sent) return result
    lastError = result
    if (result.retryable === false) return result
    if (attempt < attempts) {
      const backoff = Math.min(2_000, 250 * 2 ** (attempt - 1))
      await sleep(backoff)
    }
  }

  return (
    lastError ?? { sent: false, reason: "UNKNOWN" as EmailFailureReason, retryable: false }
  )
}

async function sendOnce(payload: unknown): Promise<SendEmailResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.min(MAX_TIMEOUT_MS, EMAIL_TIMEOUT_MS))

  try {
    const res = await fetch(`${EMAIL_API_BASE}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Engagio/1.0 (email-service)",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      // Disable Next.js fetch cache — we always want a live send.
      cache: "no-store",
    })

    if (!res.ok) {
      const bodyText = await safeReadText(res)
      console.error(`[email] Resend API error (${res.status}):`, bodyText)
      const retryable = res.status >= 500 || res.status === 429 || res.status === 408
      return {
        sent: false,
        reason: res.status === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR",
        retryable,
      }
    }

    const data = (await res.json()) as { id?: string }
    return {
      sent: true,
      messageId: data.id,
    }
  } catch (err) {
    const isAbort = (err as { name?: string })?.name === "AbortError"
    console.error("[email] sendEmail transport error:", err)
    return {
      sent: false,
      reason: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
      retryable: true,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 2_000)
  } catch {
    return ""
  }
}

/* ────────────────────────────────────────────────────────────────────────
   High-level helpers — each renders a professional HTML template
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Brand palette tokens reused across templates. Centralised so themes can be
 * adjusted in one place. Keep this in sync with the marketing site.
 */
const BRAND = {
  primary: "#6366f1", // indigo-500
  primaryDark: "#4f46e5", // indigo-600
  accent: "#10b981", // emerald-500
  text: "#0f172a",
  muted: "#475569",
  subtle: "#94a3b8",
  surface: "#ffffff",
  border: "#e2e8f0",
  bg: "#f8fafc",
  radius: "12px",
} as const

export interface EmailLayoutProps {
  preheader?: string
  title: string
  intro?: string
  /** Optional primary call to action rendered as a gradient button. */
  cta?: { label: string; url: string }
  bodyHtml: string
  /** Footer note overrides the default "Powered by Engagio" line. */
  footerNote?: string
}

export function renderEmailLayout(props: EmailLayoutProps): string {
  const { preheader = "", title, intro, cta, bodyHtml, footerNote } = props
  const safePreheader = escapeHtml(preheader)
  const safeTitle = escapeHtml(title)

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${BRAND.text};">
    <!-- Preheader (hidden preview text) -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:${BRAND.bg};line-height:1px;">
      ${safePreheader}
      ${safePreheader ? "‌" : ""}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
            <!-- Brand mark -->
            <tr>
              <td align="center" style="padding:0 0 16px 0;">
                <div style="display:inline-block;padding:8px 16px;background:white;border-radius:999px;border:1px solid ${BRAND.border};">
                  <span style="font-weight:700;font-size:14px;letter-spacing:-0.01em;background:linear-gradient(135deg,${BRAND.primary},${BRAND.accent});-webkit-background-clip:text;background-clip:text;color:transparent;">Engagio</span>
                </div>
              </td>
            </tr>
            <!-- Card -->
            <tr>
              <td style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:${BRAND.radius};overflow:hidden;">
                <!-- Gradient header -->
                <div style="background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDark});padding:28px 32px;color:white;">
                  <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.01em;line-height:1.3;">${safeTitle}</h1>
                </div>

                <div style="padding:28px 32px 8px 32px;">
                  ${intro ? `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.muted};">${escapeHtml(intro)}</p>` : ""}
                  ${bodyHtml}
                  ${
                    cta
                      ? `<div style="padding:24px 0 8px 0;text-align:center;">
                          <a href="${escapeHtml(cta.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDark});color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;letter-spacing:-0.01em;box-shadow:0 4px 14px rgba(99,102,241,0.35);">
                            ${escapeHtml(cta.label)}
                          </a>
                        </div>
                        <p style="margin:8px 0 24px 0;font-size:12px;line-height:1.5;color:${BRAND.subtle};text-align:center;word-break:break-all;">
                          Or copy and paste this link:<br />
                          <a href="${escapeHtml(cta.url)}" style="color:${BRAND.primary};text-decoration:underline;">${escapeHtml(cta.url)}</a>
                        </p>`
                      : ""
                  }
                </div>

                <!-- Footer -->
                <div style="background:${BRAND.bg};padding:16px 32px;border-top:1px solid ${BRAND.border};font-size:12px;line-height:1.5;color:${BRAND.subtle};text-align:center;">
                  ${escapeHtml(footerNote || "Powered by Engagio — events that engage.")}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 0 0 0;text-align:center;font-size:11px;color:${BRAND.subtle};">
                You are receiving this because someone used Engagio with this email address.<br />
                If this wasn't you, you can safely ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** A small reusable "stat tile" rendered inside the card body. */
export function statTileHtml(label: string, value: string, color: string = BRAND.primary): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px 0;border-collapse:separate;border-spacing:0;">
    <tr>
      <td style="padding:18px;background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:10px;text-align:center;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${BRAND.subtle};font-weight:600;">${escapeHtml(label)}</div>
        <div style="margin-top:6px;font-size:28px;font-weight:700;color:${color};line-height:1.2;">${escapeHtml(value)}</div>
      </td>
    </tr>
  </table>`
}

/* ────────────────────────────────────────────────────────────────────────
   Specific email helpers
   ──────────────────────────────────────────────────────────────────────── */

export async function sendResultPublishedEmail(params: {
  to: string
  participantName: string
  eventTitle: string
  score?: number | null
  percentage?: number | null
  resultUrl: string
}): Promise<SendEmailResult> {
  const { participantName, eventTitle, percentage, score, resultUrl } = params
  const scoreText = percentage != null ? statTileHtml("Your Score", `${percentage}%`, BRAND.accent) : ""
  const subText =
    score != null
      ? `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.muted};">You scored <strong style="color:${BRAND.text};">${score}</strong> correct answers. Well done!</p>`
      : ""

  const html = renderEmailLayout({
    preheader: `Your result for ${eventTitle} is now available`,
    title: "Your results are ready ✨",
    intro: `Hi ${participantName}, your result for <strong style="color:${BRAND.text};">${escapeHtml(
      eventTitle
    )}</strong> has been published. Review your performance below.`,
    bodyHtml: `${scoreText}${subText}`,
    cta: { label: "View My Result →", url: resultUrl },
  })

  return sendEmail({
    to: params.to,
    subject: `Your result for ${eventTitle} is now available`,
    html,
    text: `Hello ${participantName}, your result for ${eventTitle} is now available. View it at ${resultUrl}`,
    tag: "result-published",
  })
}

export async function sendCertificateIssuedEmail(params: {
  to: string
  participantName: string
  eventTitle: string
  certificateNumber: string
  verifyUrl: string
}): Promise<SendEmailResult> {
  const { participantName, eventTitle, certificateNumber, verifyUrl } = params

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.muted};">
      Congratulations on completing <strong style="color:${BRAND.text};">${escapeHtml(
        eventTitle
      )}</strong>. Your official certificate has been issued and is ready to download or share.
    </p>
    ${statTileHtml("Certificate Number", certificateNumber, BRAND.primary)}
  `

  const html = renderEmailLayout({
    preheader: `Your certificate for ${eventTitle} is ready`,
    title: "Certificate Issued 🎓",
    intro: `Hi ${participantName}, great work — you've earned it.`,
    bodyHtml,
    cta: { label: "View Certificate →", url: verifyUrl },
  })

  return sendEmail({
    to: params.to,
    subject: `Your certificate for ${eventTitle} is ready`,
    html,
    text: `Hello ${participantName}, your certificate for ${eventTitle} (number: ${certificateNumber}) has been issued. Verify at ${verifyUrl}`,
    tag: "certificate-issued",
  })
}

/**
 * Send an organization invitation email.
 * Replace the inline HTML previously embedded in the resend route.
 */
export async function sendInvitationEmail(params: {
  to: string
  organizationName: string
  role: string
  inviteUrl: string
  invitedBy?: string
  expiresInDays?: number
}): Promise<SendEmailResult> {
  const { to, organizationName, role, inviteUrl, invitedBy, expiresInDays = 7 } = params

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.muted};">
      ${invitedBy ? `<strong style="color:${BRAND.text};">${escapeHtml(invitedBy)}</strong> has invited you` : "You've been invited"} to join
      <strong style="color:${BRAND.text};">${escapeHtml(organizationName)}</strong> on Engagio as
      <strong style="color:${BRAND.text};">${escapeHtml(role)}</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px 0;border-collapse:separate;border-spacing:0;">
      <tr>
        <td style="padding:16px 18px;background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:10px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${BRAND.subtle};font-weight:600;">Organization</div>
          <div style="margin-top:4px;font-size:16px;font-weight:600;color:${BRAND.text};">${escapeHtml(organizationName)}</div>
          <div style="margin-top:12px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${BRAND.subtle};font-weight:600;">Role</div>
          <div style="margin-top:4px;font-size:16px;font-weight:600;color:${BRAND.primary};">${escapeHtml(role)}</div>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:${BRAND.subtle};">
      This invitation will expire in <strong>${expiresInDays} days</strong>.
    </p>
  `

  const html = renderEmailLayout({
    preheader: `You've been invited to ${organizationName} on Engagio`,
    title: "You're invited 🤝",
    intro: `Join your team on Engagio to start running events, quizzes, and live sessions.`,
    bodyHtml,
    cta: { label: "Accept Invitation →", url: inviteUrl },
  })

  return sendEmail({
    to,
    subject: `Invitation to join ${organizationName} on Engagio`,
    html,
    text: `You've been invited to join ${organizationName} on Engagio as ${role}. Accept the invitation at ${inviteUrl}. This invitation expires in ${expiresInDays} days.`,
    tag: "org-invitation",
  })
}

export async function sendVerificationEmail(params: {
  to: string
  name?: string | null
  verificationUrl: string
  expiresInHours?: number
}): Promise<SendEmailResult> {
  const { to, name, verificationUrl, expiresInHours = 24 } = params
  const displayName = name || to.split("@")[0]

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.muted};">
      Hi <strong style="color:${BRAND.text};">${escapeHtml(displayName)}</strong>,
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.muted};">
      Thanks for signing up for Engagio! Please verify your email address by clicking the button below.
    </p>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:${BRAND.subtle};">
      This verification link will expire in <strong>${expiresInHours} hours</strong>.
    </p>
  `

  const html = renderEmailLayout({
    preheader: "Verify your email address for Engagio",
    title: "Verify your email ✉️",
    intro: "Click the button below to verify your email and activate your account.",
    bodyHtml,
    cta: { label: "Verify Email →", url: verificationUrl },
  })

  return sendEmail({
    to,
    subject: "Verify your email — Engagio",
    html,
    text: `Hi ${displayName},

Please verify your email address by visiting: ${verificationUrl}

This link expires in ${expiresInHours} hours.

— The Engagio Team`,
    tag: "email-verification",
  })
}

export async function sendPasswordResetEmail(params: {
  to: string
  name?: string | null
  resetUrl: string
  expiresInHours?: number
}): Promise<SendEmailResult> {
  const { to, name, resetUrl, expiresInHours = 1 } = params
  const displayName = name || to.split("@")[0]

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.muted};">
      Hi <strong style="color:${BRAND.text};">${escapeHtml(displayName)}</strong>,
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.muted};">
      We received a request to reset your password. Click the button below to set a new password.
    </p>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:${BRAND.subtle};">
      This reset link will expire in <strong>${expiresInHours} hour</strong>.
    </p>
    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:${BRAND.subtle};">
      If you didn't request this, you can safely ignore this email.
    </p>
  `

  const html = renderEmailLayout({
    preheader: "Reset your Engagio password",
    title: "Reset your password 🔑",
    intro: "Click the button below to set a new password for your account.",
    bodyHtml,
    cta: { label: "Reset Password →", url: resetUrl },
  })

  return sendEmail({
    to,
    subject: "Reset your password — Engagio",
    html,
    text: `Hi ${displayName},\n\nReset your password by visiting: ${resetUrl}\n\nThis link expires in ${expiresInHours} hour.\n\nIf you didn't request this, ignore this email.\n\n— The Engagio Team`,
    tag: "password-reset",
  })
}


/**
 * Send an "attempts reset" notification email to a participant.
 * Called when an admin resets a participant's quiz attempts so they can
 * retake the quiz.
 */
export async function sendAttemptResetEmail(params: {
  to: string
  participantName: string
  eventTitle: string
  quizUrl: string
  resetBy?: string
}): Promise<SendEmailResult> {
  const { to, participantName, eventTitle, quizUrl, resetBy } = params

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.muted};">
      Hi <strong style="color:${BRAND.text};">${escapeHtml(participantName)}</strong>,
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${BRAND.muted};">
      Good news! Your quiz attempts for <strong style="color:${BRAND.text};">${escapeHtml(eventTitle)}</strong>
      have been reset${resetBy ? ` by the organizer` : ""}. You can now retake the quiz.
    </p>
    ${statTileHtml("Quiz", escapeHtml(eventTitle), BRAND.primary)}
  `

  const html = renderEmailLayout({
    preheader: `Your quiz attempts for ${eventTitle} have been reset`,
    title: "Quiz Attempts Reset 🔄",
    intro: `Hi ${participantName}, you can now retake the quiz.`,
    bodyHtml,
    cta: { label: "Retake Quiz →", url: quizUrl },
  })

  return sendEmail({
    to,
    subject: `Your quiz attempts have been reset — ${eventTitle}`,
    html,
    text: `Hi ${participantName},\n\nYour quiz attempts for ${eventTitle} have been reset${resetBy ? " by the organizer" : ""}. You can now retake the quiz at: ${quizUrl}\n\n— The Engagio Team`,
    tag: "attempt-reset",
  })
}


/* ────────────────────────────────────────────────────────────────────────
   Utilities & status helpers
   ──────────────────────────────────────────────────────────────────────── */

export interface EmailStatus {
  configured: boolean
  provider: "resend" | "none"
  fromAddress: string
  replyTo: string | null
  timeoutMs: number
  retry: number
}

export function getEmailStatus(): EmailStatus {
  return {
    configured: isEmailConfigured(),
    provider: isEmailConfigured() ? "resend" : "none",
    fromAddress: EMAIL_FROM,
    replyTo: EMAIL_REPLY_TO ?? null,
    timeoutMs: Math.min(MAX_TIMEOUT_MS, EMAIL_TIMEOUT_MS),
    retry: EMAIL_RETRY,
  }
}

function normalizeRecipients(to: string | string[]): string[] {
  const raw = Array.isArray(to) ? to : [to]
  return raw
    .map((r) => r.trim())
    .filter((r) => r.length > 0 && isLikelyEmail(r))
}

function isLikelyEmail(s: string): boolean {
  // Lightweight check — Resend will do the strict validation.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function formatRecipients(to: string | string[]): string {
  const arr = Array.isArray(to) ? to : [to]
  return arr.length <= 3 ? arr.join(", ") : `${arr.slice(0, 2).join(", ")} +${arr.length - 2}`
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function htmlToPlainText(html: string): string {
  if (!html) return ""
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Keep the legacy helper available for older code paths.
export { escapeHtml as _escapeHtml }

// Re-export `tag` typing for consumers.
export type EmailTag = string
