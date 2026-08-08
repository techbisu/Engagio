'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  CalendarPlus,
  ListPlus,
  Share2,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react'

interface Step {
  icon: LucideIcon
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    icon: CalendarPlus,
    title: 'Create an Event',
    description:
      'Set up your workshop or exam with title, dates, and description.',
  },
  {
    icon: ListPlus,
    title: 'Add Questions',
    description: 'Type them in or import from a CSV file in one click.',
  },
  {
    icon: Share2,
    title: 'Generate Quiz Link',
    description:
      'Get a unique shareable link with quiz settings — time limit, shuffle, and more.',
  },
  {
    icon: PlayCircle,
    title: 'Students Attempt',
    description:
      'Students login with Gmail and take the anti-cheat-protected quiz.',
  },
]

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-muted/30 py-20 sm:py-24"
      aria-labelledby="how-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 0% 0%, rgba(16,185,129,0.10), transparent 40%), radial-gradient(circle at 100% 100%, rgba(20,184,166,0.10), transparent 40%)',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            How it works
          </span>
          <h2
            id="how-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Launch a quiz in four simple steps
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            From event creation to live attempts in minutes — no setup wizard,
            no friction.
          </p>
        </motion.div>

        <div className="relative mt-16">
          {/* Connecting line (desktop only) */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0 lg:block"
          />
          <ol className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((step, i) => (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative flex flex-col items-center text-center"
              >
                <div className="relative z-10 flex size-16 flex-col items-center">
                  <span className="grid size-16 place-items-center rounded-full border border-emerald-500/30 bg-background text-lg font-bold text-emerald-600 shadow-sm">
                    {i + 1}
                  </span>
                  <step.icon
                    className="mt-3 size-5 text-emerald-600"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
                  {step.description}
                </p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
