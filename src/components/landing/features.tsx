'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  UserPlus,
  Radio,
  FileQuestion,
  BarChart3,
  Award,
  LayoutTemplate,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: UserPlus,
    title: 'Event Registration',
    description:
      'Create beautiful registration forms, collect participant information, and manage registrations from one place.',
  },
  {
    icon: Radio,
    title: 'Live Engagement',
    description:
      'Keep participants involved with live polls, quizzes, voting, Q&A, and interactive sessions.',
  },
  {
    icon: FileQuestion,
    title: 'Assessments',
    description:
      'Build quizzes, knowledge checks, certification tests, and workshop assessments using your reusable question bank.',
  },
  {
    icon: BarChart3,
    title: 'Results & Insights',
    description:
      'See participation, responses, scores, leaderboards, feedback, and learning outcomes.',
  },
  {
    icon: Award,
    title: 'Certificates',
    description:
      'Generate branded certificates automatically and let participants verify them through a secure public link.',
  },
  {
    icon: LayoutTemplate,
    title: 'Event Pages',
    description:
      'Build professional event landing pages with speakers, teams, schedules, sponsors, registration, and more.',
  },
]

export function Features() {
  return (
    <section
      id="features"
      className="relative bg-background py-20 sm:py-24"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Features
          </span>
          <h2
            id="features-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Everything your event needs. Nothing you don&apos;t.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Managing registration, engagement, assessments, results, and
            certificates across different tools creates unnecessary complexity.
            Engagio brings the entire experience together in one simple platform.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <FeatureCard {...feature} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ icon: Icon, title, description }: Feature) {
  return (
    <Card className="group h-full transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-600/5">
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <span className="grid size-12 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 transition-transform duration-300 group-hover:scale-110">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
