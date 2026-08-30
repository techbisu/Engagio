import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { resolveOrgFromHost } from "@/lib/urls"

/**
 * /org/custom-domain
 *
 * Middleware rewrites here when a custom domain root is visited
 * (e.g., ips2026.dosedailynews.com/). The middleware sets
 * x-engagio-org-host to the custom domain hostname.
 *
 * This server component resolves the org from the hostname:
 * - If found → redirect to /org/{slug}
 * - If NOT found → render "Domain Not Configured" error page
 * - If DB error → render "Temporary Error" page
 */

function DomainNotConfigured({ host }: { host: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-tight">Domain Not Configured</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The domain <strong>{host}</strong> is not linked to any
          organization on Engagio.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          If you are the admin, go to your org dashboard → Settings →
          Domains → Add Domain, enter{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
            {host}
          </code>
          , and follow the DNS verification steps.
        </p>
      </div>
    </div>
  )
}

function TemporaryError() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-tight">Temporary Error</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We couldn&apos;t process your request. Please try again in a moment.
        </p>
      </div>
    </div>
  )
}

export default async function CustomDomainPage() {
  const hdrs = await headers()
  const host = hdrs.get("x-engagio-org-host")

  if (!host) {
    return <TemporaryError />
  }

  // Resolve the org from the hostname (DB lookup)
  let resolved: { organizationId: string; slug: string; isCustomDomain: boolean } | null
  try {
    resolved = await resolveOrgFromHost(host)
  } catch (e) {
    console.error("[custom-domain] Error resolving org:", e)
    return <TemporaryError />
  }

  if (!resolved) {
    return <DomainNotConfigured host={host} />
  }

  // Org found — redirect to /org/{slug}. This is a one-time redirect
  // (not a loop) because /org/{slug} renders without redirecting.
  redirect(`/org/${resolved.slug}`)
}
