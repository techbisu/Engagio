"use client"

/**
 * Legacy event landing error boundary — catches errors on the public
 * /event/[eventSlug] page (the legacy un-scoped event URL).
 *
 * Mirrors the dashboard error pattern (AlertTriangle + reset).
 */

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LegacyEventError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[LegacyEventError]", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
            <AlertTriangle className="size-7 text-red-600" />
          </div>
          <CardTitle className="text-xl">Event error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t load this event. Try reloading the page.
          </p>
          {error?.message && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error.message}
            </p>
          )}
          <Button onClick={reset} className="gap-1.5">
            <RefreshCw className="size-4" /> Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
