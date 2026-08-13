"use client"

/**
 * /pricing
 *
 * Standalone pricing page. Renders the PricingSection in standalone mode
 * (full-page, not the inline section shown on the landing page).
 *
 * Replaces the old `/?view=pricing` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import { PricingSection } from "@/components/landing/pricing-section"
import { MarketingPageShell } from "@/components/shared/marketing-page-shell"
import { useAppNavigate } from "@/lib/nav"

export default function PricingRoutePage() {
  const navigate = useAppNavigate()
  return (
    <MarketingPageShell>
      <PricingSection onNavigate={navigate} standalone />
    </MarketingPageShell>
  )
}
