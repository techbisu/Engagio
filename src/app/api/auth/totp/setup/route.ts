import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateTotpSecret,
  buildTotpUri,
  generateTotpQrCode,
} from "@/lib/totp";

/**
 * GET /api/auth/totp/setup
 * Generates a new TOTP secret + QR code for the authenticated super admin.
 * The secret is NOT saved yet — the user must verify a code first
 * (POST /api/auth/totp/verify) before it's persisted to the DB.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only super admins can set up TOTP
    const isSuper = user.email.toLowerCase().trim() === (
      process.env.SUPERADMIN_EMAIL || "superadmin@engagio.app"
    ).toLowerCase().trim();
    if (!isSuper) {
      return NextResponse.json(
        { error: "TOTP is only available for super admin accounts" },
        { status: 403 }
      );
    }

    // If already enabled, return current status (don't regenerate)
    if (user.totpEnabled && user.totpSecret) {
      return NextResponse.json({
        enabled: true,
        message: "TOTP is already enabled. Disable it first to reconfigure.",
      });
    }

    // Generate a new secret (not yet saved)
    const secret = generateTotpSecret();
    const otpauthUri = buildTotpUri({
      secret,
      email: user.email,
      issuer: "Engagio Super Admin",
    });
    const qrCodeDataUrl = await generateTotpQrCode(otpauthUri);

    return NextResponse.json({
      enabled: false,
      secret,
      otpauthUri,
      qrCodeDataUrl,
    });
  } catch (e) {
    console.error("[GET /api/auth/totp/setup] error:", e);
    return NextResponse.json(
      { error: "Failed to generate TOTP setup", detail: String(e) },
      { status: 500 }
    );
  }
}
