import { NextRequest, NextResponse } from "next/server";
import { promises as dns } from "dns";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/tenant";
import { resolveOrgMembership } from "@/lib/org-api";

type RouteContext = { params: Promise<{ id: string; domainId: string }> };

/**
 * POST /api/organizations/[id]/domains/[domainId]/verify
 *
 * Trigger DNS verification for a custom domain. OWNER only.
 *
 * Looks up TXT records at `_engagio-verify.{subdomain|@}` for the domain and
 * checks whether the stored `verificationToken` is present in any of the TXT
 * record values.
 *
 * On success: status=ACTIVE, verifiedAt=now. auditLog: DOMAIN_VERIFIED.
 * On failure: status=FAILED. Returns a clear "DNS record not found" message.
 *
 * DNS lookups from serverless can be unreliable / propagation-delayed, so we
 * wrap in try/catch and return actionable messages.
 *
 * Supports an optional `{ manual: true }` body to skip DNS for admin-forced
 * verification (useful for staging / testing).
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { id, domainId } = await ctx.params;
    const result = await resolveOrgMembership(id, "OWNER");
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    const { ctx: tenantCtx } = result;

    const domain = await db.organizationDomain.findUnique({
      where: { id: domainId },
      select: {
        id: true,
        organizationId: true,
        domain: true,
        type: true,
        status: true,
        verificationToken: true,
      },
    });

    if (!domain || domain.organizationId !== id) {
      return NextResponse.json(
        { error: "Domain not found", code: "DOMAIN_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (domain.type !== "CUSTOM_DOMAIN") {
      return NextResponse.json(
        { error: "Only custom domains require verification." },
        { status: 400 }
      );
    }

    if (domain.status === "ACTIVE") {
      return NextResponse.json({
        verified: true,
        status: "ACTIVE",
        message: "Domain is already verified and active.",
      });
    }

    if (!domain.verificationToken) {
      return NextResponse.json(
        {
          verified: false,
          status: domain.status,
          message:
            "No verification token is set for this domain. Remove and re-add it.",
        },
        { status: 400 }
      );
    }

    // Optional admin-forced manual verify (e.g. for testing / staging).
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const manual =
      !!body && typeof body === "object" && (body as { manual?: unknown }).manual === true;

    if (manual) {
      const updated = await db.organizationDomain.update({
        where: { id: domainId },
        data: {
          status: "ACTIVE",
          verifiedAt: new Date(),
          lastCheckedAt: new Date(),
        },
      });
      await auditLog(tenantCtx, "DOMAIN_VERIFIED", "Domain", updated.id, {
        domain: domain.domain,
        method: "manual",
      });
      return NextResponse.json({
        verified: true,
        status: "ACTIVE",
        message: "Domain manually verified by admin.",
      });
    }

    // Mark as VERIFYING while we check.
    await db.organizationDomain.update({
      where: { id: domainId },
      data: { status: "VERIFYING", lastCheckedAt: new Date() },
    });

    // Determine TXT record name. For subdomains like `events.example.com`,
    // the TXT record lives at `_engagio-verify.events.example.com`. For root
    // domains like `example.com`, it's `_engagio-verify.example.com`.
    const parts = domain.domain.split(".");
    const isSubdomain = parts.length > 2;
    const subdomainPart = isSubdomain ? parts[0] : "";
    const txtName = subdomainPart
      ? `_engagio-verify.${domain.domain}`
      : `_engagio-verify.${domain.domain}`;

    let found = false;
    let dnsError: string | null = null;

    try {
      const records = await dns.resolveTxt(txtName);
      // TXT records come back as string[][] (each record is split into chunks).
      const flattened = records
        .flat()
        .map((s) => String(s))
        .join("");
      found = flattened.includes(domain.verificationToken);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code;
      // ENODATA / ENOTFOUND = no record published yet — treat as "not verified".
      // Anything else is a transient DNS failure worth surfacing.
      if (code === "ENODATA" || code === "ENOTFOUND") {
        found = false;
      } else {
        dnsError = (e as Error)?.message ?? "DNS lookup failed";
      }
    }

    if (found) {
      const updated = await db.organizationDomain.update({
        where: { id: domainId },
        data: {
          status: "ACTIVE",
          verifiedAt: new Date(),
          lastCheckedAt: new Date(),
        },
      });
      await auditLog(tenantCtx, "DOMAIN_VERIFIED", "Domain", updated.id, {
        domain: domain.domain,
        method: "dns",
      });
      return NextResponse.json({
        verified: true,
        status: "ACTIVE",
        message: "DNS record found. Domain verified and now active.",
      });
    }

    // Failed — reset to FAILED.
    await db.organizationDomain.update({
      where: { id: domainId },
      data: { status: "FAILED", lastCheckedAt: new Date() },
    });

    return NextResponse.json({
      verified: false,
      status: "FAILED",
      message: dnsError
        ? `DNS lookup failed: ${dnsError}. Please try again in a few minutes.`
        : "DNS record not found. Please check your DNS configuration and try again.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
