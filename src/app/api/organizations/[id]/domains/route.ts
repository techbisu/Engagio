import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/tenant";
import { resolveOrgMembership } from "@/lib/org-api";
import { hasFeature } from "@/lib/entitlements";
import { checkUsageLimit } from "@/lib/usage";
import {
  generateDomainVerificationToken,
  getDnsInstructions,
} from "@/lib/urls";
import { validate, addDomainSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/organizations/[id]/domains
 *
 * List all domains for the org (subdomains + custom domains). ADMIN+ only.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const result = await resolveOrgMembership(id, "ADMIN");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const domains = await db.organizationDomain.findMany({
      where: { organizationId: id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    // Synthesize the org's subdomain ({slug}.engagio.app) if it isn't already
    // stored in OrganizationDomain. Subdomains are always ACTIVE for ACTIVE orgs
    // — there's no DNS verification step for them.
    const BASE_DOMAIN = process.env.BASE_DOMAIN || "engagio.app";
    const org = await db.organization.findUnique({
      where: { id },
      select: { slug: true, status: true },
    });
    const subdomainDomain = org ? `${org.slug}.${BASE_DOMAIN}` : null;
    const hasSubdomainRow = domains.some((d) => d.type === "SUBDOMAIN");

    const domainsDto = domains.map((d) => ({
      id: d.id,
      domain: d.domain,
      type: d.type,
      isPrimary: d.isPrimary,
      status: d.status,
      verifiedAt: d.verifiedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    }));

    if (subdomainDomain && !hasSubdomainRow) {
      domainsDto.unshift({
        id: `subdomain:${org!.slug}`,
        domain: subdomainDomain,
        type: "SUBDOMAIN",
        isPrimary: true,
        status: org?.status === "ACTIVE" ? "ACTIVE" : "PENDING",
        verifiedAt: null,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ domains: domainsDto });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/[id]/domains
 *
 * Add a custom domain. OWNER only.
 *
 * Flow:
 *   1. Validate the domain format with addDomainSchema.
 *   2. Check hasFeature("custom_domain") — paid plans only.
 *   3. Check checkUsageLimit("custom_domains").
 *   4. Verify the domain isn't already taken by another org (globally unique).
 *   5. Generate a verification token + create the OrganizationDomain with
 *      type=CUSTOM_DOMAIN, status=PENDING.
 *   6. Return the domain + verificationToken + DNS instructions for the customer.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const result = await resolveOrgMembership(id, "OWNER");
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { ctx: tenantCtx } = result;

    const body = await req.json().catch(() => ({}));
    const parsed = validate(addDomainSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { domain } = parsed.data;

    // 1) Feature gate: custom domains are only on paid plans.
    const allowed = await hasFeature(tenantCtx, "custom_domain");
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Custom domains are available on paid plans. Upgrade to add a custom domain.",
          code: "FEATURE_NOT_AVAILABLE",
        },
        { status: 403 }
      );
    }

    // 2) Usage limit check (max_custom_domains).
    const usageCheck = await checkUsageLimit(tenantCtx, "custom_domains");
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error:
            usageCheck.reason ??
            "Custom domain limit reached. Upgrade to add more.",
          code: "USAGE_LIMIT_EXCEEDED",
        },
        { status: 403 }
      );
    }

    // 3) Global uniqueness — domain is @unique across all orgs.
    const existing = await db.organizationDomain.findUnique({
      where: { domain },
      select: { id: true, organizationId: true, status: true },
    });
    if (existing) {
      if (existing.organizationId === id) {
        return NextResponse.json(
          {
            error: "This domain is already added to your organization.",
            code: "DOMAIN_ALREADY_ADDED",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error:
            "This domain is already in use by another organization. Choose a different domain.",
          code: "DOMAIN_TAKEN",
        },
        { status: 409 }
      );
    }

    // 4) Create the domain with a verification token.
    const verificationToken = generateDomainVerificationToken();
    const created = await db.organizationDomain.create({
      data: {
        organizationId: id,
        domain,
        type: "CUSTOM_DOMAIN",
        status: "PENDING",
        verificationToken,
        isPrimary: false,
      },
    });

    const dnsInstructions = getDnsInstructions(domain, verificationToken);

    await auditLog(tenantCtx, "DOMAIN_ADDED", "Domain", created.id, {
      domain,
      type: "CUSTOM_DOMAIN",
    });

    return NextResponse.json(
      {
        domain: {
          id: created.id,
          domain: created.domain,
          type: created.type,
          status: created.status,
          isPrimary: created.isPrimary,
          createdAt: created.createdAt.toISOString(),
        },
        verificationToken,
        dnsInstructions,
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
