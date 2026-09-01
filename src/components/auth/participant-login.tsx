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



export function ParticipantLogin({
  onSuccess,
  eventTitle,
  orgName,
  slug,
}: ParticipantLoginProps) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
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
        password,
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

            <div className="space-y-1.5">
              <Label htmlFor="p-password">Password</Label>
              <Input
                id="p-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                minLength={6}
                disabled={submitting}
              />
            </div>            </div>
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

          <p className="text-center text-xs text-muted-foreground">
            New here? Register first, then sign in with your email and password.
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
