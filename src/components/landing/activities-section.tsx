'use client'

import * as React from 'react'
import { motion } from 'framer-motion'

interface Activity {
  emoji: string
  title: string
  description: string
}

const ACTIVITIES: Activity[] = [
  { emoji: '📊', title: 'Polls', description: 'Get instant audience opinions.' },
  { emoji: '⚡', title: 'Live Quiz', description: 'Turn sessions into interactive challenges.' },
  { emoji: '💬', title: 'Q&A', description: 'Let participants ask and upvote questions.' },
  { emoji: '🗳️', title: 'Voting', description: 'Let your audience choose.' },
  { emoji: '📋', title: 'Surveys', description: 'Collect structured feedback.' },
  { emoji: '🧠', title: 'Knowledge Checks', description: 'Measure understanding during a session.' },
  { emoji: '📝', title: 'Assessments', description: 'Run formal tests and certification exams.' },
]

export function ActivitiesSection() {
  return (
    <section
      id="activities"
      className="relative overflow-hidden bg-muted/30 py-20 sm:py-24"
      aria-labelledby="activities-heading"
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
            Activities
          </span>
          <h2
            id="activities-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Make your audience part of the experience.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Go beyond presentations. Let participants interact, respond, compete,
            ask questions, and learn in real time.
          </p>
        </motion.div>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {ACTIVITIES.map((activity, i) => (
            <motion.div
              key={activity.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
            >
              <ActivityCard {...activity} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ActivityCard({
  emoji,
  title,
  description,
}: Activity) {
  return (
    <div className="group flex h-full flex-col gap-2 rounded-xl border border-border bg-background p-4 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-md hover:shadow-emerald-600/5">
      <span
        className="grid size-11 place-items-center rounded-lg bg-emerald-500/5 text-xl ring-1 ring-emerald-500/10 transition-transform duration-300 group-hover:scale-110"
        aria-hidden="true"
      >
        {emoji}
      </span>
      <h3 className="mt-1 text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
