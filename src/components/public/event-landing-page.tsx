'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Calendar,
  ArrowRight,
  Building2,
  Globe,
  Ticket,
  BarChart3,
  Award,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ParticipantGoogleLogin } from '@/components/auth/participant-google-login'
import { EventRegistrationForm } from '@/components/public/event-registration-form'
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
      description: string | null
    } | null
  }
  quizLink: {
    id: string
    slug: string
  } | null
  questionCount: number
  activitiesCount?: number
}

export function EventLandingPage({ eventSlug, user, onNavigate, onStartQuiz, onSignIn }: EventLandingPageProps) {
  const { data, isLoading, isError } = useQuery<EventData>({
    queryKey: ['public-event', eventSlug],
    queryFn: () => fetch('/api/public/event?slug=' + eventSlug).then(r => {
      if (!r.ok) throw new Error('Event not found')
      return r.json()
    }),
    retry: false,
  })

  const eventId = data?.event?.id
  const { data: sections } = useQuery<LandingSectionDto[]>({
    queryKey: ['public-event-landing-sections', eventId],
    queryFn: () =>
      fetch('/api/public/event-landing?eventId=' + encodeURIComponent(eventId!)).then((r) => {
        if (!r.ok) throw new Error('Failed to load sections')
        return r.json() as Promise<LandingSectionDto[]>
      }),
    enabled: !!eventId,
    staleTime: 60_000,
  })

  // ── Hooks below must run on EVERY render (React Rules of Hooks). ──
  // They previously lived after the isLoading/isError early returns, which
  // changed hook counts between renders and crashed the page in production
  // ("Rendered fewer hooks than expected" → client-side exception).
  const eventIdForReg = data?.event?.id ?? ''
  const { data: regCheckData } = useQuery<{ registered: boolean }>({
    queryKey: ['registration-check', eventIdForReg],
    queryFn: async () => {
      const res = await fetch('/api/registrations/check?eventId=' + encodeURIComponent(eventIdForReg))
      if (!res.ok) return { registered: false }
      return res.json()
    },
    enabled: !!user && !!eventIdForReg,
    retry: false,
  })
  const isRegistered = regCheckData?.registered === true

  const [showJoinModal, setShowJoinModal] = React.useState(false)
  const showLogin = !user
  const requireRegistration = data?.event?.requireRegistration ?? false

  // Auto-redirect logged-in users who don't need registration (or are already registered)
  React.useEffect(() => {
    if (showJoinModal && !showLogin && (!requireRegistration || isRegistered)) {
      setShowJoinModal(false)
      window.location.href = '/dashboard'
    }
  }, [showJoinModal, showLogin, requireRegistration, isRegistered])

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

  const { event, quizLink } = data
  const org = event.organization
  const customSections = sections ?? []
  const activitiesCount = data.activitiesCount || (quizLink ? 1 : 0)


  const startDate = new Date(event.startDate)
  const endDate = new Date(event.endDate)
  const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const endDateStr = endDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const isMultiDay = endDate.toDateString() !== startDate.toDateString()
  const diffMs = endDate.getTime() - startDate.getTime()
  const durationDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1)
  const isFree = event.paymentMethod === 'FREE' || event.paymentAmount === 0
  const hasCert = event.certEnabled

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      {/* HERO SECTION */}
      <section className="relative min-h-[80vh] flex items-end overflow-hidden">
        {event.image ? (
          <div className="absolute inset-0">
            <img src={event.image} alt={event.title} className="size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/50 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-950">
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
          </div>
        )}

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 z-20">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              {org?.logoUrl ? (
                <img src={org.logoUrl} alt={org.name} className="size-11 rounded-xl object-cover ring-2 ring-white/20" />
              ) : (
                <div className="grid size-11 place-items-center rounded-xl bg-white/10 ring-2 ring-white/20 backdrop-blur">
                  <Building2 className="size-5 text-white" />
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-white">{org?.name || 'Organization'}</p>
                <p className="text-[11px] text-white/50">Presents</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isFree ? (
                <Badge className="bg-emerald-500/90 text-white backdrop-blur hover:bg-emerald-500">Free Event</Badge>
              ) : (
                <Badge className="bg-amber-500/90 text-white backdrop-blur hover:bg-amber-500">{event.paymentCurrency} {event.paymentAmount}</Badge>
              )}
              {hasCert && (
                <Badge className="bg-white/10 text-white backdrop-blur hover:bg-white/20 ring-1 ring-white/20"><Award className="size-3" /> Certificate</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-1.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/30 backdrop-blur">
              <Calendar className="size-4" />
              {isMultiDay ? dateStr + ' to ' + endDateStr : dateStr}
            </div>

            <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              {event.title}
            </h1>

            {event.description && (
              <p className="mt-4 max-w-2xl text-base text-white/70 sm:text-lg">{event.description}</p>
            )}

            {/* Event info — NOT quiz details */}
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4 text-emerald-400" />
                {isMultiDay ? durationDays + ' days' : startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {event.requireRegistration && (
                <span className="inline-flex items-center gap-1.5">
                  <Ticket className="size-4 text-emerald-400" />
                  Registration Required
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Globe className="size-4 text-emerald-400" />
                Online
              </span>
              {hasCert && (
                <span className="inline-flex items-center gap-1.5">
                  <Award className="size-4 text-emerald-400" />
                  Certificate ({event.certPassingScore}% pass)
                </span>
              )}
            </div>

            <div className="mt-8 flex items-center gap-3">
              {showLogin ? (
                <Button size="lg" className="bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400" onClick={() => setShowJoinModal(true)}>
                  Register Now <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button size="lg" className="bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400" onClick={() => { window.location.href = '/dashboard' }}>
                  Go to Dashboard <ArrowRight className="size-4" />
                </Button>
              )}
              {org && <span className="text-sm text-white/50">by {org.name}</span>}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section className="border-t border-white/5 bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-white">About This Event</h2>
                <p className="mt-4 text-white/60 leading-relaxed">
                  {event.description || 'Join this event to participate in interactive sessions, quizzes, and more.'}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-3 grid size-10 place-items-center rounded-lg bg-emerald-500/15">
                    <Calendar className="size-5 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-white">Schedule</h3>
                  <p className="mt-1 text-sm text-white/50">
                    {isMultiDay ? durationDays + '-day event' : startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-3 grid size-10 place-items-center rounded-lg bg-emerald-500/15">
                    <Globe className="size-5 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-white">Format</h3>
                  <p className="mt-1 text-sm text-white/50">Online Event</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-3 grid size-10 place-items-center rounded-lg bg-emerald-500/15">
                    <BarChart3 className="size-5 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-white">Activities</h3>
                  <p className="mt-1 text-sm text-white/50">{activitiesCount} {activitiesCount === 1 ? 'activity' : 'activities'} available</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-bold text-white">Registration</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Price</span>
                    <span className="font-semibold text-white">{isFree ? 'Free' : event.paymentCurrency + ' ' + event.paymentAmount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Required</span>
                    <span className="font-semibold text-white">{event.requireRegistration ? 'Yes' : 'No'}</span>
                  </div>
                  {hasCert && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/50">Certificate</span>
                      <span className="font-semibold text-white">Included</span>
                    </div>
                  )}
                </div>
                <Button className="mt-6 w-full bg-emerald-500 text-white hover:bg-emerald-400" onClick={() => setShowJoinModal(true)}>
                  {showLogin ? 'Register Now' : 'Go to Dashboard'}
                </Button>
              </div>

              {org && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <h3 className="text-lg font-bold text-white">Organizer</h3>
                  <div className="mt-4 flex items-center gap-3">
                    {org.logoUrl ? (
                      <img src={org.logoUrl} alt={org.name} className="size-10 rounded-lg object-cover" />
                    ) : (
                      <div className="grid size-10 place-items-center rounded-lg bg-white/10">
                        <Building2 className="size-5 text-white/60" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-white">{org.name}</p>
                      <p className="text-xs text-white/50">Event Organizer</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CUSTOM SECTIONS */}
      {customSections.length > 0 && (
        <div className="dark bg-slate-950 text-white">
          <LandingSectionsRenderer sections={customSections} />
        </div>
      )}

      {/* JOIN / REGISTRATION MODAL */}
      <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Join {event.title}</DialogTitle>
            <DialogDescription>
              {event.requireRegistration
                ? 'Sign in with Google, then complete the registration form.'
                : 'Sign in with Google to access the event.'}
            </DialogDescription>
          </DialogHeader>

          {showLogin ? (
            <div className="space-y-4 py-4">
              <ParticipantGoogleLogin
                callbackUrl={event.requireRegistration ? '/register?event=' + event.id : '/dashboard'}
                className="w-full"
              />
              <p className="text-center text-xs text-muted-foreground">
                After signing in, you{event.requireRegistration ? "'ll complete a registration form" : "'ll be directed to your dashboard"}.
              </p>
            </div>
          ) : event.requireRegistration && !isRegistered ? (
            <div className="py-2">
              <EventRegistrationForm
                eventId={event.id}
                onSuccess={() => {
                  setShowJoinModal(false)
                  window.location.href = '/dashboard'
                }}
              />
            </div>
          ) : (
            <div className="space-y-4 py-4 text-center">
              <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-white/5 bg-slate-950 py-6">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="text-sm text-white/40">Powered by <span className="font-bold text-white/60">Engagio</span></p>
        </div>
      </footer>
    </div>
  )
}
