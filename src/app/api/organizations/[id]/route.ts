import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/tenant";
import { resolveOrgMembership } from "@/lib/org-api";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/organizations/[id]
 *
 * Returns org details + plan + member count. Requires membership in the org
 * (any role). Platform admins can view any org.
 *
 * NOTE: The Organization schema doesn't define a `plan` relation — the plan
 * is fetched by `planId` separately.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    // Any role is enough to view — pass PARTICIPANT as the minimum.
    const result = await resolveOrgMembership(id, "PARTICIPANT", {
      includePlan: true,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const memberCount = await db.organizationMember.count({
      where: { organizationId: id },
    });

    const { org } = result;
    return NextResponse.json({
      id: org!.id,
      name: org!.name,
      slug: org!.slug,
      description: org!.description,
      logoUrl: org!.logoUrl,
      logoPublicId: org!.logoPublicId,
      primaryColor: org!.primaryColor,
      secondaryColor: org!.secondaryColor,
      website: org!.website,
      email: org!.email,
      phone: org!.phone,
      timezone: org!.timezone,
      locale: org!.locale,
      status: org!.status,
      industry: org!.industry,
      planId: org!.planId,
      plan: org!.plan
        ? {
            name: org!.plan.name,
            displayName: org!.plan.displayName,
            limits: org!.plan.limits,
          }
        : null,
      memberCount,
      createdAt: org!.createdAt,
      updatedAt: org!.updatedAt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** PATCH /api/organizations/[id] — update org fields (ADMIN+ only). */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const result = await resolveOrgMembership(id, "ADMIN", { includePlan: true });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { ctx: tenantCtx } = result;

    const body = await req.json().catch(() => ({}));
    const {
      name,
      description,
      logoUrl,
      logoPublicId,
      website,
      email,
      phone,
      primaryColor,
      secondaryColor,
      timezone,
      locale,
      industry,
    } = body || {};

    // Build the update payload — only allow known + valid fields.
    const data: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (typeof description === "string") data.description = description.trim() || null;
    if (typeof logoUrl === "string") data.logoUrl = logoUrl || null;
    if (typeof logoPublicId === "string") data.logoPublicId = logoPublicId || null;
    if (typeof website === "string") data.website = website || null;
    if (typeof email === "string") data.email = email || null;
    if (typeof phone === "string") data.phone = phone || null;
    if (typeof primaryColor === "string" && primaryColor.trim()) data.primaryColor = primaryColor.trim();
    if (typeof secondaryColor === "string" && secondaryColor.trim()) data.secondaryColor = secondaryColor.trim();
    if (typeof timezone === "string" && timezone.trim()) data.timezone = timezone.trim();
    if (typeof locale === "string" && locale.trim()) data.locale = locale.trim();
    if (typeof industry === "string") data.industry = industry.trim() || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await db.organization.update({
      where: { id },
      data,
    });

    await auditLog(tenantCtx, "ORGANIZATION_UPDATED", "Organization", id, {
      fields: Object.keys(data),
    });

    // Fetch the plan separately for the response.
    const plan = updated.planId
      ? await db.plan.findUnique({ where: { id: updated.planId } })
      : null;

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      logoUrl: updated.logoUrl,
      logoPublicId: updated.logoPublicId,
      primaryColor: updated.primaryColor,
      secondaryColor: updated.secondaryColor,
      website: updated.website,
      email: updated.email,
      phone: updated.phone,
      timezone: updated.timezone,
      locale: updated.locale,
      status: updated.status,
      industry: updated.industry,
      planId: updated.planId,
      plan: plan
        ? {
            name: plan.name,
            displayName: plan.displayName,
            limits: plan.limits,
          }
        : null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
