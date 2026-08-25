import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { db } from "@/lib/db"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { sendPasswordResetEmail } from "@/lib/email"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || "http://localhost:3000"

/**
 * POST /api/auth/forgot-password
 * Sends a password reset email if the account exists.
 * Always returns success to prevent email enumeration.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = await rateLimit(`forgot-pw:${ip}`, 5, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ message: "If an account exists, a reset link has been sent." })
    }

    const body = await req.json()
    const { email } = body as { email?: string }

    if (!email || !/^[^s@]+@[^s@]+.[^s@]+$/.test(email.trim())) {
      // Always return success to prevent enumeration
      return NextResponse.json({ message: "If an account exists, a reset link has been sent." })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const user = await db.user.findUnique({ where: { email: normalizedEmail } })

    // Always return success — don't reveal whether the email exists
    if (!user) {
      return NextResponse.json({ message: "If an account exists, a reset link has been sent." })
    }

    // Only allow password reset for users who have a password (not Google-only)
    if (!user.passwordHash) {
      return NextResponse.json({ message: "If an account exists, a reset link has been sent." })
    }

    // Generate reset token
    const token = randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Delete any existing reset tokens for this email
    await db.verificationToken.deleteMany({ where: { identifier: normalizedEmail } })

    // Create new reset token
    await db.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token,
        expires,
      },
    })

    // Send reset email
    const resetUrl = `${BASE_URL}/reset-password?token=${token}`
    await sendPasswordResetEmail({
      to: normalizedEmail,
      name: user.name,
      resetUrl,
    })

    return NextResponse.json({ message: "If an account exists, a reset link has been sent." })
  } catch (error) {
    console.error("[POST /api/auth/forgot-password]", error)
    return NextResponse.json({ message: "If an account exists, a reset link has been sent." })
  }
}