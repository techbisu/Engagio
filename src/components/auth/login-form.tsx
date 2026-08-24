'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import {
  ArrowRight,
  Loader2,
  ShieldCheck,
  Building2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BrandLogo } from '@/components/shared/brand-logo'

interface LoginFormProps {
  onSuccess: (role: string) => void
  onRegisterOrg?: () => void
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

export function LoginForm({ onSuccess, onRegisterOrg }: LoginFormProps) {
  // Demo tab removed for production
  const [email, setEmail] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [demoLoading, setDemoLoading] = React.useState<string | null>(null)
  const [orgCheckResult, setOrgCheckResult] = React.useState<{
    hasOrg: boolean
    organizations?: { id: string; name: string; slug: string }[]
    message?: string
  } | null>(null)

  // ─── Google Login (primary for org admins) ────────────────────────────
  // After Google OAuth, the auto-route effect in page.tsx checks if the user
  // has an org. If not → no-org intermediate page. If yes → admin panel.
  const handleGoogleLogin = () => {
    signIn('google', { callbackUrl: '/login' }).catch(() => {
      toast.error('Google sign-in failed. Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.')
    })
  }

  // ─── Email pre-check (for org login) ──────────────────────────────────
  // Before attempting to sign in, check if the email belongs to an existing
  // org. If not → show a message and redirect to registration.
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    setOrgCheckResult(null)

    try {
      // Step 1: Check if the email belongs to an existing org
      const checkRes = await fetch('/api/auth/check-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const checkData = await checkRes.json()

      if (!checkData.hasOrg) {
        // No org found → show message + redirect to registration
        setOrgCheckResult({
          hasOrg: false,
          message: checkData.message || 'No organization found for this email.',
        })
        toast.error('No organization found', {
          description: 'Please register your organization first.',
        })
        return
      }

      // Step 2: Org exists → proceed with Google login
      setOrgCheckResult({
        hasOrg: true,
        organizations: checkData.organizations,
      })
      toast.success(`Found ${checkData.organizations.length} organization(s). Continue with Google to sign in.`)
    } catch (err) {
      toast.error('Failed to check organization. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Demo logins ────────────────────────────────────────────────────
  const handleDemo = async (type: 'orgadmin' | 'participant') => {
    setDemoLoading(type)
    const demoConfig = {
      orgadmin: { email: 'demo.admin@engagio.app', name: 'Demo Admin', asAdmin: 'true' },
      participant: { email: 'demo.participant@engagio.app', name: 'Demo Participant', asAdmin: 'false' },
    }
    const config = demoConfig[type]
    try {
      const res = await signIn('credentials', {
        email: config.email,
        name: config.name,
        asAdmin: config.asAdmin,
        redirect: false,
        callbackUrl: '/',
      })
      if (!res || res.error) {
        toast.error('Demo sign-in failed.')
        return
      }
      toast.success(`Signed in as ${config.name}`)
      const sessionRes = await fetch('/api/auth/session').then((r) => r.json())
      const role = sessionRes?.user?.role || (config.asAdmin === 'true' ? 'ADMIN' : 'STUDENT')
      onSuccess(role)
    } catch (err) {
      toast.error('Something went wrong.')
    } finally {
      setDemoLoading(null)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full">
      <Card className="w-full border-border/60 shadow-xl shadow-emerald-900/5">
        <CardHeader className="space-y-3 pb-2">
          <div className="flex justify-center">
            <BrandLogo size="md" />
          </div>
          <CardTitle className="text-center text-2xl">Organization Login</CardTitle>
          <CardDescription className="text-center">
            Sign in to your organization dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>

            {/* ─── Sign In Tab ──────────────────────────────────────── */}
            <div className="space-y-4">
              {/* Google — primary login method for org admins */}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleLogin}
              >
                <GoogleIcon className="size-4" />
                Continue with Google
              </Button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or check a demo email</span></div>
              </div>

              {/* Email pre-check (demo / fallback only) */}
              <form onSubmit={handleEmailLogin} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="email">
                    Email <span className="font-normal text-muted-foreground">(demo only)</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@organization.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setOrgCheckResult(null)
                    }}
                    autoComplete="email"
                    required
                    disabled={submitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Demo accounts only. Production sign-in uses Google above.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-600/95 hover:to-teal-500/95"
                  disabled={submitting || !email}
                >
                  {submitting ? (
                    <><Loader2 className="size-4 animate-spin" /> Checking…</>
                  ) : (
                    <>Check & Continue <ArrowRight className="size-4" /></>
                  )}
                </Button>
              </form>

              {/* Org check result */}
              <AnimatePresence>
                {orgCheckResult && !orgCheckResult.hasOrg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                      <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                          {orgCheckResult.message}
                        </p>
                        {onRegisterOrg && (
                          <button
                            onClick={onRegisterOrg}
                            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                          >
                            Register your organization →
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {orgCheckResult && orgCheckResult.hasOrg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                            Organization found!
                          </p>
                          <div className="mt-2 space-y-1">
                            {orgCheckResult.organizations?.map((org) => (
                              <div key={org.id} className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
                                <Building2 className="size-3.5" />
                                <span className="font-medium">{org.name}</span>
                                <span className="text-xs text-emerald-600/70">/{org.slug}</span>
                              </div>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                            Click "Continue with Google" above to sign in.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {onRegisterOrg && (
                <button
                  onClick={onRegisterOrg}
                  className="w-full text-center text-sm text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Don&apos;t have an organization? Register one →
                </button>
              )}

              <div className="rounded-lg border border-dashed border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  🎓 Participant? Use the event link shared by your organizer.<br />
                  🔒 Super Admin? Use <code className="font-mono">/superadmin/login</code>
                </p>
              </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <p className="text-center text-xs text-muted-foreground">
            By continuing you agree to our{' '}
            <a href="/terms" className="underline hover:text-foreground">Terms</a> &{' '}
            <a href="/privacy" className="underline hover:text-foreground">Privacy</a>.
          </p>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400">
            <Sparkles className="size-3" /> Start free. No payment required.
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

