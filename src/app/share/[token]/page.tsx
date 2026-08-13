"use client"

/**
 * /share/[token]
 *
 * Public shareable-achievement card page — no auth required, full-screen,
 * no shell chrome. Renders the shareable-achievement card for visitors
 * with the share token.
 *
 * Replaces the old `/?share=TOKEN` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { PublicSharePage } from "@/components/achievements/public-share-page"

export default function ShareRoutePage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = params?.token ?? ""

  const handleExit = React.useCallback(() => {
    router.push("/")
  }, [router])

  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <PublicSharePage token={token} onExit={handleExit} />
    </React.Suspense>
  )
}
