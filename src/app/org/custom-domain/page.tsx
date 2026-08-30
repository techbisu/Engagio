/**
 * /org/custom-domain
 *
 * This page is hit via middleware rewrite when a custom domain root is visited
 * (e.g., ips2026.dosedailynews.com/). The middleware sets x-engagio-org-host
 * to the custom domain hostname.
 *
 * This server component resolves the org from the hostname. If found, it
 * renders the org landing page. If NOT found, shows a "domain not configured"
 * message instead of redirecting back to `/` (which would cause
 * ERR_TOO_MANY_REDIRECTS).
 */

import { headers } from "next/headers"
import { resolveOrgFromHost } from "@/lib/urls"
import { notFound } from "next/navigation"
import { OrgLandingPage } from "@/components/public/org-landing-page"

export default async function CustomDomainPage() {
  const hdrs = await headers()
  const host = hdrs.get("x-engagio-org-host")

  if (!host) {
    notFound()
  }

  const resolved = await resolveOrgFromHost(host)

  if (!resolved) {
    // Domain is NOT registered in the OrganizationDomain table.
    // Show a friendly error page instead of redirecting (which causes a loop).
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold tracking-tight">Domain Not Configured</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The domain <strong>{host}</strong> is not linked to any organization on
            Engagio. An organization admin needs to add this domain in their
            organization settings → Domains and verify it via DNS.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            If you are the admin, go to your org dashboard → Settings → Domains →
            Add Domain, enter <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{host}</code>,
            and follow the DNS verification steps.
          </p>
        </div>
      </div>
    )
  }

  // Org found — render the org landing page directly (no redirect).
  // The OrgLandingPage client component fetches org data by slug.
  return <OrgLandingPage orgSlug={resolved.slug} user={null} onNavigate={() => {}} onOpenEvent={() => {}} />
}
