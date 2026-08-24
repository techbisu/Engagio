import { enforceLimit, BODY_LIMITS } from "@/lib/body-limit";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyTotpToken } from "@/lib/totp";

/**
 * POST /api/auth/totp/disable
 * Disables TOTP for the current user. Requires the current TOTP code as
 * a safety check (so a compromised session can't disable 2FA without the
 * authenticator).
 *
 * Body: { token: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bodyResult = await enforceLimit(req, BODY_LIMITS.SMALL);
  if (bodyResult.error) return bodyResult.error;
  const body = bodyResult.data;
    const { token } = body as { token?: string };

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required to disable TOTP" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.totpEnabled || !user.totpSecret) {
      return NextResponse.json(
        { error: "TOTP is not enabled" },
        { status: 400 }
      );
    }

    const isValid = verifyTotpToken(user.totpSecret, token);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid TOTP code. TOTP was NOT disabled." },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: { totpSecret: null, totpEnabled: false },
    });
    return NextResponse.json({ disabled: true });
  } catch (e) {
    console.error("[POST /api/auth/totp/disable] error:", e);
    return NextResponse.json(
      { error: "Failed to disable TOTP" },
      { status: 500 }
    );
  }
}
