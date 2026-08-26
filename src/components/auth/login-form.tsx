'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import { Sparkles, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'
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
import { BrandLogo } from '@/components/shared/brand-logo'

interface LoginFormProps {
  onSuccess: (role: string) => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [emailNotVerified, setEmailNotVerified] = React.useState(false)
  const [resending, setResending] = React.useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address.')
      return
    }
    if (!password) {
      toast.error('Please enter your password.')
      return
    }
    setLoading(true)
      setEmailNotVerified(false)
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (!res || res.error) {
        if (res?.error === 'EMAIL_NOT_VERIFIED') {
          setEmailNotVerified(true)
          toast.error('Please verify your email first. Check your inbox.')
        } else if (res?.error === 'TOTP_REQUIRED') {
          toast.error('Two-factor authentication required. Please enter your TOTP code.')
        } else {
          toast.error('Invalid email or password.')
        }
        return
      }
      toast.success('Welcome back!')
      onSuccess('')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
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
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  className="pl-9"
                />
              </div>
              <div className="text-right">
                <a href="/forgot-password" className="text-xs text-emerald-600 hover:underline dark:text-emerald-400">
                  Forgot password?
                </a>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-600/95 hover:to-teal-500/95"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          {emailNotVerified && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-900 dark:bg-amber-950/20">
              <p className="mb-2 text-sm text-amber-700 dark:text-amber-400">
                Your email hasn&apos;t been verified yet.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!email || !password) {
                    toast.error('Enter your email and password first.')
                    return
                  }
                  setResending(true)
                  try {
                    const res = await fetch('/api/auth/register', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email, password }),
                    })
                    const data = await res.json()
                    if (res.ok) {
                      toast.success('Verification email sent! Check your inbox.')
                    } else {
                      toast.error(data.error || 'Failed to resend.')
                    }
                  } catch {
                    toast.error('Failed to resend verification email.')
                  } finally {
                    setResending(false)
                  }
                }}
                disabled={resending}
              >
                {resending ? (
                  <><Loader2 className="mr-1 size-3 animate-spin" /> Sending...</>
                ) : (
                  <><Mail className="mr-1 size-3" /> Resend Verification Email</>
                )}
              </Button>
            </div>
          )}

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
