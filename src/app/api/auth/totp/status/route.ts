import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isEmailSuperAdmin } from "@/lib/auth";

/**
 * POST /api/auth/totp/status
 * Checks if TOTP is required for a given email. Used by the super admin
 * login form to determine whether to show the TOTP code input step.
 *
 * Body: { email: string }
 * Returns: { totpRequired: boolean, isSuperAdmin: boolean }
 *
 * This endpoint is PUBLIC (no auth required) so it can be called before
 * login. It only reveals whether TOTP is enabled for the account — NOT
 * the secret or any sensitive data.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body as { email?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Only super admin accounts can have TOTP enabled
    const isSuper = isEmailSuperAdmin(normalizedEmail);
    if (!isSuper) {
      return NextResponse.json({ totpRequired: false, isSuperAdmin: false });
    }

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { totpEnabled: true },
    });

    return NextResponse.json({
      totpRequired: !!user?.totpEnabled,
      isSuperAdmin: true,
      userExists: !!user,
    });
  } catch (e) {
    console.error("[POST /api/auth/totp/status] error:", e);
    return NextResponse.json(
      { error: "Failed to check TOTP status" },
      { status: 500 }
    );
  }
}
