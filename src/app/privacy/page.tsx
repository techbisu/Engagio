"use client"

/**
 * /privacy
 *
 * Marketing Privacy Policy page.
 *
 * Replaces the old `/?view=privacy` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import { PrivacyPage } from "@/components/landing/privacy-page"
import { MarketingPageShell } from "@/components/shared/marketing-page-shell"

export default function PrivacyRoutePage() {
  return (
    <MarketingPageShell>
      <PrivacyPage />
    </MarketingPageShell>
  )
}
