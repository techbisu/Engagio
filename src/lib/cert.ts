import QRCode from "qrcode"

/**
 * Generate a human-readable certificate number.
 * Format: EVT-{YEAR}-{6-char-base32} e.g. EVT-2026-A8F42K
 * Uses unambiguous characters (no 0/O/1/I).
 */
export function generateCertificateNumber(): string {
  const year = new Date().getFullYear()
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let random = ""
  for (let i = 0; i < 6; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `EVT-${year}-${random}`
}

/**
 * Generate a 32-char hex verification token for the public verify URL.
 * This is separate from the certificate number for security — the token
 * is long and unguessable, while the number is human-readable.
 */
export function generateVerificationToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Generate a QR code as a base64 data URL pointing to the verification URL.
 * The QR contains ONLY the public URL — no sensitive data.
 */
export async function generateQrCodeDataUrl(
  verificationUrl: string
): Promise<string> {
  try {
    return await QRCode.toDataURL(verificationUrl, {
      width: 200,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
  } catch (e) {
    console.error("[generateQrCodeDataUrl] error:", e)
    // Fallback: empty transparent PNG
    return "data:image/png;base64,iVBORw0KGgo="
  }
}

/**
 * Build the public verification URL for a certificate token.
 * Uses the origin from the request headers (works on Vercel).
 */
export function buildVerificationUrl(
  req: Request | { headers: { get: (k: string) => string | null } },
  token: string
): string {
  // Prefer x-forwarded-proto + host (Vercel/proxy)
  const proto =
    req.headers.get("x-forwarded-proto") ||
    req.headers.get("x-real-protocol") ||
    "https"
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000"
  return `${proto}://${host}/?verify=${token}`
}
