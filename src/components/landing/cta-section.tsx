'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ViewName } from '@/types'

interface CtaSectionProps {
  onNavigate: (view: ViewName) => void
}

export function CtaSection({ onNavigate }: CtaSectionProps) {
  return (
    <section className="bg-background px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-500 px-6 py-14 text-center shadow-2xl shadow-emerald-600/30 sm:px-12 sm:py-20"
      >
        {/* Decorative orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.18), transparent 40%), radial-gradient(circle at 100% 100%, rgba(255,255,255,0.12), transparent 40%)',
          }}
        />
        <div aria-hidden className="absolute -top-10 -right-10 size-48 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-10 -left-10 size-56 rounded-full bg-teal-300/20 blur-3xl" />

        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to launch your next quiz?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-emerald-50 sm:text-lg">
            Spin up an event, import your questions, and share a link in
            minutes. No credit card required.
          </p>
          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              onClick={() => onNavigate('login')}
              className="bg-white text-emerald-700 shadow-lg hover:bg-emerald-50"
            >
              Get Started Free
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
