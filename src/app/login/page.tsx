"use client"

/**
 * /login
 *
 * Organization admin login page.
 *
 * Replaces the old `/?view=login` query-param route. Renders the LoginForm
 * inside the standard marketing chrome (site header + footer) and routes
 * the user to the appropriate destination after a successful sign-in.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import { MarketingPageShell } from "@/components/shared/marketing-page-shell"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useRouteAfterAuth } from "@/lib/use-route-after-auth"
import { useAppStore } from "@/store/app-store"
import type { SafeUser } from "@/types"

export default function LoginPage() {
  const router = useRouter()
  const { user, refetch } = useCurrentUser()
  const routeAfterAuth = useRouteAfterAuth()
  const inviteToken = useAppStore((s) => s.inviteToken)
  const setInviteToken = useAppStore((s) => s.setInviteToken)
  const didAutoRouteRef = React.useRef<string | null>(null)

  // Auto-route when a user becomes authenticated (the
  // callback redirects back to /login, then this effect detects the new
  // session and routes the user to the right place).
  React.useEffect(() => {
    if (!user) {
      didAutoRouteRef.current = null
      return
    }
    if (didAutoRouteRef.current !== user.id) {
      didAutoRouteRef.current = user.id
      void routeAfterAuth(user, { inviteToken }).then(() => {
        if (inviteToken) setInviteToken(null)
      })
    }
  }, [user, inviteToken, routeAfterAuth, setInviteToken])

  const handleLoginSuccess = React.useCallback(
    async (_role: string) => {
      // Fetch the freshly-signed-in user and route them.
      // useCurrentUser will pick up the new session via useSession, but we
      // refetch to make sure we have the latest role/id.
      const result = await refetch()
      const meData: SafeUser | null =
        (result as unknown as { data?: SafeUser | null })?.data ?? null
      if (meData) {
        didAutoRouteRef.current = meData.id
        await routeAfterAuth(meData, { inviteToken })
        if (inviteToken) setInviteToken(null)
      }
    },
    [refetch, routeAfterAuth, inviteToken, setInviteToken],
  )

  const handleRegisterOrg = React.useCallback(() => {
    router.push("/org-register")
  }, [router])

  return (
    <MarketingPageShell>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <LoginForm onSuccess={handleLoginSuccess} />
        </div>
      </div>
    </MarketingPageShell>
  )
}
