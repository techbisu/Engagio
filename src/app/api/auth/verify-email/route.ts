import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * GET /api/auth/verify-email?token=xxx
 *
 * Verifies the email address by consuming the verification token.
 * Redirects to /login with a success or error message.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.redirect(new URL("/login?error=missing_token", req.url))
    }

    // Find the verification token
    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken) {
      return NextResponse.redirect(new URL("/login?error=invalid_token", req.url))
    }

    // Check if token has expired
    if (new Date() > verificationToken.expires) {
      // Clean up expired token
      await db.verificationToken.delete({ where: { token } })
      return NextResponse.redirect(new URL("/login?error=token_expired", req.url))
    }

    // Mark the user's email as verified
    const user = await db.user.findUnique({
      where: { email: verificationToken.identifier },
    })

    if (!user) {
      await db.verificationToken.delete({ where: { token } })
      return NextResponse.redirect(new URL("/login?error=user_not_found", req.url))
    }

    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    })

    // Delete the used token
    await db.verificationToken.delete({ where: { token } })

    return NextResponse.redirect(new URL("/login?verified=true", req.url))
  } catch (error) {
    console.error("[GET /api/auth/verify-email]", error)
    return NextResponse.redirect(new URL("/login?error=verification_failed", req.url))
  }
}
