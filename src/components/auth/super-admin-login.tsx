'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import {
  ArrowRight,
  Loader2,
  Lock,
  ShieldCheck,
  KeyRound,
  Smartphone,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { BrandLogo } from '@/components/shared/brand-logo'

interface SuperAdminLoginProps {
  onSuccess: () => void
  onBack: () => void
}

type Step = 'credentials' | 'totp'

export function SuperAdminLogin({ onSuccess, onBack }: SuperAdminLoginProps) {
  const [step, setStep] = React.useState<Step>('credentials')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [totpCode, setTotpCode] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [totpRequired, setTotpRequired] = React.useState(false)

  // ─── Step 1: Email + password ────────────────────────────────────────
  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Email and password are required.')
      return
    }
    setSubmitting(true)
    try {
      // Check if TOTP is required for this email
      const totpStatusRes = await fetch('/api/auth/totp/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const totpStatus = await totpStatusRes.json()

      if (totpStatus.totpRequired) {
        // TOTP is enabled → go straight to the code step. The server NEVER
        // issues a session for this account without a valid code, so the
        // password + code are both verified in the single sign-in on the
        // next step.
        setTotpRequired(true)
        setStep('totp')
        toast.info('Enter your 6-digit authenticator code to continue.')
        return
      }

      // No TOTP → regular sign in
      const res = await signIn('credentials', {
        email,
        password,
        asAdmin: 'true',
        redirect: false,
        callbackUrl: '/',
      })
      if (!res || res.error) {
        toast.error('Invalid credentials.')
        return
      }
      // Verify super admin status
      const sessionRes = await fetch('/api/auth/session').then((r) => r.json())
      const isSuper = sessionRes?.user?.isSuperAdmin === true
      if (!isSuper) {
        toast.error('This account does not have Super Admin privileges.')
        return
      }
      toast.success('Welcome, Super Admin.')
      onSuccess()
    } catch (err) {
      toast.error('Authentication failed.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Step 2: TOTP code verification ──────────────────────────────────
  const handleTotpLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!totpCode || totpCode.length !== 6) {
      toast.error('Please enter the 6-digit code from your authenticator app.')
      return
    }
    setSubmitting(true)
    try {
      // Complete the sign-in with the TOTP code
      const res = await signIn('credentials', {
        email,
        password,
        asAdmin: 'true',
        totpCode,
        redirect: false,
        callbackUrl: '/',
      })
      if (!res || res.error) {
        toast.error('Sign-in failed. Check your password and authenticator code, then try again.')
        return
      }
      // Verify super admin status
      const sessionRes = await fetch('/api/auth/session').then((r) => r.json())
      const isSuper = sessionRes?.user?.isSuperAdmin === true
      if (!isSuper) {
        toast.error('This account does not have Super Admin privileges.')
        return
      }
      toast.success('Welcome, Super Admin.')
      onSuccess()
    } catch (err) {
      toast.error('TOTP verification failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="border-amber-200/20 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-center justify-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                <ShieldCheck className="size-6" />
              </div>
            </div>
            <CardTitle className="text-center text-2xl text-white">
              Super Admin Login
            </CardTitle>
            <CardDescription className="text-center text-slate-400">
              {step === 'credentials'
                ? 'Platform-level administration. Authorized personnel only.'
                : 'Enter the 6-digit code from your authenticator app.'}
            </CardDescription>
            {step === 'credentials' && (
              <div className="flex justify-center">
                <Badge
                  variant="outline"
                  className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-300"
                >
                  <Smartphone className="size-3" />
                  Google Authenticator (TOTP) 2FA required
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence mode="wait">
              {step === 'credentials' ? (
                <motion.form
                  key="credentials"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleCredentialLogin}
                  className="space-y-3.5"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="sa-email" className="text-slate-300">Email</Label>
                    <Input
                      id="sa-email"
                      type="email"
                      placeholder="superadmin@engagio.app"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      disabled={submitting}
                      className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sa-pass" className="text-slate-300">Password</Label>
                    <Input
                      id="sa-pass"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      disabled={submitting}
                      className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-amber-600 to-orange-500 text-white hover:from-amber-600/95 hover:to-orange-500/95"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <><Loader2 className="size-4 animate-spin" /> Authenticating…</>
                    ) : (
                      <><Lock className="size-4" /> Secure Login</>
                    )}
                  </Button>
                </motion.form>
              ) : (
                <motion.form
                  key="totp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleTotpLogin}
                  className="space-y-3.5"
                >
                  <div className="flex flex-col items-center gap-2 pb-2">
                    <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                      <Smartphone className="size-6" />
                    </div>
                    <p className="text-center text-xs text-slate-400">
                      Open your authenticator app (Google Authenticator, Authy,
                      1Password, etc.) and enter the 6-digit code for Engagio.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sa-totp" className="text-slate-300">
                        6-digit code
                      </Label>
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-300"
                      >
                        <Smartphone className="size-3" />
                        Google Authenticator
                      </Badge>
                    </div>
                    <Input
                      id="sa-totp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      autoComplete="one-time-code"
                      required
                      disabled={submitting}
                      autoFocus
                      className="border-slate-700 bg-slate-800 text-center text-2xl font-bold tracking-[0.5em] text-white placeholder:text-slate-600"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-amber-600 to-orange-500 text-white hover:from-amber-600/95 hover:to-orange-500/95"
                    disabled={submitting || totpCode.length !== 6}
                  >
                    {submitting ? (
                      <><Loader2 className="size-4 animate-spin" /> Verifying…</>
                    ) : (
                      <><KeyRound className="size-4" /> Verify & Sign In</>
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials')
                      setTotpCode('')
                    }}
                    className="flex w-full items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
                  >
                    <ArrowLeft className="size-3.5" /> Back to credentials
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <button
              onClick={onBack}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              ← Back to Engagio
            </button>
            <p className="text-center text-[11px] text-slate-500">
              Super Admin access is granted via database role + password + TOTP 2FA.
              Unauthorized access attempts are logged.
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}
