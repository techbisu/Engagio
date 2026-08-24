import { NextRequest, NextResponse } from "next/server";
import { getServerSession, isDbPlatformAdmin } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { getPermissionsForRole, getAllPermissions } from "@/lib/permissions";

// Mirrors the role hierarchy in src/lib/tenant.ts. The admin panel + APIs are
// available to any org role at or above EVENT_MANAGER.
const MANAGE_LEVEL = 5; // EVENT_MANAGER
const ROLE_LEVEL: Record<string, number> = {
  OWNER: 7,
  ADMIN: 6,
  EVENT_MANAGER: 5,
  MODERATOR: 4,
  EVALUATOR: 3,
  CHECKIN_STAFF: 2,
  PARTICIPANT: 1,
};

export async function GET(req?: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // DB-backed (re-fetches User.platformRole per request).
    const isPlatformAdmin = await isDbPlatformAdmin(session);

    // Active org memberships drive org-level admin access. The legacy global
    // `role` field is no longer the gate for the admin panel.
    const memberships = await db.organizationMember.findMany({
      where: { userId: session.user.id, status: "ACTIVE" },
      select: {
        organizationId: true,
        role: true,
        organization: { select: { slug: true, name: true } },
      },
    });

    const canManageOrg =
      isPlatformAdmin ||
      memberships.some(
        (m) => (ROLE_LEVEL[m.role] ?? 0) >= MANAGE_LEVEL
      );

    // Effective permissions for the ACTIVE org (same resolution as the API
    // routes: `x-org-slug` header, else the first ACTIVE membership). These
    // drive the admin panel's tab + action-button visibility.
    const activeCtx = await getTenantContext(req);
    const activeRole = (activeCtx?.orgRole ?? "PARTICIPANT") as
      | "OWNER"
      | "ADMIN"
      | "EVENT_MANAGER"
      | "MODERATOR"
      | "EVALUATOR"
      | "CHECKIN_STAFF"
      | "PARTICIPANT";
    const permissions = isPlatformAdmin
      ? getAllPermissions()
      : getPermissionsForRole(activeRole);

    // Per-membership permissions, so the client can react instantly when the
    // user switches org without refetching /api/me.
    const permissionsByOrg: Record<string, string[]> = {};
    for (const m of memberships) {
      permissionsByOrg[m.organization.slug] = isPlatformAdmin
        ? getAllPermissions()
        : getPermissionsForRole(m.role as "OWNER" | "ADMIN" | "EVENT_MANAGER" | "MODERATOR" | "EVALUATOR" | "CHECKIN_STAFF" | "PARTICIPANT");
    }

    return NextResponse.json({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      role: session.user.role,
      isPlatformAdmin,
      canManageOrg,
      orgMemberships: memberships.map((m) => ({
        organizationId: m.organizationId,
        slug: m.organization.slug,
        name: m.organization.name,
        role: m.role,
      })),
      permissions,
      permissionsByOrg,
    });
  } catch (error) {
    console.error("[GET /api/me] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}
