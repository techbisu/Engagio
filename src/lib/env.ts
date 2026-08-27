/**
 * Production environment validation.
 *
 * Imported by db.ts so it runs once at server startup.
 * Fails fast with a clear message when required variables are missing.
 * Skips validation during build or when DATABASE_URL is not set.
 * Also skips when NEXTAUTH_SECRET is not set (e.g. during next build's
 * static page data collection phase where env vars may not be available).
 */
export function assertEnv(): void {
  if (process.env.NODE_ENV !== "production") return
  // During build, DATABASE_URL may not be set yet — skip validation.
  if (!process.env.DATABASE_URL) return
  // During next build's "collecting page data" phase, env vars may not
  // be fully loaded yet — skip if NEXTAUTH_SECRET is missing.
  if (!process.env.NEXTAUTH_SECRET) return

  const errors: string[] = []

  const dbUrl = process.env.DATABASE_URL
  if (dbUrl.startsWith("file:")) {
    errors.push(
      "DATABASE_URL must be a PostgreSQL connection string in production (SQLite is not allowed)"
    )
  }

  const nextAuthSecret = process.env.NEXTAUTH_SECRET || ""
  if (nextAuthSecret === "generate-with-openssl-rand-base64-32") {
    errors.push("NEXTAUTH_SECRET must be set to a real random value")
  }

  const encKey = process.env.PAYMENT_ENCRYPTION_KEY || ""
  if (
    encKey === "dev-encryption-key-change-in-production-32b" ||
    encKey === "change-me-to-a-random-string"
  ) {
    errors.push("PAYMENT_ENCRYPTION_KEY must be set to a real random value")
  }

  if (errors.length > 0) {
    throw new Error("Environment validation failed:\n - " + errors.join("\n - "))
  }
}
