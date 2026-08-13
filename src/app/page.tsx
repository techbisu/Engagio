"use client"

/**
 * / (marketing landing page)
 *
 * The Engagio marketing landing page — Hero, features, pricing, FAQ, CTA, etc.
 *
 * Previously this file acted as a client-side view router driven by query
 * params (?view=, ?quiz=, ?event=, ?org=, ?verify=, ?share=, ?invite=, etc.).
 * As of the Phase 1 routing migration, all of those views have been moved
 * to dedicated App Router file-based routes:
 *
 *   /login                    → src/app/login/page.tsx
 *   /superadmin/login         → src/app/superadmin/login/page.tsx
 *   /org-register             → src/app/org-register/page.tsx
 *   /org/[orgSlug]            → src/app/org/[orgSlug]/page.tsx
 *   /event/[eventSlug]        → src/app/event/[eventSlug]/page.tsx
 *   /quiz/[quizSlug]          → src/app/quiz/[quizSlug]/page.tsx
 *   /verify/[token]           → src/app/verify/[token]/page.tsx
 *   /share/[token]            → src/app/share/[token]/page.tsx
 *   /invite/[token]           → src/app/invite/[token]/page.tsx
 *   /dashboard                → src/app/dashboard/page.tsx
 *   /admin                    → src/app/admin/page.tsx
 *   /about, /privacy, /terms,
 *   /contact, /pricing        → src/app/<name>/page.tsx
 *   /no-org                   → src/app/no-org/page.tsx
 *   /live/[activityId]        → src/app/live/[activityId]/page.tsx
 *
 * Old URLs (?view=login etc.) are 301-redirected to the new file routes by
 * src/middleware.ts.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { SiteHeader } from "@/components/shared/site-header"
import { SiteFooter } from "@/components/shared/site-footer"
import { Hero } from "@/components/landing/hero"
import { TrustStrip } from "@/components/landing/trust-strip"
import { Features } from "@/components/landing/features"
import { ActivitiesSection } from "@/components/landing/activities-section"
import { HowItWorks } from "@/components/landing/how-it-works"
import { UseCases } from "@/components/landing/use-cases"
import { AssessmentSection } from "@/components/landing/assessment-section"
import { SecuritySection } from "@/components/landing/security-section"
import { CertificateSection } from "@/components/landing/certificate-section"
import { OrganizationSection } from "@/components/landing/organization-section"
import { TeamSection } from "@/components/landing/team-section"
import { CtaSection } from "@/components/landing/cta-section"
import { PricingSection } from "@/components/landing/pricing-section"
import { Faq } from "@/components/landing/faq"

import { useAppNavigate } from "@/lib/nav"
import { useCurrentUser } from "@/components/shared/use-current-user"
import type { SafeUser } from "@/types"

export default function Home() {
  const router = useRouter()
  const navigate = useAppNavigate()
  const { user, signOutEverything } = useCurrentUser()

  const session = React.useMemo(
    () => (user ? ({ user } as { user: SafeUser }) : null),
    [user],
  )

  const handleSignOut = React.useCallback(async () => {
    await signOutEverything()
    router.push("/")
  }, [signOutEverything, router])

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader
        session={session}
        onNavigate={navigate}
        onSignOut={handleSignOut}
      />
      <main className="flex-1">
        {/*
          Section order per the marketing-page consolidation spec:
            1. Hero
            2. Trust Strip
            3. Problem
            4. Features (Product Overview)
            5. How It Works (Event Journey)
            6. Activities
            7. Assessment
            8. Certificates
            9. (Achievement Sharing — covered by CertificateSection)
           10. Organization / SaaS
           11. Use Cases
           12. Security
           13. Pricing (DB-driven)
           14. FAQ
           15. Final CTA
        */}
        <Hero onNavigate={navigate} session={session} />
        <TrustStrip />
        <Features />
        <HowItWorks />
        <ActivitiesSection />
        <AssessmentSection />
        <CertificateSection />
        <OrganizationSection onNavigate={navigate} />
        <TeamSection />
        <UseCases />
        <SecuritySection />
        <PricingSection onNavigate={navigate} />
        <Faq />
        <CtaSection onNavigate={navigate} />
      </main>
      <SiteFooter onNavigate={navigate} />
    </div>
  )
}
