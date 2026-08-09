import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/tenant";
import { resolveOrgMembership } from "@/lib/org-api";

type RouteContext = { params: Promise<{ id: string; domainId: string }> };

/**
 * DELETE /api/organizations/[id]/domains/[domainId]
 *
 * Remove a domain (soft-delete). Sets status=DISABLED — we keep the row for
 * audit history and to prevent the same domain being re-added & re-verified
 * trivially by another org. OWNER only.
 *
 * Subdomains (type=SUBDOMAIN) cannot be removed — they are auto-managed.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext
) {
  try {
    const { id, domainId } = await ctx.params;
    const result = await resolveOrgMembership(id, "OWNER");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { ctx: tenantCtx } = result;

    const domain = await db.organizationDomain.findUnique({
      where: { id: domainId },
      select: { id: true, organizationId: true, type: true, domain: true, status: true },
    });

    if (!domain || domain.organizationId !== id) {
      return NextResponse.json(
        { error: "Domain not found", code: "DOMAIN_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (domain.type === "SUBDOMAIN") {
      return NextResponse.json(
        {
          error:
            "Subdomains are managed automatically and cannot be removed.",
          code: "CANNOT_REMOVE_SUBDOMAIN",
        },
        { status: 400 }
      );
    }

    if (domain.status === "DISABLED") {
      return NextResponse.json(
        { error: "Domain is already disabled.", code: "ALREADY_DISABLED" },
        { status: 409 }
      );
    }

    const updated = await db.organizationDomain.update({
      where: { id: domainId },
      data: {
        status: "DISABLED",
        isPrimary: false,
        lastCheckedAt: new Date(),
      },
    });

    await auditLog(tenantCtx, "DOMAIN_REMOVED", "Domain", domain.id, {
      domain: domain.domain,
    });

    return NextResponse.json({
      success: true,
      domain: {
        id: updated.id,
        domain: updated.domain,
        status: updated.status,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
