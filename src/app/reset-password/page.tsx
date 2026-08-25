"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { toast } from "sonner"
import { Lock, ArrowRight, Loader2, ArrowLeft, CheckCircle, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BrandLogo } from "@/components/shared/brand-logo"

function ResetPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-50/30 px-4 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20">
        <Card className="w-full max-w-md border-border/60 shadow-xl">
          <CardHeader><CardTitle className="text-center text-2xl">Invalid Link</CardTitle></CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">This password reset link is invalid or missing.</p>
            <Button onClick={() => router.push("/forgot-password")}>Request a New Link</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return }
    if (password !== confirmPassword) { toast.error("Passwords do not match."); return }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Failed to reset password."); return }
      setSuccess(true)
      toast.success("Password reset successful!")
    } catch { toast.error("Something went wrong.") }
    finally { setLoading(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-50/30 px-4 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader className="space-y-3 pb-2">
          <div className="flex justify-center"><BrandLogo size="md" /></div>
          <CardTitle className="text-center text-2xl">Set new password</CardTitle>
          <CardDescription className="text-center">Enter your new password below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="size-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-muted-foreground">Your password has been reset successfully.</p>
              <Button onClick={() => router.push("/login")}>Go to Login <ArrowRight className="ml-2 size-4" /></Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input id="new-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required disabled={loading} className="pl-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input id="confirm-password" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required disabled={loading} className="pl-9" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 size-4 animate-spin" /> Resetting...</> : <><KeyRound className="mr-2 size-4" /> Reset Password</>}
              </Button>
            </form>
          )}
          {!success && (
            <button onClick={() => router.push("/login")} className="w-full text-center text-sm text-emerald-600 hover:underline dark:text-emerald-400">
              <ArrowLeft className="mr-1 inline size-3" /> Back to Login
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>}>
      <ResetPasswordInner />
    </Suspense>
  )
}
