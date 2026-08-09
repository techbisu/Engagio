'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Sparkles,
  Users,
  CheckCircle2,
  Radio,
  HelpCircle,
  FileCheck2,
  Award,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BrandLogo } from '@/components/shared/brand-logo'
import type { ViewName, SafeUser } from '@/types'

interface HeroProps {
  onNavigate: (view: ViewName) => void
  session?: { user: SafeUser } | null
}

const STATS = [
  { value: '10k+', label: 'Participants' },
  { value: '500+', label: 'Events' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.9/5', label: 'Rating' },
] as const

export function Hero({ onNavigate }: HeroProps) {
  return (
    <section
      id="home"
      className="relative overflow-hidden bg-background"
      aria-labelledby="hero-heading"
    >
      {/* Background mesh + orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-emerald-400/20 blur-[120px]" />
        <div className="absolute top-24 -right-24 size-[32rem] rounded-full bg-teal-400/15 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 size-[24rem] rounded-full bg-amber-300/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(16,185,129,0.25), transparent 45%), radial-gradient(circle at 80% 0%, rgba(20,184,166,0.22), transparent 50%), radial-gradient(circle at 50% 100%, rgba(245,158,11,0.10), transparent 55%)',
          }}
        />
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-8 lg:px-8 lg:pb-28 lg:pt-24">
        {/* Left column */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Badge
            variant="outline"
            className="mb-5 gap-1.5 rounded-full border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-emerald-700 dark:text-emerald-400"
          >
            <Sparkles className="size-3.5" />
            INTERACTIVE EVENTS &amp; LEARNING
          </Badge>

          <h1
            id="hero-heading"
            className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Turn every event into an{' '}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              experience.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Create engaging events, workshops, conferences, training programs,
            and assessments — with registration, live activities, quizzes,
            results, and certificates all in one platform.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() => onNavigate('login')}
              className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-600/95 hover:to-teal-500/95"
            >
              Get started free
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                document
                  .getElementById('features')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Explore the platform
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Start free. No payment required. Create your organization in seconds.
          </p>

          <dl className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt className="text-2xl font-bold text-foreground sm:text-3xl">
                  {s.value}
                </dt>
                <dd className="text-sm text-muted-foreground">{s.label}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        {/* Right column: dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <DashboardMockupCard />
        </motion.div>
      </div>
    </section>
  )
}

function DashboardMockupCard() {
  return (
    <div className="relative">
      {/* Glow under the card */}
      <div
        aria-hidden
        className="absolute inset-6 -z-10 rounded-3xl bg-gradient-to-br from-emerald-500/40 to-teal-500/40 blur-2xl"
      />

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="rotate-1 rounded-3xl border border-white/40 bg-white/85 p-5 shadow-2xl shadow-emerald-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 sm:p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" iconOnly />
            <div>
              <p className="text-sm font-semibold text-foreground">Engagio</p>
              <p className="text-[11px] text-muted-foreground">
                Event Dashboard
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">
              Medical Summit 2026
            </p>
            <p className="text-[11px] text-muted-foreground">Live event</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatPill
            icon={Users}
            label="Participants"
            value="1,248"
          />
          <StatPill
            icon={Activity}
            label="Activities"
            value="8"
          />
        </div>

        {/* Mini activity cards */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard
            icon={BarChart3}
            title="Live Poll"
            value="184 votes"
            tone="emerald"
            progress={72}
          />
          <MiniCard
            icon={Radio}
            title="Live Quiz"
            value="156 users"
            tone="teal"
            progress={58}
          />
        </div>

        {/* Activity list */}
        <ul className="mt-4 space-y-2">
          <ActivityRow
            icon={HelpCircle}
            label="Q&amp;A"
            value="74 questions"
          />
          <ActivityRow
            icon={FileCheck2}
            label="Assessment"
            value="86 completed"
          />
          <ActivityRow
            icon={Award}
            label="Certificates"
            value="184 eligible"
          />
        </ul>

        {/* Footer status */}
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            Live now
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            All systems operational
          </span>
        </div>
      </motion.div>

      {/* Floating mini badge */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-5 -top-5 hidden rounded-xl border border-border bg-background p-3 shadow-lg sm:block"
      >
        <p className="text-[11px] text-muted-foreground">Engagement</p>
        <p className="text-base font-bold text-emerald-600">+34%</p>
      </motion.div>
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-4 -right-3 hidden rounded-xl border border-border bg-background p-3 shadow-lg sm:block"
      >
        <p className="text-[11px] text-muted-foreground">Avg. score</p>
        <p className="text-base font-bold text-emerald-600">82%</p>
      </motion.div>
    </div>
  )
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/70 p-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}

function MiniCard({
  icon: Icon,
  title,
  value,
  tone,
  progress,
}: {
  icon: typeof BarChart3
  title: string
  value: string
  tone: 'emerald' | 'teal'
  progress: number
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-3">
      <div className="flex items-center gap-1.5 text-foreground">
        <Icon
          className={
            'size-4 ' +
            (tone === 'emerald' ? 'text-emerald-600' : 'text-teal-600')
          }
        />
        <span className="text-xs font-medium">{title}</span>
      </div>
      <p className="mt-1.5 text-base font-bold text-foreground">{value}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={
            'h-full rounded-full ' +
            (tone === 'emerald'
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
              : 'bg-gradient-to-r from-teal-500 to-teal-400')
          }
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

function ActivityRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HelpCircle
  label: string
  value: string
}) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2">
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5 text-emerald-600" />
        {label}
      </span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </li>
  )
}
