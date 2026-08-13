"use client"

/**
 * useCurrentUser
 *
 * Centralized client hook that reconciles NextAuth's `useSession` with a
 * fallback fetch of `/api/me`. Used by every authenticated route page so
 * we have a single source of truth for the signed-in user object.
 *
 * This was extracted from the old monolithic `src/app/page.tsx` during the
 * Phase 1 routing migration. Each new App Router page consumes this hook
 * instead of reading user state from the Zustand store (the store still
 * holds genuinely client-only UI state like the in-progress quiz runner).
 */

import * as React from "react"
import { useSession } from "next-auth/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { signOut } from "next-auth/react"
import { clearOrgSlug } from "@/components/organization/api"
import { useAppStore } from "@/store/app-store"
import type { SafeUser } from "@/types"

async function fetchMe(): Promise<SafeUser | null> {
  try {
    const res = await fetch("/api/me", { credentials: "include" })
    if (!res.ok) return null
    const data = await res.json()
    return (data as SafeUser) ?? null
  } catch {
    return null
  }
}

export interface UseCurrentUserResult {
  user: SafeUser | null
  /** True while the session is being loaded OR /api/me has not returned yet. */
  isLoading: boolean
  /** Force a refetch of /api/me (used after sign-in / role changes). */
  refetch: () => Promise<unknown>
  /** Sign out + clear all client state + cache. */
  signOutEverything: () => Promise<void>
  /** The raw NextAuth session (for super-admin checks via session.user.isSuperAdmin). */
  session: ReturnType<typeof useSession>["data"]
  sessionStatus: ReturnType<typeof useSession>["status"]
}

export function useCurrentUser(): UseCurrentUserResult {
  const { data: session, status: sessionStatus } = useSession()
  const queryClient = useQueryClient()
  const setUser = useAppStore((s) => s.setUser)

  const meQuery = useQuery<SafeUser | null>({
    queryKey: ["me", session?.user?.email ?? "anon"],
    queryFn: fetchMe,
    enabled: sessionStatus !== "loading",
    staleTime: 60_000,
  })

  // Mirror user into the Zustand store so legacy components that still
  // `useAppStore((s) => s.user)` keep working (e.g., leaderboard.tsx).
  React.useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data)
    } else if (
      meQuery.isError ||
      (sessionStatus === "unauthenticated" && !meQuery.isLoading)
    ) {
      setUser(null)
    }
  }, [meQuery.data, meQuery.isError, meQuery.isLoading, sessionStatus, setUser])

  const signOutEverything = React.useCallback(async () => {
    await signOut({ redirect: false })
    queryClient.clear()
    clearOrgSlug()
    setUser(null)
  }, [queryClient, setUser])

  return {
    user: meQuery.data ?? null,
    isLoading: sessionStatus === "loading" || meQuery.isLoading,
    refetch: () => meQuery.refetch(),
    signOutEverything,
    session,
    sessionStatus,
  }
}
