"use client"

/**
 * /live/[activityId]
 *
 * Public live-display projector view for an activity — full-screen, no auth,
 * no header/footer chrome. Used by event organizers to project live poll /
 * Q&A / survey results on a big screen.
 *
 * Replaces the old `/?live=ID` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { LiveDisplay } from "@/components/activities/live-display"
import type { ActivityType } from "@/types"

export default function LiveRoutePage() {
  const router = useRouter()
  const params = useParams<{ activityId: string }>()
  const activityId = params?.activityId ?? ""

  // The activity type is optional — LiveDisplay can derive it from the
  // results payload. We can't read it from the URL without an extra round
  // trip, so we leave it undefined and let the component figure it out.
  const type: ActivityType | undefined = undefined

  const handleExit = React.useCallback(() => {
    router.push("/")
  }, [router])

  return <LiveDisplay activityId={activityId} type={type} onExit={handleExit} />
}
