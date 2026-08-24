/**
 * Password utilities — bcrypt hashing + verification.
 * Used by org registration (to set password) + super admin login.
 *
 * Security: Uses crypto.randomBytes() for password generation (not Math.random).
 */
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"

/** Hash a plaintext password (min 6 chars). Returns bcrypt hash. */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters")
  }
  return bcrypt.hash(password, 10)
}

/** Verify a plaintext password against a bcrypt hash. */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

/** Generate a cryptographically secure random password (for super admin bootstrap). */
export function generateRandomPassword(length: number = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%"
  let result = ""
  for (let i = 0; i < length; i++) {
    // Use crypto.randomBytes for each character selection to avoid bias
    const idx = randomBytes(1)[0] % chars.length
    result += chars.charAt(idx)
  }
  return result
}
