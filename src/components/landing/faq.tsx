'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface FaqItem {
  question: string
  answer: string
}

const FAQS: FaqItem[] = [
  {
    question: 'How does anti-cheat work?',
    answer:
      'When requireFullscreen is on, the quiz locks into fullscreen mode. We track tab switches (visibility change), fullscreen exits, copy attempts, and right-clicks. We also log IP address and user-agent on every attempt. If anything crosses your configured threshold, the attempt is flagged as CHEAT_DETECTED.',
  },
  {
    question: 'Can I import questions from a spreadsheet?',
    answer:
      'Yes — upload a CSV with the columns: question, option_a, option_b, option_c, option_d, correct_answer (a/b/c/d or 1/2/3/4), marks (optional), explanation (optional). The importer handles quoted CSV values and large files.',
  },
  {
    question: 'Do participants need an account?',
    answer:
      'They sign in with Gmail (Google OAuth) for production, or email for the demo. One click, no signup friction. First-time users are created automatically with the participant role.',
  },
  {
    question: 'Is the question order really random?',
    answer:
      'Yes — every participant gets a unique Fisher-Yates shuffle of the question order. You can also enable option shuffling so even two participants viewing the same question see the options in different orders.',
  },
  {
    question: 'Can I limit attempts?',
    answer:
      'Yes — set max attempts per quiz link (default 1). Once a participant exhausts their attempts, the link blocks them with a friendly message and shows their best score.',
  },
  {
    question: 'Does it work on Vercel?',
    answer:
      'Yes — the app is optimized for Vercel deployment with Postgres or Turso. The Prisma schema is portable; just swap the datasource provider and DATABASE_URL. SQLite is used for local dev only.',
  },
]

export function Faq() {
  return (
    <section
      id="faq"
      className="relative bg-background py-20 sm:py-24"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            FAQ
          </span>
          <h2
            id="faq-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Frequently asked questions
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Everything you need to know about the platform.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-10"
        >
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground sm:text-base">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}
