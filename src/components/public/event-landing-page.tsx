'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Calendar,
  Clock,
  FileQuestion,
  Target,
  ShieldCheck,
  ArrowRight,
  Building2,
  CheckCircle2,
  MapPin,
  Users,
  Award,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ParticipantLogin } from '@/components/auth/participant-login'
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
    paymentAmount: number
    paymentCurrency: string
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
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <Calendar className="size-12 text-slate-600" />
        <h1 className="text-2xl font-bold">Event not found</h1>
        <Button onClick={() => onNavigate('landing')} variant="outline">Back to Engagio</Button>
      </div>
    )
  }

  const { event, quizLink, questionCount } = data
  const org = event.organization
  const customSections = sections ?? []

  const showLogin = !user
  const canStart = !!user && !!quizLink

  const handleStart = () => {
    if (quizLink) {
      onStartQuiz(quizLink.slug)
    }
  }

  // Format dates nicely
  const startDate = new Date(event.startDate)
  const endDate = new Date(event.endDate)
  const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const isMultiDay = endDate.toDateString() !== startDate.toDateString()
  const endDateStr = endDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  // Determine event type badge
  const isFree = event.paymentMethod === 'FREE' || event.paymentAmount === 0
  const hasCert = event.certEnabled

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      {/* ═══ HERO SECTION — full-width banner with event image ═══ */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden">
        {/* Background image with dark overlay */}
        {event.image ? (
          <div className="absolute inset-0">
            <img src={event.image} alt={event.title} className="size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/40" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/60 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-950">
            {/* Decorative pattern */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
          </div>
        )}

        {/* Top bar — org branding only (NO Engagio topbar) */}
        <div className="absolute inset-x-0 top-0 z-20">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
            {/* Org logo + name */}
            <div className="flex items-center gap-3">
              {org?.logoUrl ? (
                <img src={org.logoUrl} alt={org.name} className="size-10 rounded-xl object-cover ring-2 ring-white/20" />
              ) : (
                <div className="grid size-10 place-items-center rounded-xl bg-white/10 ring-2 ring-white/20 backdrop-blur">
                  <Building2 className="size-5 text-white" />
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-white">{org?.name || 'Organization'}</p>
                <p className="text-[11px] text-white/60">Presents</p>
              </div>
            </div>

            {/* Event type badge */}
            <div className="flex items-center gap-2">
              {isFree ? (
                <Badge className="bg-emerald-500/90 text-white backdrop-blur hover:bg-emerald-500">
                  Free Event
                </Badge>
              ) : (
                <Badge className="bg-amber-500/90 text-white backdrop-blur hover:bg-amber-500">
                  {event.paymentCurrency} {event.paymentAmount}
                </Badge>
              )}
              {hasCert && (
                <Badge className="bg-white/10 text-white backdrop-blur hover:bg-white/20 ring-1 ring-white/20">
                  <Award className="size-3" /> Certificate
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Date pill */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-1.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/30 backdrop-blur">
              <Calendar className="size-4" />
              {isMultiDay ? `${dateStr} – ${endDateStr}` : `${dateStr} · ${timeStr}`}
            </div>

            {/* Title */}
            <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              {event.title}
            </h1>

            {/* Description */}
            {event.description && (
              <p className="mt-4 max-w-2xl text-base text-white/70 sm:text-lg">
                {event.description}
              </p>
            )}

            {/* Quick stats row */}
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/80">
              {questionCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <FileQuestion className="size-4 text-emerald-400" />
                  {questionCount} Questions
                </span>
              )}
              {quizLink && quizLink.timeLimit > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4 text-emerald-400" />
                  {quizLink.timeLimit} min
                </span>
              )}
              {quizLink && (
                <span className="inline-flex items-center gap-1.5">
                  <Target className="size-4 text-emerald-400" />
                  Pass: {quizLink.passThreshold}%
                </span>
              )}
              {org && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4 text-emerald-400" />
                  Online
                </span>
              )}
            </div>

            {/* CTA button */}
            <div className="mt-8">
              {showLogin ? (
                <Button
                  size="lg"
                  className="bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
                  onClick={() => {
                    document.getElementById('join')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  Register Now <ArrowRight className="size-4" />
                </Button>
              ) : canStart ? (
                <Button
                  size="lg"
                  className="bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
                  onClick={handleStart}
                >
                  Start Test <ArrowRight className="size-4" />
                </Button>
              ) : null}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ DETAILS SECTION — stats grid + security info ═══ */}
      <section className="border-t border-white/5 bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DetailStat icon={FileQuestion} label="Questions" value={String(questionCount || 0)} />
            <DetailStat icon={Clock} label="Duration" value={quizLink?.timeLimit ? `${quizLink.timeLimit} min` : '—'} />
            <DetailStat icon={Target} label="Pass Mark" value={quizLink ? `${quizLink.passThreshold}%` : '—'} />
            <DetailStat icon={Calendar} label="Date" value={startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
          </div>

          {/* Security info */}
          {quizLink && quizLink.requireFullscreen && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-500/15">
                <ShieldCheck className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  Anti-cheat protection enabled
                </p>
                <p className="mt-0.5 text-xs text-amber-200/70">
                  Fullscreen mode, tab-switch detection, copy/paste blocking, and watermark overlay.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══ CUSTOM SECTIONS (built by org admin) ═══ */}
      {customSections.length > 0 && (
        <div className="dark bg-slate-950 text-white">
          <LandingSectionsRenderer sections={customSections} />
        </div>
      )}

      {/* ═══ JOIN / START SECTION ═══ */}
      <section id="join" className="border-t border-white/5 bg-slate-900/50">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            {showLogin ? (
              <div>
                <div className="mb-6 text-center">
                  <h2 className="text-2xl font-bold text-white sm:text-3xl">Join this event</h2>
                  <p className="mt-2 text-sm text-white/60">
                    Sign in to participate in {event.title}
                  </p>
                </div>
                <Card className="border-white/10 bg-white/5 backdrop-blur">
                  <CardContent className="pt-6">
                    <ParticipantLogin
                      slug={quizLink?.slug}
                      eventTitle={event.title}
                      orgName={org?.name}
                      onSuccess={onSignIn}
                    />
                  </CardContent>
                </Card>
              </div>
            ) : canStart ? (
              <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent">
                <CardContent className="py-10 text-center">
                  <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-emerald-500/20">
                    <CheckCircle2 className="size-8 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Ready to start!</h3>
                  <p className="mt-2 text-sm text-white/60">
                    You&apos;re signed in as <span className="font-semibold text-white">{user.name || user.email}</span>.
                    Click below to begin your test.
                  </p>
                  <Button
                    className="mt-6 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
                    size="lg"
                    onClick={handleStart}
                  >
                    Start Test <ArrowRight className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-white/10 bg-white/5">
                <CardContent className="py-10 text-center">
                  <p className="text-white/60">This event doesn&apos;t have an active test yet.</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </section>

      {/* ═══ FOOTER — powered by Engagio only ═══ */}
      <footer className="mt-auto border-t border-white/5 bg-slate-950 py-6">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="text-sm text-white/40">
            Powered by <span className="font-bold text-white/60">Engagio</span>
          </p>
        </div>
      </footer>
    </div>
  )
}

function DetailStat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur">
      <Icon className="mx-auto mb-2 size-5 text-emerald-400" />
      <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-white">{value}</p>
    </div>
  )
}
