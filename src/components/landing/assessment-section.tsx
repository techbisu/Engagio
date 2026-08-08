'use client'

import * as React from 'react'
import { motion } from 'framer-motion'

const CAPABILITIES = [
  'MCQ',
  'True / False',
  'Fill in the Blank',
  'Matching',
  'Coding',
  'Categories',
  'Tags',
  'Difficulty',
  'Negative Marking',
  'Random Questions',
  'Anti-Cheat',
  'AI Proctoring',
  'Results',
  'Leaderboards',
] as const

export function AssessmentSection() {
  return (
    <section
      id="assessment"
      className="relative bg-background py-20 sm:py-24"
      aria-labelledby="assessment-heading"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Assessments
          </span>
          <h2
            id="assessment-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            More than a quiz.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Build everything from a quick knowledge check to a fully secured
            certification assessment.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-10 flex flex-wrap justify-center gap-2.5"
        >
          {CAPABILITIES.map((cap) => (
            <span
              key={cap}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-700 dark:hover:text-emerald-400"
            >
              <span className="size-1.5 rounded-full bg-emerald-500/70" aria-hidden="true" />
              {cap}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
