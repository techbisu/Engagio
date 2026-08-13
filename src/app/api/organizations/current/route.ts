import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, getOrCreateDefaultOrg } from "@/lib/tenant";
import { db } from "@/lib/db";

/**
 * GET /api/organizations/current
 *
 * Returns the current organization context — resolved from the `x-org-slug`
 * header (or `?org=slug` query, kept for backward compat with non-browser
 * API clients) falling back to the user's first membership.
 * If the user has no memberships, the Default Org is returned with
 * role=PARTICIPANT (read-only).
 *
 * NOTE: The Organization schema does not define a `plan` relation (just
 * `planId`), so we fetch the Plan by `planId` separately.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let org = await db.organization.findUnique({
      where: { id: ctx.orgId },
    });

    if (!org) {
      // Defensive — should never happen since ctx.orgId came from a valid
      // membership or the Default Org. Fall back to Default Org.
      const defaultOrg = await getOrCreateDefaultOrg();
      org = await db.organization.findUnique({
        where: { id: defaultOrg.id },
      });
    }
    if (!org) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Fetch the plan separately (no relation on Organization).
    const plan = org.planId
      ? await db.plan.findUnique({ where: { id: org.planId } })
      : null;

    return NextResponse.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      logoUrl: org.logoUrl,
      primaryColor: org.primaryColor,
      secondaryColor: org.secondaryColor,
      website: org.website,
      email: org.email,
      phone: org.phone,
      timezone: org.timezone,
      locale: org.locale,
      status: org.status,
      industry: org.industry,
      role: ctx.orgRole,
      planId: org.planId,
      plan: plan
        ? {
            name: plan.name,
            displayName: plan.displayName,
            limits: plan.limits,
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
