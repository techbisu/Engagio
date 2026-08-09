'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import {
  ArrowRight,
  Loader2,
  ShieldCheck,
  Building2,
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
  const [tab, setTab] = React.useState<'org' | 'demo'>('org')

  // Org login form
  const [orgEmail, setOrgEmail] = React.useState('')
  const [orgPassword, setOrgPassword] = React.useState('')
  const [orgSubmitting, setOrgSubmitting] = React.useState(false)

  // Demo
  const [demoLoading, setDemoLoading] = React.useState<string | null>(null)

  // ─── Org Login (email + optional password) ───────────────────────────
  // Super admin is auto-detected: if the email matches SUPERADMIN_EMAIL env
  // var, the user gets isSuperAdmin=true in the JWT + session, and is routed
  // to the Platform Admin panel. No separate super admin login tab needed.
  const handleOrgLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orgEmail)) {
      toast.error('Please enter a valid email address.')
      return
    }
    setOrgSubmitting(true)
    try {
      const res = await signIn('credentials', {
        email: orgEmail,
        password: orgPassword || undefined,
        asAdmin: 'true',
        redirect: false,
        callbackUrl: '/',
      })
      if (!res || res.error) {
        toast.error('Invalid email or password.')
        return
      }
      toast.success('Welcome to Engagio!')
      const sessionRes = await fetch('/api/auth/session').then((r) => r.json())
      const role = sessionRes?.user?.role || 'ADMIN'
      onSuccess(role)
    } catch (err) {
      toast.error('Something went wrong.')
    } finally {
      setOrgSubmitting(false)
    }
  }

  // ─── Demo logins ──────────────────────────────────────────────────────
  const handleDemo = async (type: 'superadmin' | 'orgadmin') => {
    setDemoLoading(type)
    const demoConfig = {
      superadmin: { email: 'superadmin@engagio.app', name: 'Super Admin', asAdmin: 'true' },
      orgadmin: { email: 'demo.admin@engagio.app', name: 'Demo Admin', asAdmin: 'true' },
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
      const role = sessionRes?.user?.role || 'ADMIN'
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
          <CardTitle className="text-center text-2xl">Welcome to Engagio</CardTitle>
          <CardDescription className="text-center">
            Sign in to manage your events, activities, and assessments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'org' | 'demo')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="org">Organization Login</TabsTrigger>
              <TabsTrigger value="demo">Quick Demo</TabsTrigger>
            </TabsList>

            {/* ─── Organization Login ─────────────────────────────────── */}
            <TabsContent value="org" className="mt-5 space-y-4">
              <form onSubmit={handleOrgLogin} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="org-email">Email</Label>
                  <Input id="org-email" type="email" placeholder="you@organization.com" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} autoComplete="email" required disabled={orgSubmitting} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="org-pass">Password <span className="text-xs text-muted-foreground">(optional for demo)</span></Label>
                  <Input id="org-pass" type="password" placeholder="••••••••" value={orgPassword} onChange={(e) => setOrgPassword(e.target.value)} autoComplete="current-password" disabled={orgSubmitting} />
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-600/95 hover:to-teal-500/95" disabled={orgSubmitting}>
                  {orgSubmitting ? (<><Loader2 className="size-4 animate-spin" /> Signing in…</>) : (<>Continue <ArrowRight className="size-4" /></>)}
                </Button>
              </form>

              {/* Google for org login */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => signIn('google', { callbackUrl: '/' }).catch(() => toast.error('Google sign-in failed.'))}>
                <GoogleIcon className="size-4" /> Continue with Google
              </Button>

              {/* Register org */}
              {onRegisterOrg && (
                <button onClick={onRegisterOrg} className="w-full text-center text-sm text-emerald-600 hover:underline dark:text-emerald-400">
                  Don&apos;t have an organization? Register one →
                </button>
              )}

              <div className="rounded-lg border border-dashed border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  🎓 Participant? Use the event link shared by your organizer.
                </p>
              </div>
            </TabsContent>

            {/* ─── Quick Demo ───────────────────────────────────────── */}
            <TabsContent value="demo" className="mt-5 space-y-3">
              <DemoButton onClick={() => handleDemo('superadmin')} loading={demoLoading === 'superadmin'} icon={ShieldCheck} title="Super Admin" description="Platform admin — manage all orgs, plans & billing." accent="from-amber-600 to-orange-500" />
              <DemoButton onClick={() => handleDemo('orgadmin')} loading={demoLoading === 'orgadmin'} icon={Building2} title="Organization Admin" description="Demo Medical Association — manage events & certificates." accent="from-emerald-600 to-teal-500" />
              <div className="rounded-lg border border-dashed border-border p-4 text-center">
                <p className="text-sm text-muted-foreground">Participant? 🎓</p>
                <p className="mt-1 text-xs text-muted-foreground">Participants access events via the link shared by the organizer.</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <p className="text-center text-xs text-muted-foreground">
            By continuing you agree to our{' '}
            <a href="/?view=terms" className="underline hover:text-foreground">Terms</a> &{' '}
            <a href="/?view=privacy" className="underline hover:text-foreground">Privacy</a>.
          </p>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400">
            <Sparkles className="size-3" /> Start free. No payment required.
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

function DemoButton({
  onClick, loading, icon: Icon, title, description, accent, textOnDark = false,
}: {
  onClick: () => void; loading: boolean; icon: React.ComponentType<{ className?: string }>; title: string; description: string; accent: string; textOnDark?: boolean
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`group relative flex w-full items-center gap-3 rounded-xl border border-border bg-background p-4 text-left transition-all hover:border-transparent hover:shadow-md disabled:opacity-60 ${textOnDark ? 'text-white' : 'text-foreground'}`}>
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${accent} text-white shadow-sm`}>
        {loading ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${textOnDark ? 'text-white' : 'text-foreground'}`}>{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
