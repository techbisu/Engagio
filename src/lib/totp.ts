/**
 * TOTP (Time-based One-Time Password) utilities for Super Admin 2FA.
 *
 * Uses the standard TOTP algorithm (RFC 6238) compatible with Google
 * Authenticator, Microsoft Authenticator, Authy, 1Password, etc.
 *
 * otplib v13 API:
 *   - generateSync({ secret, ...options }) → string (6-digit code)
 *   - verifySync({ secret, token, ...options }) → { valid: boolean, delta?: number }
 *   - generateSecret() → base32 string
 *
 * Flow:
 *   1. Super admin goes to /?view=superadmin-security (after first password login)
 *   2. generateTotpSecret() → base32 secret
 *   3. buildTotpUri() → otpauth:// URI
 *   4. generateTotpQrCode() → QR code data URL
 *   5. User scans the QR code in their authenticator app
 *   6. User enters the 6-digit code from their app
 *   7. verifyTotpToken(secret, code) → true/false
 *   8. If true → save totpSecret + totpEnabled=true to the user row
 */

import { generateSecret, generateSync, verifySync } from "otplib"

// ─── Configuration ─────────────────────────────────────────────────────────
// Standard TOTP settings (30s window, 6 digits, SHA-1) — matches Google
// Authenticator defaults.
const TOTP_OPTIONS = {
  // epochTolerance = 30 means: allow 1 step before/after current time
  // (each step is 30s, so 30s drift in either direction).
  epochTolerance: 30,
}

/** Generate a new random base32 secret (20 bytes / 32 base32 chars). */
export function generateTotpSecret(): string {
  return generateSecret()
}

/**
 * Build the otpauth:// URI that QR code generators expect.
 * Format: otpauth://totp/LABEL?secret=SECRET&issuer=ISSUER&period=30&digits=6
 */
export function buildTotpUri(opts: {
  secret: string
  email: string
  issuer?: string
}): string {
  const issuer = opts.issuer || "Engagio"
  const label = encodeURIComponent(`${issuer}:${opts.email}`)
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

/** Verify a 6-digit TOTP token against the stored secret. Returns true/false. */
export function verifyTotpToken(secret: string, token: string): boolean {
  if (!secret || !token) return false
  const clean = token.replace(/\s+/g, "").trim()
  if (!/^\d{6}$/.test(clean)) return false
  try {
    const result = verifySync({ token: clean, secret, ...TOTP_OPTIONS })
    // verifySync returns { valid: boolean, delta?: number }
    return (result as { valid: boolean }).valid === true
  } catch (e) {
    console.error("[totp] verifyTotpToken error:", e)
    return false
  }
}

/** Generate the current 6-digit TOTP token for a secret (for testing). */
export function generateCurrentToken(secret: string): string {
  return generateSync({ secret, ...TOTP_OPTIONS })
}

/**
 * Generate a QR code data URL for the otpauth:// URI.
 * Used to render the QR code in the super admin setup page.
 */
export async function generateTotpQrCode(otpauthUri: string): Promise<string> {
  const QRCode = await import("qrcode")
  return QRCode.toDataURL(otpauthUri, {
    width: 240,
    margin: 2,
    color: { dark: "#0f172a", light: "#ffffff" },
    errorCorrectionLevel: "M",
  })
}
