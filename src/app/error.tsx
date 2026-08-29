"use client"

/**
 * Root error boundary — catches unhandled runtime errors in any route
 * segment that doesn't have its own error.tsx. Shows a recoverable UI
 * instead of a white screen / hydration crash.
 */

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to console for dev debugging. In production, this could send
    // to Sentry / Datadog / Vercel's error tracking.
    console.error("[RootError]", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
            <AlertTriangle className="size-7 text-red-600" />
          </div>
          <CardTitle className="text-xl">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. You can try again or return to the
            homepage.
          </p>
          {error?.message && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error.message}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={reset} className="gap-1.5">
              <RefreshCw className="size-4" /> Try again
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/")}
              className="gap-1.5"
            >
              <Home className="size-4" /> Go home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
