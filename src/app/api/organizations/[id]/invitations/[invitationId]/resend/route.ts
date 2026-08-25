import { NextRequest, NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireOrgRole, auditLog } from "@/lib/tenant";
import { sendInvitationEmail } from "@/lib/email";
import { withErrorHandling } from "@/lib/api-error";

type RouteContext = { params: Promise<{ id: string; invitationId: string }> };

/** POST /api/organizations/[id]/invitations/[invitationId]/resend
 * Resends the invitation email and resets the expiry. Only org admins can resend.
 */
export const POST = withErrorHandling(async (req: NextRequest, ctx: RouteContext) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, invitationId } = await ctx.params;
  const result = await requireOrgRole(req, "ADMIN");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const tenantCtx = result;

  const invitation = await db.organizationInvitation.findUnique({
    where: { id: invitationId },
  });
  if (!invitation || invitation.organizationId !== id) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (invitation.status === "ACCEPTED") {
    return NextResponse.json(
      { error: "Invitation has already been accepted" },
      { status: 400 }
    );
  }

  // Reset expiry to 7 days from now and set status back to PENDING
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + 7);

  const updated = await db.organizationInvitation.update({
    where: { id: invitationId },
    data: { status: "PENDING", expiresAt: newExpiry },
  });

  const inviteUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/invite/${invitation.token}`;
  const inviterName =
    (session.user as { name?: string | null }).name ||
    session.user.email ||
    undefined;

  await auditLog(tenantCtx, "INVITATION_RESENT", "Invitation", invitationId, {
    email: invitation.email,
  });

  void sendInvitationEmail({
    to: invitation.email,
    organizationName: tenantCtx.orgName,
    role: invitation.role,
    inviteUrl,
    invitedBy: inviterName,
    expiresInDays: 7,
  })
    .then((emailResult) => {
      if (!emailResult.sent) {
        console.warn(
          `[invitations/resend] email not sent (${emailResult.reason}) for invitation ${invitationId}`,
        );
      }
    })
    .catch((error) => {
      console.error(`[invitations/resend] email queue failed for invitation ${invitationId}`, error);
    });

  return NextResponse.json({
    invitation: updated,
    email: {
      queued: true,
    },
  });
});
