"use client"

/**
 * /verify/[token]
 *
 * Public certificate verification page — no auth required, full-screen, no
 * header/footer chrome.
 *
 * Replaces the old `/?verify=TOKEN` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { VerifyCertificate } from "@/components/cert/verify-certificate"

export default function VerifyRoutePage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = params?.token ?? ""

  const handleExit = React.useCallback(() => {
    router.push("/")
  }, [router])

  return <VerifyCertificate token={token} onExit={handleExit} />
}
