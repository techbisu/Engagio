"use client"

/**
 * /activity/[slug]
 *
 * Direct link to any non-quiz activity (Poll, Survey, Q&A, etc.).
 * Similar to /quiz/[slug] but uses ActivityJoin component.
 *
 * Flow:
 *   - Not authed → Google login
 *   - Authed → ActivityJoin component
 */

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { ParticipantGoogleLogin } from "@/components/auth/participant-google-login"
import { ActivityJoin } from "@/components/activities/activity-join"
import { StudentShell } from "@/components/student/student-shell"
import { SiteHeader } from "@/components/shared/site-header"
import { SiteFooter } from "@/components/shared/site-footer"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppNavigate } from "@/lib/nav"
import { Building2 } from "lucide-react"

export default function ActivityRoutePage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const navigate = useAppNavigate()
  const { user, refetch, signOutEverything } = useCurrentUser()
  const slug = params?.slug ?? ""

  const handleExit = React.useCallback(() => {
    router.push("/dashboard")
  }, [router])

  const handleSignOut = React.useCallback(async () => {
    await signOutEverything()
    router.push("/")
  }, [signOutEverything, router])

  const handleNavigateHome = React.useCallback(() => {
    router.push("/")
  }, [])

  // Authed → render ActivityJoin inside StudentShell
  if (user) {
    return (
      <StudentShell
        user={user}
        onSignOut={handleSignOut}
        onNavigateHome={handleNavigateHome}
      >
        <ActivityJoin
          slug={slug}
          user={user}
          onExit={handleExit}
        />
      </StudentShell>
    )
  }

  // Not authed → show Google login
  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <SiteHeader session={null} onNavigate={navigate} onSignOut={handleSignOut} />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto grid size-12 place-items-center rounded-xl bg-emerald-500/15">
              <Building2 className="size-6 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Join This Activity</h1>
            <p className="text-sm text-white/60">
              Sign in with Google to participate in this activity.
            </p>
          </div>
          <ParticipantGoogleLogin
            callbackUrl={"/activity/" + slug}
            className="w-full"
          />
        </div>
      </main>
      <SiteFooter onNavigate={navigate} />
    </div>
  )
}
