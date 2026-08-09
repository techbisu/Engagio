/**
 * Reserved subdomains — cannot be used as organization slugs.
 * These are platform-level routes (app, api, admin, etc.)
 */

export const RESERVED_SLUGS = [
  "www",
  "app",
  "api",
  "admin",
  "platform",
  "dashboard",
  "auth",
  "login",
  "signup",
  "support",
  "help",
  "docs",
  "blog",
  "status",
  "mail",
  "smtp",
  "cdn",
  "static",
  "assets",
  "billing",
  "payments",
  "engagio",
  "localhost",
  "vercel",
  "cloudinary",
] as const

export function isReservedSlug(slug: string): boolean {
  const normalized = slug.toLowerCase().trim()
  return (RESERVED_SLUGS as readonly string[]).includes(normalized)
}

/**
 * Validate an organization slug:
 * - Lowercase
 * - URL-safe (a-z, 0-9, hyphens)
 * - No leading/trailing hyphens
 * - No consecutive hyphens
 * - Length 3-30
 * - Not reserved
 */
export function validateOrgSlug(slug: string): {
  valid: boolean
  error?: string
} {
  const normalized = slug.toLowerCase().trim()
  if (!normalized) return { valid: false, error: "Slug is required" }
  if (normalized.length < 3)
    return { valid: false, error: "Slug must be at least 3 characters" }
  if (normalized.length > 30)
    return { valid: false, error: "Slug must be 30 characters or less" }
  if (!/^[a-z0-9-]+$/.test(normalized))
    return { valid: false, error: "Slug can only contain lowercase letters, numbers, and hyphens" }
  if (normalized.startsWith("-") || normalized.endsWith("-"))
    return { valid: false, error: "Slug cannot start or end with a hyphen" }
  if (normalized.includes("--"))
    return { valid: false, error: "Slug cannot contain consecutive hyphens" }
  if (isReservedSlug(normalized))
    return { valid: false, error: "This slug is reserved. Please choose another." }
  return { valid: true }
}

/**
 * Generate a URL-safe slug from an organization name.
 * "ABC Medical Association" → "abc-medical-association"
 */
export function slugifyOrgName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30)
}
