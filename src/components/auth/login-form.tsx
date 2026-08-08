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

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true'

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
        name: asAdmin ? 'Demo Admin' : 'Demo Student',
        asAdmin: asAdmin ? 'true' : 'false',
        redirect: false,
        callbackUrl: '/',
      })
      if (!res || res.error) {
        toast.error('Demo sign-in failed. Please try again.')
        return
      }
      toast.success(`Signed in as ${asAdmin ? 'Admin' : 'Student'}`)
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
              : 'Try the platform as an admin or a student — no setup needed'}
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
                title="Demo as Student"
                description="Take a quiz with the anti-cheat proctoring active."
                accent="from-slate-700 to-slate-800 dark:from-slate-200 dark:to-slate-300"
                textOnDark
              />
            </TabsContent>
          </Tabs>

          {GOOGLE_ENABLED && (
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
                <Mail className="size-4" />
                Continue with Google
              </Button>
            </>
          )}
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
