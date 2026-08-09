'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Heart, Target, Users, Zap } from 'lucide-react'
import { BrandLogo } from '@/components/shared/brand-logo'
import { Button } from '@/components/ui/button'
import type { ViewName } from '@/types'

interface AboutPageProps {
  onNavigate: (view: ViewName) => void
}

export function AboutPage({ onNavigate }: AboutPageProps) {
  const values = [
    {
      icon: Heart,
      title: 'Simplicity first',
      description:
        'Powerful tools don\'t have to be complicated. We obsess over removing friction so organizers can focus on their participants, not their software.',
    },
    {
      icon: Target,
      title: 'Real engagement',
      description:
        'Passive audiences are a missed opportunity. Every feature we build is designed to turn spectators into participants.',
    },
    {
      icon: Users,
      title: 'Built for teams',
      description:
        'From small workshops to large conferences, Engagio scales with your team — with roles, permissions, and collaboration built in.',
    },
    {
      icon: Zap,
      title: 'Fast & lightweight',
      description:
        'No bloated software, no unnecessary dependencies. Just a fast, modern platform that works on any device.',
    },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/50 to-background dark:from-emerald-950/20">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 flex justify-center">
              <BrandLogo size="lg" />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <Sparkles className="size-3" />
              About Engagio
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              We believe every event
              <br />
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                deserves engagement.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Engagio was born from a simple frustration: running an interactive
              event meant juggling registration tools, polling apps, quiz platforms,
              and certificate generators. We knew there had to be a better way.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                onClick={() => onNavigate('pricing')}
                className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-600/90 hover:to-teal-500/90"
              >
                Get started free
              </Button>
              <Button variant="outline" onClick={() => onNavigate('contact')}>
                Contact us
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Story */}
      <section className="bg-background py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="prose prose-slate dark:prose-invert max-w-none"
          >
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Our story
            </h2>
            <div className="mt-4 space-y-4 text-base text-muted-foreground">
              <p>
                We started Engagio after watching medical summits, corporate
                workshops, and educational events struggle with the same problem:
                too many disconnected tools. Registration here, polls there,
                quizzes somewhere else, certificates manually generated in
                Photoshop.
              </p>
              <p>
                We knew the answer wasn't another single-purpose app. It was a
                unified platform that could handle the entire participant journey
                — from the moment someone registers to the moment they share their
                achievement.
              </p>
              <p>
                Today, Engagio helps organizations create events that people
                actually want to participate in. Not just sit through.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              What we value
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              The principles that guide every feature we build.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {values.map((value, i) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="rounded-xl border border-border bg-background p-6"
              >
                <div className="flex size-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <value.icon className="size-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {value.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-emerald-600 to-teal-500 py-16">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to make your next event more engaging?
          </h2>
          <p className="mt-3 text-emerald-50">
            Start free. No payment required.
          </p>
          <Button
            variant="secondary"
            className="mt-6 bg-white text-emerald-700 hover:bg-emerald-50"
            onClick={() => onNavigate('login')}
          >
            Create your first event
          </Button>
        </div>
      </section>
    </div>
  )
}
