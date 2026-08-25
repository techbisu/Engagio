import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { db } from "@/lib/db"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { sendVerificationEmail } from "@/lib/email"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || "http://localhost:3000"

/**
 * POST /api/auth/register
 *
 * Register a new user with email + password.
 * Sends a verification email with a unique link.
 * The user must click the link to verify before they can log in.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const ipCheck = await rateLimit(`register:ip:${ip}`, 5, 60_000)
    if (!ipCheck.allowed) {
      return NextResponse.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 })
    }

    const body = await req.json()
    const { email, password, name } = body as {
      email?: string
      password?: string
      name?: string
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 })
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Check if user already exists
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      if (existing.emailVerified) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 })
      }
      // User exists but not verified — resend verification
      // Update password in case they want to change it
      const passwordHash = await bcrypt.hash(password, 10)
      await db.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          name: name?.trim() || existing.name,
        },
      })

      // Generate new verification token
      const token = randomBytes(32).toString("hex")
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      await db.verificationToken.create({
        data: {
          identifier: normalizedEmail,
          token,
          expires,
        },
      })

      const verificationUrl = `${BASE_URL}/api/auth/verify-email?token=${token}`
      await sendVerificationEmail({
        to: normalizedEmail,
        name: name?.trim() || existing.name,
        verificationUrl,
      })

      return NextResponse.json({ message: "Verification email sent. Please check your inbox." })
    }

    // Create new user
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        name: name?.trim() || normalizedEmail.split("@")[0],
        passwordHash,
        role: "PARTICIPANT",
        emailVerified: null,
      },
    })

    // Generate verification token
    const token = randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    await db.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token,
        expires,
      },
    })

    const verificationUrl = `${BASE_URL}/api/auth/verify-email?token=${token}`
    await sendVerificationEmail({
      to: normalizedEmail,
      name: user.name,
      verificationUrl,
    })

    return NextResponse.json({ message: "Account created! Please check your email to verify your account." })
  } catch (error) {
    console.error("[POST /api/auth/register]", error)
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 })
  }
}
