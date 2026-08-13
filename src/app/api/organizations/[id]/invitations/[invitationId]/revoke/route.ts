import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveOrgMembership, auditLog } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string; invitationId: string }> };

/** POST /api/organizations/[id]/invitations/[invitationId]/revoke
 * Revokes a pending invitation. Only org admins (OWNER/ADMIN) can revoke.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id, invitationId } = await ctx.params;
    const result = await resolveOrgMembership(id, "ADMIN");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { ctx: tenantCtx } = result;

    const invitation = await db.organizationInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.organizationId !== id) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }
    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: `Invitation is already ${invitation.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    await db.organizationInvitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED" },
    });

    await auditLog(tenantCtx, "INVITATION_REVOKED", "Invitation", invitationId, {
      email: invitation.email,
      role: invitation.role,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
