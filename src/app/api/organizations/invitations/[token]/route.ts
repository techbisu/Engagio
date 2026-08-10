import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { auditLog, type TenantContext, type OrgRole } from "@/lib/tenant";

type RouteContext = { params: Promise<{ token: string }> };

/**
 * GET /api/organizations/invitations/[token]
 *
 * Fetch invitation details by token. Public (any caller, including
 * unauthenticated). Returns 404 if not found, 410 if expired/accepted/cancelled.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;
    const invitation = await db.organizationInvitation.findUnique({
      where: { token },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });
    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // Compute the effective status (auto-EXPIRE if past expiry).
    let effectiveStatus = invitation.status;
    if (invitation.status === "PENDING" && invitation.expiresAt < new Date()) {
      effectiveStatus = "EXPIRED";
    }

    if (effectiveStatus === "EXPIRED") {
      return NextResponse.json(
        {
          error: "Invitation has expired",
          invitation: {
            id: invitation.id,
            organization: {
              name: invitation.organization.name,
              slug: invitation.organization.slug,
            },
            email: invitation.email,
            role: invitation.role,
            status: effectiveStatus,
            expiresAt: invitation.expiresAt.toISOString(),
          },
        },
        { status: 410 }
      );
    }
    if (effectiveStatus === "ACCEPTED") {
      return NextResponse.json(
        {
          error: "Invitation has already been accepted",
          invitation: {
            id: invitation.id,
            organization: {
              name: invitation.organization.name,
              slug: invitation.organization.slug,
            },
            email: invitation.email,
            role: invitation.role,
            status: effectiveStatus,
            acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
          },
        },
        { status: 410 }
      );
    }
    if (effectiveStatus === "CANCELLED") {
      return NextResponse.json(
        {
          error: "Invitation has been cancelled",
          invitation: {
            id: invitation.id,
            organization: {
              name: invitation.organization.name,
              slug: invitation.organization.slug,
            },
            email: invitation.email,
            role: invitation.role,
            status: effectiveStatus,
          },
        },
        { status: 410 }
      );
    }

    return NextResponse.json({
      id: invitation.id,
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        slug: invitation.organization.slug,
      },
      email: invitation.email,
      role: invitation.role,
      status: effectiveStatus,
      expiresAt: invitation.expiresAt.toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/invitations/[token]
 *
 * Accept the invitation. Authenticated. The current user's email must match
 * the invitation email. Creates the OrganizationMember with the invitation's
 * role, sets invitation.status=ACCEPTED + acceptedAt=now. Logs MEMBER_JOINED.
 */
export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invitation = await db.organizationInvitation.findUnique({
      where: { token },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });
    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.status === "ACCEPTED") {
      return NextResponse.json({ error: "Invitation has already been accepted" }, { status: 410 });
    }
    if (invitation.status === "CANCELLED") {
      return NextResponse.json({ error: "Invitation has been cancelled" }, { status: 410 });
    }
    if (invitation.expiresAt < new Date()) {
      // Mark as expired in the DB.
      await db.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
    }

    // The current user's email must match the invitation email.
    if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: "This invitation was sent to a different email address" },
        { status: 403 }
      );
    }

    // Idempotent — if already a member, just mark the invitation as accepted.
    const existing = await db.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: session.user.id,
        },
      },
    });

    let member = existing;
    await db.$transaction(async (tx) => {
      if (!existing) {
        member = await tx.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId: session.user.id,
            role: invitation.role as OrgRole,
            status: "ACTIVE",
          },
        });
      }
      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });
    });

    // Build a TenantContext for the audit log entry.
    const auditCtx: TenantContext = {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name ?? null,
      userRole: (session.user as any).role,
      orgId: invitation.organizationId,
      orgSlug: invitation.organization.slug,
      orgName: invitation.organization.name,
      orgRole: invitation.role as OrgRole,
      isPlatformAdmin: (session.user as any).role === "ADMIN",
    };
    await auditLog(auditCtx, "MEMBER_JOINED", "Member", member?.id ?? "", {
      email: invitation.email,
      role: invitation.role,
      invitationId: invitation.id,
    });

    return NextResponse.json({
      success: true,
      member,
      organization: invitation.organization,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
