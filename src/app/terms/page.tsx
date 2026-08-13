"use client"

/**
 * /terms
 *
 * Marketing Terms of Service page.
 *
 * Replaces the old `/?view=terms` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import { TermsPage } from "@/components/landing/terms-page"
import { MarketingPageShell } from "@/components/shared/marketing-page-shell"

export default function TermsRoutePage() {
  return (
    <MarketingPageShell>
      <TermsPage />
    </MarketingPageShell>
  )
}
