"use client"

/**
 * Super admin login error boundary — catches errors in the
 * /superadmin/login form (TOTP / 2FA flow).
 *
 * Simpler variant: just a "Try again" reset button (no "go home").
 */

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SuperAdminLoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[SuperAdminLoginError]", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-red-950">
            <AlertTriangle className="size-7 text-red-500" />
          </div>
          <CardTitle className="text-xl">Login error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-slate-400">
            Something went wrong loading the super admin login. Try again.
          </p>
          {error?.message && (
            <p className="rounded-md bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error.message}
            </p>
          )}
          <Button onClick={reset} className="gap-1.5 bg-emerald-500 hover:bg-emerald-400">
            <RefreshCw className="size-4" /> Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
