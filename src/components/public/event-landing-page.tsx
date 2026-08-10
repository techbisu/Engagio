'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Calendar, Clock, FileQuestion, Target, ShieldCheck, ArrowRight, Building2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ParticipantLogin } from '@/components/auth/participant-login'
import { BrandLogo } from '@/components/shared/brand-logo'
import { LandingSectionsRenderer } from '@/components/public/landing-sections-renderer'
import type { ViewName, SafeUser, LandingSectionDto } from '@/types'

interface EventLandingPageProps {
  eventSlug: string
  user: SafeUser | null
  onNavigate: (view: ViewName) => void
  onStartQuiz: (quizSlug: string) => void
  onSignIn: () => void
}

interface EventData {
  event: {
    id: string
    title: string
    slug: string
    description: string
    image: string | null
    startDate: string
    endDate: string
    requireRegistration: boolean
    paymentMethod: string
    certEnabled: boolean
    certPassingScore: number
    organization: {
      id: string
      name: string
      slug: string
      logoUrl: string | null
      primaryColor: string
    } | null
  }
  quizLink: {
    id: string
    slug: string
    timeLimit: number
    maxAttempts: number
    passThreshold: number
    requireFullscreen: boolean
  } | null
  questionCount: number
}

export function EventLandingPage({ eventSlug, user, onNavigate, onStartQuiz, onSignIn }: EventLandingPageProps) {
  const { data, isLoading, isError } = useQuery<EventData>({
    queryKey: ['public-event', eventSlug],
    queryFn: () => fetch(`/api/public/event?slug=${eventSlug}`).then(r => {
      if (!r.ok) throw new Error('Event not found')
      return r.json()
    }),
    retry: false,
  })

  // Fetch custom landing sections for this event (visible only, public).
  const eventId = data?.event?.id
  const { data: sections } = useQuery<LandingSectionDto[]>({
    queryKey: ['public-event-landing-sections', eventId],
    queryFn: () =>
      fetch(`/api/public/event-landing?eventId=${encodeURIComponent(eventId!)}`).then((r) => {
        if (!r.ok) throw new Error('Failed to load sections')
        return r.json() as Promise<LandingSectionDto[]>
      }),
    enabled: !!eventId,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Calendar className="size-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Event not found</h1>
        <Button onClick={() => onNavigate('landing')}>Back to Engagio</Button>
      </div>
    )
  }

  const { event, quizLink, questionCount } = data
  const org = event.organization
  const customSections = sections ?? []

  // If user is signed in → show "Start Test" button
  // If not signed in → show ParticipantLogin
  const showLogin = !user
  const canStart = !!user && !!quizLink

  const handleStart = () => {
    if (quizLink) {
      onStartQuiz(quizLink.slug)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <button onClick={() => onNavigate('landing')} className="flex items-center gap-2">
            <BrandLogo size="sm" />
          </button>
          {org && (
            <button
              onClick={() => onNavigate('landing')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {org.logoUrl ? (
                <img src={org.logoUrl} alt={org.name} className="size-6 rounded" />
              ) : (
                <Building2 className="size-4" />
              )}
              {org.name}
            </button>
          )}
        </div>
      </header>

      {/* Event hero (basic info) */}
      <main className="flex-1 mx-auto max-w-4xl w-full px-4 py-8 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Event image */}
          {event.image && (
            <div className="mb-6 aspect-[16/7] w-full rounded-xl overflow-hidden bg-muted">
              <img src={event.image} alt={event.title} className="size-full object-cover" />
            </div>
          )}

          {/* Event info */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
            <p className="mt-2 text-base text-muted-foreground">{event.description}</p>
          </div>

          {/* Stats grid */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {questionCount > 0 && (
              <StatCard icon={FileQuestion} label="Questions" value={String(questionCount)} />
            )}
            {quizLink && quizLink.timeLimit > 0 && (
              <StatCard icon={Clock} label="Duration" value={`${quizLink.timeLimit} min`} />
            )}
            {quizLink && (
              <StatCard icon={Target} label="Pass mark" value={`${quizLink.passThreshold}%`} />
            )}
            <StatCard icon={Calendar} label="Starts" value={new Date(event.startDate).toLocaleDateString()} />
          </div>

          {/* Security info */}
          {quizLink && quizLink.requireFullscreen && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-amber-600" />
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  This test has anti-cheat protection enabled
                </p>
              </div>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Fullscreen mode, tab-switch detection, copy/paste blocking, and watermark overlay.
              </p>
            </div>
          )}
        </motion.div>
      </main>

      {/* Custom landing page sections (built by org admins) */}
      {customSections.length > 0 && (
        <LandingSectionsRenderer sections={customSections} />
      )}

      {/* Start test or login */}
      <main id="start" className="mx-auto max-w-4xl w-full px-4 py-8 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {showLogin ? (
            <Card className="border-emerald-200 dark:border-emerald-900">
              <CardHeader>
                <CardTitle className="text-lg">Join this event</CardTitle>
              </CardHeader>
              <CardContent>
                <ParticipantLogin
                  slug={quizLink?.slug}
                  eventTitle={event.title}
                  orgName={org?.name}
                  onSuccess={onSignIn}
                />
              </CardContent>
            </Card>
          ) : canStart ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 size-12 text-emerald-500" />
                <h3 className="text-lg font-semibold">Ready to start!</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  You're signed in as {user.name || user.email}. Click below to begin.
                </p>
                <Button
                  className="mt-4 bg-gradient-to-r from-emerald-600 to-teal-500 text-white"
                  size="lg"
                  onClick={handleStart}
                >
                  Start Test <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">This event doesn't have an active test yet.</p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Powered by <span className="font-medium">Engagio</span> · Engage. Learn. Connect.
      </footer>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <Icon className="mx-auto mb-1 size-4 text-emerald-600" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}
