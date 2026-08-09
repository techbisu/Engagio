'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Calendar, Clock, FileQuestion, ArrowRight, Building2, Globe } from 'lucide-react'
import { BrandLogo } from '@/components/shared/brand-logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ViewName } from '@/types'

interface OrgLandingPageProps {
  orgSlug: string
  onNavigate: (view: ViewName) => void
  onOpenEvent: (eventSlug: string) => void
}

interface OrgData {
  organization: {
    id: string
    name: string
    slug: string
    description: string | null
    logoUrl: string | null
    website: string | null
    primaryColor: string
    secondaryColor: string
    industry: string | null
  }
  events: Array<{
    id: string
    title: string
    slug: string | null
    description: string
    image: string | null
    startDate: string
    endDate: string
    questionCount: number
    quizSlug: string | null
    timeLimit: number
    passThreshold: number
  }>
}

export function OrgLandingPage({ orgSlug, onNavigate, onOpenEvent }: OrgLandingPageProps) {
  const { data, isLoading, isError } = useQuery<OrgData>({
    queryKey: ['public-org', orgSlug],
    queryFn: () => fetch(`/api/public/org?slug=${orgSlug}`).then(r => {
      if (!r.ok) throw new Error('Organization not found')
      return r.json()
    }),
    retry: false,
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
        <Building2 className="size-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Organization not found</h1>
        <p className="text-muted-foreground">The organization you're looking for doesn't exist or is not active.</p>
        <Button onClick={() => onNavigate('landing')}>Back to Engagio</Button>
      </div>
    )
  }

  const org = data.organization

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header with org branding */}
      <header className="border-b" style={{ borderColor: `${org.primaryColor}30` }}>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="flex items-center gap-4">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="size-12 rounded-lg object-cover" />
            ) : (
              <div
                className="flex size-12 items-center justify-center rounded-lg text-white font-bold text-lg"
                style={{ background: `linear-gradient(135deg, ${org.primaryColor}, ${org.secondaryColor})` }}
              >
                {org.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold" style={{ color: org.primaryColor }}>{org.name}</h1>
              {org.industry && <p className="text-sm text-muted-foreground">{org.industry}</p>}
            </div>
            <div className="ml-auto">
              <Button variant="ghost" size="sm" onClick={() => onNavigate('landing')}>
                <BrandLogo size="sm" />
              </Button>
            </div>
          </div>
          {org.description && (
            <p className="mt-3 text-sm text-muted-foreground max-w-2xl">{org.description}</p>
          )}
        </div>
      </header>

      {/* Events list */}
      <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Events</h2>
          <p className="text-sm text-muted-foreground">Browse and participate in available events.</p>
        </div>

        {data.events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="mx-auto mb-3 size-10 text-muted-foreground" />
              <p className="text-muted-foreground">No active events yet. Check back later.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.events.map((event, i) => (
              <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => event.slug && onOpenEvent(event.slug)}>
                  {event.image && (
                    <div className="aspect-[16/7] w-full bg-muted overflow-hidden">
                      <img src={event.image} alt={event.title} className="size-full object-cover" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg">{event.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {event.questionCount > 0 && (<span className="flex items-center gap-1"><FileQuestion className="size-3.5" />{event.questionCount} questions</span>)}
                      {event.timeLimit > 0 && (<span className="flex items-center gap-1"><Clock className="size-3.5" />{event.timeLimit} min</span>)}
                      <span className="flex items-center gap-1"><Calendar className="size-3.5" />{new Date(event.startDate).toLocaleDateString()}</span>
                    </div>
                    <Button className="mt-4 w-full" style={{ background: `linear-gradient(135deg, ${org.primaryColor}, ${org.secondaryColor})` }} onClick={(e) => { e.stopPropagation(); if (event.slug) onOpenEvent(event.slug) }}>
                      View Event <ArrowRight className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Powered by <span className="font-medium">Engagio</span> · Engage. Learn. Connect.
      </footer>
    </div>
  )
}
