"use client"

/**
 * Public quiz landing — shown when an unauthenticated user opens a quiz link.
 * Displays event information (title, description, quiz code, summary stats,
 * anti-cheat warnings) and a Google sign-in button. This replaces the old
 * "blank page with only a Google login button" experience.
 */

import * as React from "react"
import {
  ArrowLeft,
  Clock,
  HelpCircle,
  Layers,
  Maximize,
  ShieldAlert,
  Target,
  Lock,
  ScanFace,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ParticipantGoogleLogin } from "@/components/auth/participant-google-login"
import { SiteHeader } from "@/components/shared/site-header"
import { SiteFooter } from "@/components/shared/site-footer"
import { useAppNavigate } from "@/lib/nav"

export interface PublicQuizMeta {
  quizLink: { slug: string }
  event?: {
    id: string
    title: string
    description?: string | null
    image?: string | null
  } | null
  eventSlug?: string | null
  orgSlug?: string | null
  questionCount: number
  /** Number of questions the admin wants to pick per attempt (0 = all). */
  quizLinkQuestionCount?: number
  timeLimit: number
  passThreshold: number
  maxAttempts: number
  requireFullscreen: boolean
  requireRegistration?: boolean
  security?: {
    aiProctor?: boolean
    tabSwitchDetection?: boolean
    copyPasteBlocking?: boolean
    rightClickDisable?: boolean
    keyboardShortcutBlocking?: boolean
    devtoolsDetection?: boolean
    antiScreenshot?: boolean
    watermarkOverlay?: boolean
    aiProctorFaceDetection?: boolean
    aiProctorMultiFace?: boolean
    aiProctorLookAway?: boolean
  }
}

interface QuizLandingPublicProps {
  meta: PublicQuizMeta | null
  loading: boolean
  notFound: boolean
  /** The callback URL to return to after Google sign-in (the current quiz URL). */
  callbackUrl: string
  /** Optional onBack handler (e.g. navigate to dashboard). Defaults to home. */
  onBack?: () => void
}

export function QuizLandingPublic({
  meta,
  loading,
  notFound,
  callbackUrl,
  onBack,
}: QuizLandingPublicProps) {
  const navigate = useAppNavigate()
  const handleBack = onBack ?? (() => navigate("/"))

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
        <SiteHeader session={null} onNavigate={navigate} onSignOut={() => {}} />
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Loading quiz…
            </p>
          </div>
        </main>
        <SiteFooter onNavigate={navigate} />
      </div>
    )
  }

  if (notFound || !meta) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
        <SiteHeader session={null} onNavigate={navigate} onSignOut={() => {}} />
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-center text-xl">Quiz not found</CardTitle>
              <CardDescription className="text-center">
                This quiz link may have expired or is no longer active.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleBack} variant="outline" className="w-full">
                <ArrowLeft className="size-4" /> Back to Home
              </Button>
            </CardContent>
          </Card>
        </main>
        <SiteFooter onNavigate={navigate} />
      </div>
    )
  }

  const event = meta.event
  const hasImage = !!event?.image
  const security = meta.security || {}
  const securityActive =
    security.aiProctor ||
    security.tabSwitchDetection ||
    security.copyPasteBlocking ||
    security.rightClickDisable ||
    security.keyboardShortcutBlocking ||
    security.devtoolsDetection ||
    security.antiScreenshot ||
    security.watermarkOverlay ||
    meta.requireFullscreen

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <SiteHeader session={null} onNavigate={navigate} onSignOut={() => {}} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <button
          onClick={handleBack}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </button>

        {/* Hero card with event info */}
        <Card className="overflow-hidden">
          {hasImage && (
            <div className="relative aspect-[16/7] w-full bg-slate-100 dark:bg-slate-800">
              <img
                src={event!.image!}
                alt={event!.title}
                className="size-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = "none"
                }}
              />
            </div>
          )}
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
              >
                Quiz code: {meta.quizLink.slug}
              </Badge>
              {meta.requireFullscreen && (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
                >
                  <Maximize className="size-3" /> Fullscreen required
                </Badge>
              )}
              {security.aiProctor && (
                <Badge
                  variant="outline"
                  className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
                >
                  <ScanFace className="size-3" /> AI proctored
                </Badge>
              )}
            </div>
            <CardTitle className="text-2xl">{event?.title ?? "Quiz"}</CardTitle>
            {event?.description && (
              <CardDescription className="text-sm leading-relaxed sm:text-base">
                {event.description}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Summary grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryItem
                icon={HelpCircle}
                label="Questions"
                value={String(
                  meta.quizLinkQuestionCount && meta.quizLinkQuestionCount > 0
                    ? meta.quizLinkQuestionCount
                    : meta.questionCount
                )}
              />
              <SummaryItem
                icon={Clock}
                label="Time limit"
                value={meta.timeLimit > 0 ? `${meta.timeLimit} min` : "No limit"}
              />
              <SummaryItem
                icon={Target}
                label="Pass mark"
                value={`${meta.passThreshold}%`}
              />
              <SummaryItem
                icon={Layers}
                label="Max attempts"
                value={meta.maxAttempts > 0 ? String(meta.maxAttempts) : "∞"}
              />
            </div>

            <Separator />

            {/* Anti-cheat warning */}
            {securityActive && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="flex gap-3">
                  <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-amber-900 dark:text-amber-200">
                      Anti-cheat protection enabled
                    </p>
                    <p className="text-amber-800 dark:text-amber-300">
                      You&apos;ll need to enter fullscreen mode. Switching tabs,
                      copying, or right-clicking will be flagged.
                      {security.aiProctor && " AI proctoring requires camera access."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sign-in required notice */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                      Sign in required
                    </p>
                    <p className="text-sm text-emerald-800 dark:text-emerald-300">
                      Sign in with Google to take this quiz. Your email will be
                      used to track your attempt and issue certificates.
                    </p>
                  </div>
                  <ParticipantGoogleLogin
                    callbackUrl={callbackUrl}
                    className="w-full sm:w-auto"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      <SiteFooter onNavigate={navigate} />
    </div>
  )
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

// Re-export Button for the not-found case
import { Button } from "@/components/ui/button"
