'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  FileSpreadsheet,
  Link as LinkIcon,
  Mail,
  ShieldCheck,
  Shuffle,
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
    icon: FileSpreadsheet,
    title: 'CSV Question Import',
    description:
      'Bulk upload questions from CSV in seconds — supports question, four options, correct answer, marks, and explanation columns.',
  },
  {
    icon: ShieldCheck,
    title: 'Anti-Cheat Protection',
    description:
      'Fullscreen lock, tab-switch detection, copy & right-click prevention, plus IP and user-agent logging on every attempt.',
  },
  {
    icon: Shuffle,
    title: 'Random Question Order',
    description:
      'Every student sees questions in a different order. Optionally shuffle option order too — no two attempts look alike.',
  },
  {
    icon: Mail,
    title: 'Gmail Login',
    description:
      'Frictionless Google OAuth for students. One click and they’re in — no password resets, no signup friction.',
  },
  {
    icon: LinkIcon,
    title: 'Quiz Link Generator',
    description:
      'Get a unique shareable link per event or workshop. Configure time limit, max attempts, pass threshold, and more.',
  },
  {
    icon: BarChart3,
    title: 'Live Analytics',
    description:
      'Real-time results and per-question insights. Spot which questions students struggle with and improve your content.',
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
            Everything you need to run a quiz
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            From question authoring to anti-cheat proctoring and analytics —
            QuizMaster Pro handles it all, end to end.
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
