/**
 * /org/custom-domain
 *
 * This page is hit via middleware rewrite when a custom domain root is visited
 * (e.g., events.abcmedical.org/). The middleware sets x-engagio-org-host to
 * the custom domain hostname.
 *
 * This server component resolves the org from the hostname and renders the
 * org landing page. The browser URL stays as the custom domain.
 */

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { resolveOrgFromHost } from "@/lib/urls"

export default async function CustomDomainPage() {
  const hdrs = await headers()
  const host = hdrs.get("x-engagio-org-host")

  if (!host) {
    redirect("/")
  }

  const resolved = await resolveOrgFromHost(host)

  if (!resolved) {
    redirect("/")
  }

  // Redirect to the proper /org/{slug} route using the resolved slug
  // This keeps the URL clean and the org landing page component reusable.
  redirect(`/org/${resolved.slug}`)
}
