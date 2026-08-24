import { enforceLimit, BODY_LIMITS } from "@/lib/body-limit";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { auditLog, type OrgRole } from "@/lib/tenant";
import { resolveOrgMembership } from "@/lib/org-api";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_ROLES: OrgRole[] = [
  "ADMIN",
  "EVENT_MANAGER",
  "MODERATOR",
  "EVALUATOR",
  "CHECKIN_STAFF",
  "PARTICIPANT",
];

/**
 * GET /api/organizations/[id]/members
 *
 * List all members with their user info. ADMIN+ only.
 *
 * NOTE: OrganizationMember doesn't define a `user` relation — fetch users
 * separately by userId.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const result = await resolveOrgMembership(id, "ADMIN");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const members = await db.organizationMember.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: "asc" },
    });

    // Fetch user info for all members (no relation on OrganizationMember).
    const userIds = members.map((m) => m.userId);
    const users = userIds.length
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      members: members.map((m) => {
        const user = userById.get(m.userId);
        return {
          id: m.id,
          userId: m.userId,
          role: m.role,
          status: m.status,
          createdAt: m.createdAt.toISOString(),
          user: user
            ? {
                name: user.name,
                email: user.email,
                image: user.image,
              }
            : { name: null, email: null, image: null },
        };
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/[id]/members
 *
 * Invite a new member. If the user already exists (by email), add them as an
 * ACTIVE member directly. Otherwise, create a PENDING invitation with a
 * random token + 7-day expiry. ADMIN+ only.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const result = await resolveOrgMembership(id, "ADMIN");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { ctx: tenantCtx, membership: callerMembership, org: orgRow } = result;

    // Soft-lock: a non-ACTIVE (SUSPENDED/ARCHIVED) org cannot invite members.
    if (orgRow && orgRow.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This organization is suspended and cannot invite members." },
        { status: 403 }
      );
    }

    const bodyResult = await enforceLimit(req, BODY_LIMITS.STANDARD);
  if (bodyResult.error) return bodyResult.error;
  const body = bodyResult.data;
    const { email, role } = body || {};

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const targetRole: OrgRole = typeof role === "string" ? (role as OrgRole) : "PARTICIPANT";
    if (!VALID_ROLES.includes(targetRole)) {
      return NextResponse.json(
        { error: "Invalid role. OWNER cannot be assigned via invitation." },
        { status: 400 }
      );
    }

    // Enforce the org's max_members plan limit before adding a new member
    // (Phase 7). Both the direct-add and the invitation paths consume a slot.
    const { checkPlanLimit } = await import("@/lib/entitlements");
    const check = await checkPlanLimit(tenantCtx, "member");
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: "This organization has reached its member limit. Ask the owner to upgrade.",
          code: "USAGE_LIMIT_EXCEEDED",
          limit: check.limit,
          current: check.current,
        },
        { status: 403 }
      );
    }

    // Rate limit invitation sends (per IP).
    const { rateLimit, getClientIp } = await import("@/lib/rate-limit");
    const rl = await rateLimit(`invite:${getClientIp(req)}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many invitations sent. Try again later." },
        { status: 429 }
      );
    }

    // Check if the user already exists by email.
    const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (existingUser) {
      // Check for existing membership (idempotent — return the existing one).
      const existingMembership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId: id, userId: existingUser.id },
        },
      });
      if (existingMembership) {
        return NextResponse.json(
          {
            error: "User is already a member of this organization",
            member: existingMembership,
          },
          { status: 409 }
        );
      }

      const created = await db.organizationMember.create({
        data: {
          organizationId: id,
          userId: existingUser.id,
          role: targetRole,
          status: "ACTIVE",
        },
      });

      await auditLog(tenantCtx, "MEMBER_INVITED", "Member", created.id, {
        email: normalizedEmail,
        role: targetRole,
        userId: existingUser.id,
        direct: true,
      });

      return NextResponse.json({ member: created, direct: true }, { status: 201 });
    }

    // Check for an existing PENDING invitation (idempotent — return it).
    const existingInvitation = await db.organizationInvitation.findFirst({
      where: { organizationId: id, email: normalizedEmail, status: "PENDING" },
    });
    if (existingInvitation) {
      return NextResponse.json(
        { error: "An invitation is already pending for this email", invitation: existingInvitation },
        { status: 409 }
      );
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await db.organizationInvitation.create({
      data: {
        organizationId: id,
        email: normalizedEmail,
        role: targetRole,
        status: "PENDING",
        token,
        invitedBy: callerMembership?.userId ?? tenantCtx.userId,
        expiresAt,
      },
    });

    await auditLog(tenantCtx, "MEMBER_INVITED", "Invitation", invitation.id, {
      email: normalizedEmail,
      role: targetRole,
      direct: false,
    });

    return NextResponse.json({ invitation, direct: false }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
