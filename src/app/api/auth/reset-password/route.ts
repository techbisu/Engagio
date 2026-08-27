import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

/**
 * POST /api/auth/reset-password
 * Validates the reset token and updates the password.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = await rateLimit(`reset-pw:${ip}`, 10, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 })
    }

    const body = await req.json()
    const { token, password } = body as { token?: string; password?: string }

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Reset token is required." }, { status: 400 })
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
    }

    // Find the reset token
    const resetToken = await db.verificationToken.findUnique({ where: { token } })
    if (!resetToken) {
      return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 })
    }

    // Check expiration
    if (new Date() > resetToken.expires) {
      await db.verificationToken.delete({ where: { token } })
      return NextResponse.json({ error: "Reset link has expired. Please request a new one." }, { status: 400 })
    }

    // Find the user
    const user = await db.user.findUnique({ where: { email: resetToken.identifier } })
    if (!user) {
      await db.verificationToken.delete({ where: { token } })
      return NextResponse.json({ error: "User not found." }, { status: 400 })
    }

    // Hash the new password and update
    const passwordHash = await bcrypt.hash(password, 10)
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    // Delete the used token
    await db.verificationToken.delete({ where: { token } })

    return NextResponse.json({ message: "Password reset successful. You can now log in." })
  } catch (error) {
    console.error("[POST /api/auth/reset-password]", error)
    return NextResponse.json({ error: "Failed to reset password." }, { status: 500 })
  }
}