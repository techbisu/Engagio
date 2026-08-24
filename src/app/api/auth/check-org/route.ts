import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth/check-org
 * Checks if a given email belongs to an existing organization member.
 * Used by the org login flow to determine whether to allow login or
 * redirect to registration.
 *
 * Body: { email: string }
 * Returns:
 *   { hasOrg: true, organizations: [{ id, name, slug, role }] }
 *   OR
 *   { hasOrg: false, message: "No organization found. Please register first." }
 *
 * This endpoint is PUBLIC (no auth required) so it can be called before
 * login. It only reveals org names/slugs the email belongs to — NOT any
 * sensitive data (passwords, etc.).
 */
export async function POST(req: NextRequest) {
  try {
    // Public endpoint — rate limit per IP so it can't be hammered to probe
    // which emails belong to an organization.
    const rl = await rateLimit(`check-org:${getClientIp(req)}`, 30, 60_000);
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

    // Find the user by email
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({
        hasOrg: false,
        userExists: false,
        message: "No account found with this email. Please register your organization first.",
      });
    }

    // Check for organization memberships
    const memberships = await db.organizationMember.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (memberships.length === 0) {
      return NextResponse.json({
        hasOrg: false,
        userExists: true,
        message: "No organization found for this email. Please register your organization first.",
      });
    }

    return NextResponse.json({
      hasOrg: true,
      userExists: true,
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        logoUrl: m.organization.logoUrl,
        status: m.organization.status,
      })),
    });
  } catch (e) {
    console.error("[POST /api/auth/check-org] error:", e);
    return NextResponse.json(
      { error: "Failed to check organization membership" },
      { status: 500 }
    );
  }
}
