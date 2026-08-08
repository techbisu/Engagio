'use client'

import * as React from 'react'
import { motion } from 'framer-motion'

interface Step {
  number: string
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Create',
    description: 'Build your event and landing page.',
  },
  {
    number: '02',
    title: 'Register',
    description: 'Collect participants and payments.',
  },
  {
    number: '03',
    title: 'Engage',
    description: 'Run polls, quizzes, Q&A and live activities.',
  },
  {
    number: '04',
    title: 'Assess',
    description: 'Measure knowledge and learning outcomes.',
  },
  {
    number: '05',
    title: 'Certify',
    description: 'Generate and verify certificates.',
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
            From registration to certificate.
          </h2>
        </motion.div>

        <div className="relative mt-16">
          {/* Connecting line (desktop only) */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0 lg:block"
          />
          <ol className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
            {STEPS.map((step, i) => (
              <motion.li
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative flex flex-col items-center text-center"
              >
                <span className="relative z-10 grid size-14 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-lg font-bold text-white shadow-md shadow-emerald-600/20">
                  {step.number}
                </span>
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
