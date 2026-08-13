"use client"

/**
 * /contact
 *
 * Marketing Contact page.
 *
 * Replaces the old `/?view=contact` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import { ContactPage } from "@/components/landing/contact-page"
import { MarketingPageShell } from "@/components/shared/marketing-page-shell"
import { useAppNavigate } from "@/lib/nav"

export default function ContactRoutePage() {
  const navigate = useAppNavigate()
  return (
    <MarketingPageShell>
      <ContactPage onNavigate={navigate} />
    </MarketingPageShell>
  )
}
