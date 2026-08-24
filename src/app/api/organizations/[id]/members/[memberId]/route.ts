import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLog, type OrgRole } from "@/lib/tenant";
import { resolveOrgMembership } from "@/lib/org-api";

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

const VALID_ROLES: OrgRole[] = [
  "OWNER",
  "ADMIN",
  "EVENT_MANAGER",
  "MODERATOR",
  "EVALUATOR",
  "CHECKIN_STAFF",
  "PARTICIPANT",
];

/**
 * PATCH /api/organizations/[id]/members/[memberId]
 *
 * Change a member's role. ADMIN+ only.
 * - Don't allow changing the last OWNER to a non-owner role.
 * - Only OWNERs can promote/demote other OWNERs.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { id, memberId } = await ctx.params;
    const result = await resolveOrgMembership(id, "ADMIN");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { ctx: tenantCtx } = result;

    const body = await req.json().catch(() => ({}));
    const { role } = body || {};

    if (typeof role !== "string" || !VALID_ROLES.includes(role as OrgRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    const newRole = role as OrgRole;

    const member = await db.organizationMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.organizationId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Demoting an OWNER? Make sure they're not the last one.
    if (member.role === "OWNER" && newRole !== "OWNER") {
      const ownerCount = await db.organizationMember.count({
        where: { organizationId: id, role: "OWNER", status: "ACTIVE" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last OWNER of the organization" },
          { status: 400 }
        );
      }
    }

    // Promoting to OWNER? Only existing OWNERs may add new owners.
    if (newRole === "OWNER" && tenantCtx.orgRole !== "OWNER" && !tenantCtx.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Only owners can promote members to OWNER" },
        { status: 403 }
      );
    }

    const previousRole = member.role;
    const updated = await db.organizationMember.update({
      where: { id: memberId },
      data: { role: newRole },
    });

    await auditLog(tenantCtx, "MEMBER_ROLE_CHANGED", "Member", memberId, {
      previousRole,
      newRole,
      userId: member.userId,
    });

    return NextResponse.json({ member: updated });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organizations/[id]/members/[memberId]
 *
 * Remove a member. ADMIN+ only. Don't allow removing the last OWNER.
 */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id, memberId } = await ctx.params;
    const result = await resolveOrgMembership(id, "ADMIN");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { ctx: tenantCtx } = result;

    const member = await db.organizationMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.organizationId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.role === "OWNER") {
      const ownerCount = await db.organizationMember.count({
        where: { organizationId: id, role: "OWNER", status: "ACTIVE" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last OWNER of the organization" },
          { status: 400 }
        );
      }
    }

    await db.organizationMember.delete({ where: { id: memberId } });

    await auditLog(tenantCtx, "MEMBER_REMOVED", "Member", memberId, {
      userId: member.userId,
      role: member.role,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
