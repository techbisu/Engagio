"use client"

/**
 * /register?event={eventId}
 *
 * Full-page registration form for participants.
 * After Google login, if the event requires registration,
 * participants are redirected here to fill out custom fields.
 * On success, redirects to /dashboard.
 */

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { EventRegistrationForm } from "@/components/public/event-registration-form"
import { MarketingPageShell } from "@/components/shared/marketing-page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BrandLogo } from "@/components/shared/brand-logo"

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useCurrentUser()
  const eventId = searchParams.get("event")

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!user) {
      router.replace("/login")
    }
  }, [user, router])

  const handleSuccess = React.useCallback(() => {
    router.push("/dashboard")
  }, [router])

  if (!user || !eventId) {
    return (
      <MarketingPageShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      </MarketingPageShell>
    )
  }

  return (
    <MarketingPageShell>
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Event Registration</CardTitle>
            <CardDescription>
              Complete the form below to register for this event.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EventRegistrationForm
              eventId={eventId}
              onSuccess={handleSuccess}
            />
          </CardContent>
        </Card>
      </div>
    </MarketingPageShell>
  )
}
