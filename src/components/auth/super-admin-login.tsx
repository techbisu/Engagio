'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import { ArrowRight, Loader2, Lock, ShieldCheck } from 'lucide-react'
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

interface SuperAdminLoginProps {
  onSuccess: () => void
  onBack: () => void
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

export function SuperAdminLogin({ onSuccess, onBack }: SuperAdminLoginProps) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Email and password are required.')
      return
    }
    setSubmitting(true)
    try {
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
      // Verify this is actually a super admin
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
              Platform-level administration. Authorized personnel only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-3.5">
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
            </form>

            {/* Google */}
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-500">or</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
              onClick={() => signIn('google', { callbackUrl: '/?view=superadmin' }).catch(() => toast.error('Google sign-in failed.'))}
            >
              <GoogleIcon className="size-4" /> Continue with Google
            </Button>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <button
              onClick={onBack}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              ← Back to Engagio
            </button>
            <p className="text-center text-[11px] text-slate-500">
              Super Admin access is granted via database role, not email matching.
              Unauthorized access attempts are logged.
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  )
}
