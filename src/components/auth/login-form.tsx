'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import {
  ArrowRight,
  Loader2,
  Mail,
  ShieldCheck,
  GraduationCap,
  Sparkles,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { BrandLogo } from '@/components/shared/brand-logo'

interface LoginFormProps {
  onSuccess: (role: string) => void
}

/** Official Google "G" logo (multi-color) — used on the Continue with Google button. */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [tab, setTab] = React.useState<'signin' | 'demo'>('signin')
  const [email, setEmail] = React.useState('')
  const [name, setName] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [demoLoading, setDemoLoading] = React.useState<'admin' | 'student' | null>(null)

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
        callbackUrl: '/',
      })
      if (!res || res.error) {
        toast.error('Sign-in failed. Please try again.')
        return
      }
      toast.success('Welcome back!')
      // Fetch the session to get the role
      const sessionRes = await fetch('/api/auth/session').then((r) => r.json())
      const role = sessionRes?.user?.role || 'STUDENT'
      onSuccess(role)
    } catch (err) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDemo = async (asAdmin: boolean) => {
    const demoEmail = asAdmin ? 'admin@quizmaster.pro' : 'student@quizmaster.pro'
    setDemoLoading(asAdmin ? 'admin' : 'student')
    try {
      const res = await signIn('credentials', {
        email: demoEmail,
        name: asAdmin ? 'Demo Admin' : 'Demo Participant',
        asAdmin: asAdmin ? 'true' : 'false',
        redirect: false,
        callbackUrl: '/',
      })
      if (!res || res.error) {
        toast.error('Demo sign-in failed. Please try again.')
        return
      }
      toast.success(`Signed in as ${asAdmin ? 'Admin' : 'Participant'}`)
      const sessionRes = await fetch('/api/auth/session').then((r) => r.json())
      const role = sessionRes?.user?.role || (asAdmin ? 'ADMIN' : 'STUDENT')
      onSuccess(role)
    } catch (err) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setDemoLoading(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      <Card className="w-full border-border/60 shadow-xl shadow-emerald-900/5">
        <CardHeader className="space-y-3 pb-2">
          <div className="flex justify-center">
            <BrandLogo size="md" />
          </div>
          <CardTitle className="text-center text-2xl">
            {tab === 'signin' ? 'Welcome back' : 'Quick demo'}
          </CardTitle>
          <CardDescription className="text-center">
            {tab === 'signin'
              ? 'Sign in to your account to continue'
              : 'Try the platform as an admin or a participant — no setup needed'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as 'signin' | 'demo')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="demo">Quick Demo</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-5 space-y-4">
              <form onSubmit={handleSignIn} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name (optional)</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Ada Lovelace"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
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
                      Continue
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="demo" className="mt-5 space-y-3">
              <DemoButton
                onClick={() => handleDemo(true)}
                loading={demoLoading === 'admin'}
                icon={ShieldCheck}
                title="Demo as Admin"
                description="Full admin panel access — manage events, questions, links, and analytics."
                accent="from-emerald-600 to-teal-500"
              />
              <DemoButton
                onClick={() => handleDemo(false)}
                loading={demoLoading === 'student'}
                icon={GraduationCap}
                title="Demo as Participant"
                description="Take a quiz with the anti-cheat proctoring active."
                accent="from-slate-700 to-slate-800 dark:from-slate-200 dark:to-slate-300"
                textOnDark
              />
            </TabsContent>
          </Tabs>

          {/* Google OAuth — always visible. If GOOGLE_CLIENT_ID is not set on
              the server, NextAuth returns an error which we surface via toast. */}
          <>
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                signIn('google', { callbackUrl: '/' }).catch(() => {
                  toast.error('Google sign-in failed.')
                })
              }
            >
              <GoogleIcon className="size-4" />
              Continue with Google
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Public users can sign in with Google — no pre-created account needed.
            </p>
          </>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <p className="text-center text-xs text-muted-foreground">
            By continuing you agree to our{' '}
            <a href="#" className="underline hover:text-foreground">
              Terms
            </a>{' '}
            &{' '}
            <a href="#" className="underline hover:text-foreground">
              Privacy
            </a>
            .
          </p>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400">
            <Sparkles className="size-3" />
            No credit card required
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

interface DemoButtonProps {
  onClick: () => void
  loading: boolean
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  accent: string
  textOnDark?: boolean
}

function DemoButton({
  onClick,
  loading,
  icon: Icon,
  title,
  description,
  accent,
  textOnDark,
}: DemoButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={
        'group relative flex w-full items-start gap-3 rounded-xl border border-border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 ' +
        (textOnDark ? 'bg-slate-900 text-white dark:bg-slate-900' : 'bg-background')
      }
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${accent} text-white shadow-sm`}
      >
        {loading ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
      </span>
      <span className="flex-1">
        <span className={'block text-sm font-semibold ' + (textOnDark ? 'text-white' : 'text-foreground')}>
          {title}
        </span>
        <span className={'mt-0.5 block text-xs ' + (textOnDark ? 'text-slate-300' : 'text-muted-foreground')}>
          {description}
        </span>
      </span>
      <ArrowRight
        className={
          'size-4 shrink-0 transition-transform group-hover:translate-x-0.5 ' +
          (textOnDark ? 'text-slate-300' : 'text-muted-foreground')
        }
      />
    </button>
  )
}
