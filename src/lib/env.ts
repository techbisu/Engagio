/**
 * Production environment validation.
 *
 * Imported by db.ts so it runs once at server startup.
 * Fails fast with a clear message when required variables are missing.
 * Skips validation during build or when DATABASE_URL is not set.
 */
export function assertEnv(): void {
  if (process.env.NODE_ENV !== "production") return
  // During build, DATABASE_URL may not be set yet — skip validation.
  if (!process.env.DATABASE_URL) return

  const errors: string[] = []

  const dbUrl = process.env.DATABASE_URL
  if (dbUrl.startsWith("file:")) {
    errors.push(
      "DATABASE_URL must be a PostgreSQL connection string in production (SQLite is not allowed)"
    )
  }

  const nextAuthSecret = process.env.NEXTAUTH_SECRET || ""
  if (!nextAuthSecret || nextAuthSecret === "generate-with-openssl-rand-base64-32") {
    errors.push("NEXTAUTH_SECRET must be set to a real random value")
  }

  if (!process.env.SUPERADMIN_EMAIL) {
    errors.push("SUPERADMIN_EMAIL must be set")
  }

  const encKey = process.env.PAYMENT_ENCRYPTION_KEY || ""
  if (
    !encKey ||
    encKey === "dev-encryption-key-change-in-production-32b" ||
    encKey === "change-me-to-a-random-string"
  ) {
    errors.push("PAYMENT_ENCRYPTION_KEY must be set to a real random value")
  }

  if (errors.length > 0) {
    throw new Error("Environment validation failed:\n - " + errors.join("\n - "))
  }
}
