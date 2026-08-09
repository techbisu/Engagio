'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  HeartPulse,
  Wrench,
  Building2,
  Users,
  GraduationCap,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface UseCase {
  icon: LucideIcon
  title: string
  description: string
}

const USE_CASES: UseCase[] = [
  {
    icon: HeartPulse,
    title: 'Medical Summits',
    description:
      'Registration, CME-style assessments, live polling, case discussions, Q&A, feedback, and certificates.',
  },
  {
    icon: Wrench,
    title: 'Workshops',
    description:
      'Pre-tests, interactive activities, post-tests, learning improvement, and certificates.',
  },
  {
    icon: Building2,
    title: 'Corporate Training',
    description:
      'Employee registration, knowledge checks, assessments, feedback, and completion certificates.',
  },
  {
    icon: Users,
    title: 'Conferences',
    description:
      'Event pages, registration, live audience engagement, Q&A, voting, and analytics.',
  },
  {
    icon: GraduationCap,
    title: 'Educational Events',
    description:
      'Quizzes, competitions, assessments, leaderboards, and certificates.',
  },
  {
    icon: Video,
    title: 'Seminars & Webinars',
    description:
      'Registration, polls, Q&A, feedback, and participant engagement.',
  },
]

export function UseCases() {
  return (
    <section
      id="solutions"
      className="relative bg-background py-20 sm:py-24"
      aria-labelledby="use-cases-heading"
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
            Solutions
          </span>
          <h2
            id="use-cases-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Built for every kind of gathering.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Engagio adapts to your format — from small workshops to large-scale
            conferences and certification programs.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((uc, i) => (
            <motion.div
              key={uc.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <UseCaseCard {...uc} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function UseCaseCard({ icon: Icon, title, description }: UseCase) {
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
