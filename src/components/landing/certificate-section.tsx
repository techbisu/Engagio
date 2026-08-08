'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { FileImage, QrCode, Globe, ShieldCheck } from 'lucide-react'
import { BrandLogo } from '@/components/shared/brand-logo'

interface CertItem {
  icon: typeof FileImage
  title: string
  description: string
}

const CERT_ITEMS: CertItem[] = [
  {
    icon: FileImage,
    title: 'Certificate PNG',
    description: 'Auto-generated branded certificate as a downloadable image.',
  },
  {
    icon: QrCode,
    title: 'Unique Verification QR',
    description: 'Every certificate includes a scannable QR for instant verification.',
  },
  {
    icon: Globe,
    title: 'Public Verification Page',
    description: 'Secure public link lets anyone verify authenticity in seconds.',
  },
]

export function CertificateSection() {
  return (
    <section
      id="certificates"
      className="relative overflow-hidden bg-background py-20 sm:py-24"
      aria-labelledby="cert-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 0% 50%, rgba(16,185,129,0.08), transparent 40%), radial-gradient(circle at 100% 50%, rgba(20,184,166,0.08), transparent 40%)',
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
            Certificates
          </span>
          <h2
            id="cert-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Finish with something participants can keep.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Automatically generate branded certificates for eligible participants
            and provide a secure verification page for every certificate.
          </p>
        </motion.div>

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          {/* Mock certificate preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, rotate: -2 }}
            whileInView={{ opacity: 1, scale: 1, rotate: -1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative mx-auto w-full max-w-md"
          >
            <div
              aria-hidden
              className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 blur-2xl"
            />
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-white p-6 shadow-xl dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <BrandLogo size="sm" />
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="size-3" />
                  Verified
                </span>
              </div>
              <div className="mt-6 text-center">
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Certificate of Completion
                </p>
                <p className="mt-3 text-xl font-semibold text-foreground">
                  Dr. Ada Lovelace
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  has successfully completed
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  Medical Summit 2026
                </p>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Issued on January 15, 2026
                </p>
              </div>
              <div className="mt-6 flex items-end justify-between border-t border-border pt-4">
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    Certificate No.
                  </p>
                  <p className="text-xs font-mono font-medium text-foreground">
                    EVT-2026-7K9M2N
                  </p>
                </div>
                <div className="grid size-12 place-items-center rounded-md bg-muted">
                  <QrCode className="size-9 text-foreground/70" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Capabilities */}
          <div className="space-y-4">
            {CERT_ITEMS.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex items-start gap-4 rounded-xl border border-border bg-background p-4 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/[0.03]"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                  <item.icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
