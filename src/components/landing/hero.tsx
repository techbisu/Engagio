'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  PlayCircle,
  Sparkles,
  ShieldCheck,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ViewName } from '@/types'

interface HeroProps {
  onNavigate: (view: ViewName) => void
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
            Workshop & Event Quiz Platform
          </Badge>

          <h1
            id="hero-heading"
            className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Run <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">flawless</span> quizzes for your next workshop or event.
          </h1>

          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Create events, import questions via CSV, generate shareable quiz
            links, and let participants attempt with anti-cheat protection — all in
            one beautiful platform.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() => onNavigate('login')}
              className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-600/95 hover:to-teal-500/95"
            >
              Get Started Free
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
              <PlayCircle className="size-4" />
              Watch Demo
            </Button>
          </div>

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

        {/* Right column: floating quiz mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: -3 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <QuizMockupCard />
        </motion.div>
      </div>
    </section>
  )
}

function QuizMockupCard() {
  return (
    <div className="relative">
      {/* Glow under the card */}
      <div
        aria-hidden
        className="absolute inset-6 -z-10 rounded-3xl bg-gradient-to-br from-emerald-500/40 to-teal-500/40 blur-2xl"
      />
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="rounded-3xl border border-white/40 bg-white/80 p-6 shadow-2xl shadow-emerald-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Web Dev Workshop 2025
              </p>
              <p className="text-xs text-muted-foreground">Question 3 of 10</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          >
            <Clock className="size-3" />
            12:48
          </Badge>
        </div>

        <div className="mt-5">
          <p className="text-base font-medium text-foreground">
            Which HTTP method is idempotent and safe to call multiple times
            without changing server state?
          </p>

          <ul className="mt-4 space-y-2">
            {[
              { label: 'POST', selected: false },
              { label: 'GET', selected: true },
              { label: 'PATCH', selected: false },
              { label: 'DELETE', selected: false },
            ].map((opt) => (
              <li
                key={opt.label}
                className={
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ' +
                  (opt.selected
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-border bg-background text-foreground hover:border-emerald-500/30')
                }
              >
                <span
                  className={
                    'grid size-5 place-items-center rounded-full border text-xs font-medium ' +
                    (opt.selected
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-border text-muted-foreground')
                  }
                >
                  {opt.selected ? <CheckCircle2 className="size-3.5" /> : null}
                </span>
                {opt.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">
            Anti-cheat: fullscreen locked
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live attempt
          </span>
        </div>
      </motion.div>

      {/* Floating mini badge */}
      <motion.div
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-6 -top-6 hidden rounded-xl border border-border bg-background p-3 shadow-lg sm:block"
      >
        <p className="text-xs text-muted-foreground">Tab switches</p>
        <p className="text-lg font-bold text-emerald-600">0</p>
      </motion.div>
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-5 -right-4 hidden rounded-xl border border-border bg-background p-3 shadow-lg sm:block"
      >
        <p className="text-xs text-muted-foreground">Score</p>
        <p className="text-lg font-bold text-emerald-600">9 / 10</p>
      </motion.div>
    </div>
  )
}
