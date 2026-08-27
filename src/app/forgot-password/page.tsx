"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Mail, Loader2, ArrowLeft, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BrandLogo } from "@/components/shared/brand-logo"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { toast.error("Please enter your email."); return }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      await res.json()
      setSent(true)
      toast.success("If an account exists, a reset link has been sent.")
    } catch { toast.error("Something went wrong.") }
    finally { setLoading(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-50/30 px-4 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader className="space-y-3 pb-2">
          <div className="flex justify-center"><BrandLogo size="md" /></div>
          <CardTitle className="text-center text-2xl">Reset your password</CardTitle>
          <CardDescription className="text-center">Enter your email and we will send you a reset link.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Mail className="size-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-muted-foreground">If an account exists with <strong>{email}</strong>, we have sent a password reset link.</p>
              <p className="text-xs text-muted-foreground">Check your inbox and spam folder. The link expires in 1 hour.</p>
              <Button variant="outline" onClick={() => router.push("/login")}>
                <ArrowLeft className="mr-2 size-4" /> Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input id="reset-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required disabled={loading} className="pl-9" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 size-4 animate-spin" /> Sending...</> : <><KeyRound className="mr-2 size-4" /> Send Reset Link</>}
              </Button>
            </form>
          )}
          {!sent && (
            <button onClick={() => router.push("/login")} className="w-full text-center text-sm text-emerald-600 hover:underline dark:text-emerald-400">
              <ArrowLeft className="mr-1 inline size-3" /> Back to Login
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
