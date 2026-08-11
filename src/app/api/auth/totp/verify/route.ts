import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyTotpToken } from "@/lib/totp";

/**
 * POST /api/auth/totp/verify
 * Verifies a 6-digit TOTP code against a pending secret and enables TOTP
 * for the user if the code is valid.
 *
 * Body:
 *   { secret: string, token: string }   — first-time setup verification
 *   { token: string }                   — login verification (uses stored secret)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { secret, token } = body as { secret?: string; token?: string };

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Case 1: First-time setup — verify against the pending secret, then save
    if (secret && typeof secret === "string") {
      const isValid = verifyTotpToken(secret, token);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid TOTP code. Please try again." },
          { status: 400 }
        );
      }
      // Save the secret + enable TOTP
      await db.user.update({
        where: { id: user.id },
        data: { totpSecret: secret, totpEnabled: true },
      });
      return NextResponse.json({
        enabled: true,
        message: "Two-factor authentication enabled successfully.",
      });
    }

    // Case 2: Login verification — use the stored secret
    if (!user.totpSecret || !user.totpEnabled) {
      return NextResponse.json(
        { error: "TOTP is not enabled for this account" },
        { status: 400 }
      );
    }
    const isValid = verifyTotpToken(user.totpSecret, token);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid TOTP code. Please try again." },
        { status: 400 }
      );
    }
    return NextResponse.json({ valid: true });
  } catch (e) {
    console.error("[POST /api/auth/totp/verify] error:", e);
    return NextResponse.json(
      { error: "Failed to verify TOTP", detail: String(e) },
      { status: 500 }
    );
  }
}
