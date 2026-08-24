import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

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
    // Public endpoint — rate limit per IP so it can't be hammered to probe
    // which emails have TOTP / super admin status.
    const rl = await rateLimit(`totp-status:${getClientIp(req)}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email } = body as { email?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Only platform admin accounts (platformRole=SUPERADMIN in the DB) can
    // have TOTP. The DB field is authoritative — not the SUPERADMIN_EMAIL
    // env var. (Same disclosure as before: the endpoint already revealed
    // super-admin status for a given email.)
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { totpEnabled: true, platformRole: true },
    });

    const isSuper = user?.platformRole === "SUPERADMIN";
    if (!isSuper) {
      return NextResponse.json({
        totpRequired: false,
        isSuperAdmin: false,
        userExists: !!user,
      });
    }

    return NextResponse.json({
      totpRequired: !!user?.totpEnabled,
      isSuperAdmin: true,
      userExists: true,
    });
  } catch (e) {
    console.error("[POST /api/auth/totp/status] error:", e);
    return NextResponse.json(
      { error: "Failed to check TOTP status" },
      { status: 500 }
    );
  }
}
