"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { signOut } from "next-auth/react"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Loader2,
  LogOut,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BrandLogo } from "@/components/shared/brand-logo"

interface NoOrgRedirectProps {
  /** Email of the user who signed in but has no organization. */
  email?: string
  /** Called when the user clicks "Register Organization". */
  onRegister: () => void
  /** Called when the user clicks "Back to home". */
  onHome: () => void
}

/**
 * Intermediate page shown after a Google OAuth login when the user has NO
 * organization membership. Explains the situation clearly and routes the user
 * toward registration (or sign-out so they can try a different account).
 */
export function NoOrgRedirect({ email, onRegister, onHome }: NoOrgRedirectProps) {
  const [signingOut, setSigningOut] = React.useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut({ redirect: false })
    } catch {
      // Even if signOut fails, send them home so they aren't stuck.
    } finally {
      setSigningOut(false)
      onHome()
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20">
      {/* Decorative background blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-0 size-80 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-0 size-96 rounded-full bg-teal-300/20 blur-3xl dark:bg-teal-500/10"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-8 sm:px-6 sm:py-12">
        {/* Top bar */}
        <div className="mb-8 flex items-center justify-between">
          <button
            type="button"
            onClick={onHome}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            aria-label="Back to Engagio home"
          >
            <ArrowLeft className="size-4" /> Back to home
          </button>
          <BrandLogo size="sm" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex flex-1 items-center justify-center"
        >
          <Card className="w-full overflow-hidden border-slate-200 bg-white/90 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            {/* Amber warning banner */}
            <div className="relative flex items-start gap-3 bg-gradient-to-br from-amber-50 to-orange-50 px-6 py-5 dark:from-amber-950/40 dark:to-orange-950/30">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
                <AlertTriangle className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  No organization found
                </h2>
                {email && (
                  <p className="mt-0.5 truncate text-sm text-amber-800/80 dark:text-amber-200/80">
                    Signed in as <span className="font-medium">{email}</span>
                  </p>
                )}
              </div>
            </div>

            <CardHeader className="space-y-3 pt-6">
              <CardTitle className="text-xl text-slate-900 dark:text-slate-50">
                You need an organization to use Engagio
              </CardTitle>
              <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                Your Google account is signed in, but it isn&apos;t linked to any
                Engagio organization yet. Register a new organization to unlock the
                admin dashboard, events, activities, and certificates.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Building2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-medium">Register a workspace</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Create an organization for your team, events, and participants.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-medium">Free to start</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Host up to 3 events and 50 participants on the free plan. No card.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                size="lg"
                onClick={onRegister}
                className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700"
              >
                <Building2 className="size-5" />
                Register Organization
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                Not the right account? Sign out and try a different one.
              </p>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="gap-2"
                >
                  {signingOut ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogOut className="size-4" />
                  )}
                  Sign out
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onHome}
                  className="gap-2"
                >
                  <ArrowLeft className="size-4" />
                  Back to home
                </Button>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
