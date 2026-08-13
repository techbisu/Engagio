"use client"

/**
 * /invite/[token]
 *
 * Org invitation acceptance page. Requires auth — if the visitor is not
 * signed in, they're redirected to /login (and the invite token is stashed
 * in the Zustand store so /login can route them back here after sign-in).
 *
 * Replaces the old `/?invite=TOKEN` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { AcceptInvitation } from "@/components/organization/accept-invitation"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppStore } from "@/store/app-store"

export default function InviteRoutePage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const { user, refetch, signOutEverything } = useCurrentUser()
  const setInviteToken = useAppStore((s) => s.setInviteToken)
  const token = params?.token ?? ""

  // Stash the invite token in the store so /login can route back here after
  // a successful sign-in.
  React.useEffect(() => {
    if (token) setInviteToken(token)
  }, [token, setInviteToken])

  // Redirect to /login if not signed in. Wait for the session + meQuery to
  // finish before redirecting to avoid a flash on page reload.
  React.useEffect(() => {
    if (!user) {
      router.replace("/login")
    }
  }, [user, router])

  const handleAccepted = React.useCallback(async () => {
    setInviteToken(null)
    await refetch()
    router.push("/admin")
  }, [setInviteToken, refetch, router])

  const handleSignIn = React.useCallback(async () => {
    // Sign out then redirect to /login (which will route back here via the
    // stashed invite token).
    await signOutEverything()
    router.push("/login")
  }, [signOutEverything, router])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <AcceptInvitation
      token={token}
      user={user}
      onAccepted={handleAccepted}
      onSignIn={handleSignIn}
    />
  )
}
