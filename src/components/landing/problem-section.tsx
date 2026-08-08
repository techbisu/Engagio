'use client'

import * as React from 'react'
import { motion } from 'framer-motion'

export function ProblemSection() {
  return (
    <section
      id="problem"
      className="bg-background py-20 sm:py-24"
      aria-labelledby="problem-heading"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8"
      >
        <h2
          id="problem-heading"
          className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          Everything your event needs. Nothing you don&apos;t.
        </h2>
        <p className="mt-5 text-base text-muted-foreground sm:text-lg">
          Managing registration, participant engagement, assessments, results,
          and certificates across different tools creates unnecessary
          complexity. Engagio brings the entire experience together in one simple
          platform.
        </p>
      </motion.div>
    </section>
  )
}
