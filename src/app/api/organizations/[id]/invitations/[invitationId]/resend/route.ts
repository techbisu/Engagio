import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveOrgMembership, auditLog } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string; invitationId: string }> };

/** POST /api/organizations/[id]/invitations/[invitationId]/resend
 * Resends the invitation email and resets the expiry. Only org admins can resend.
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

    // Best-effort: send invitation email via Resend (non-blocking)
    try {
      const { sendEmail } = await import("@/lib/email");
      const inviteUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/invite/${invitation.token}`;
      await sendEmail({
        to: invitation.email,
        subject: `Invitation to join ${tenantCtx.orgName} on Engagio`,
        html: `<p>You've been invited to join <strong>${tenantCtx.orgName}</strong> on Engagio as <strong>${invitation.role}</strong>.</p><p><a href="${inviteUrl}">Click here to accept the invitation</a></p><p>This invitation expires in 7 days.</p>`,
      });
    } catch {
      // Email send failed — don't fail the request
    }

    await auditLog(tenantCtx, "INVITATION_RESENT", "Invitation", invitationId, {
      email: invitation.email,
    });

    return NextResponse.json({ invitation: updated });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
