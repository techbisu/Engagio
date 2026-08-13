"use client"

/**
 * /about
 *
 * Marketing About page. Renders the AboutPage component inside the standard
 * site header + footer chrome.
 *
 * Replaces the old `/?view=about` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import { AboutPage } from "@/components/landing/about-page"
import { MarketingPageShell } from "@/components/shared/marketing-page-shell"
import { useAppNavigate } from "@/lib/nav"

export default function AboutRoutePage() {
  const navigate = useAppNavigate()
  return (
    <MarketingPageShell>
      <AboutPage onNavigate={navigate} />
    </MarketingPageShell>
  )
}
