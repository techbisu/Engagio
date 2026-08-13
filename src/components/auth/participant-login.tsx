'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import {
  ArrowRight,
  Loader2,
  GraduationCap,
  Sparkles,
  ShieldCheck,
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
import { Badge } from '@/components/ui/badge'
import { BrandLogo } from '@/components/shared/brand-logo'

interface ParticipantLoginProps {
  /** Called after successful login */
  onSuccess: () => void
  /** Event title to display */
  eventTitle?: string
  /** Organization name */
  orgName?: string
  /** Quiz slug for context */
  slug?: string
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

export function ParticipantLogin({
  onSuccess,
  eventTitle,
  orgName,
  slug,
}: ParticipantLoginProps) {
  const [email, setEmail] = React.useState('')
  const [name, setName] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address.')
      return
    }
    setSubmitting(true)
    try {
      const res = await signIn('credentials', {
        email,
        name: name || undefined,
        redirect: false,
        callbackUrl: slug ? `/quiz/${slug}` : '/',
      })
      if (!res || res.error) {
        toast.error('Sign-in failed. Please try again.')
        return
      }
      toast.success('Welcome! Let\'s get you started.')
      onSuccess()
    } catch (err) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-md"
    >
      <Card className="w-full border-border/60 shadow-xl shadow-emerald-900/5">
        <CardHeader className="space-y-3 pb-2">
          {/* Event context */}
          {(eventTitle || orgName) && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
              {orgName && (
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {orgName}
                </p>
              )}
              {eventTitle && (
                <p className="mt-0.5 text-sm font-bold text-foreground">
                  {eventTitle}
                </p>
              )}
              {slug && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Quiz code: <span className="font-mono font-medium">{slug}</span>
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Join the event</CardTitle>
              <CardDescription className="text-sm">
                Sign in to participate in this event.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleSignIn} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Your Name</Label>
              <Input
                id="p-name"
                type="text"
                placeholder="Ada Lovelace"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-email">Email</Label>
              <Input
                id="p-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={submitting}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-600/95 hover:to-teal-500/95"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Join Event
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          {/* Google */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() =>
              signIn('google', { callbackUrl: slug ? `/quiz/${slug}` : '/' }).catch(() => {
                toast.error('Google sign-in failed.')
              })
            }
          >
            <GoogleIcon className="size-4" />
            Continue with Google
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            New here? Just enter your email — your account is created automatically.
            No password needed.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-3" />
            Your data is secure and private
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Powered by <span className="font-medium">Engagio</span> · Engage. Learn. Connect.
          </p>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
