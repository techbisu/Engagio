'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Maximize2,
  AppWindow,
  Clipboard,
  Keyboard,
  MousePointerClick,
  Droplet,
  ShieldAlert,
  ScanFace,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface SecurityItem {
  icon: LucideIcon
  title: string
}

const SECURITY_ITEMS: SecurityItem[] = [
  { icon: Maximize2, title: 'Fullscreen Protection' },
  { icon: AppWindow, title: 'Tab Detection' },
  { icon: Clipboard, title: 'Copy/Paste Protection' },
  { icon: Keyboard, title: 'Keyboard Protection' },
  { icon: MousePointerClick, title: 'Right-Click Protection' },
  { icon: Droplet, title: 'Watermarking' },
  { icon: ShieldAlert, title: 'Security Monitoring' },
  { icon: ScanFace, title: 'AI Proctoring' },
]

export function SecuritySection() {
  return (
    <section
      id="security"
      className="relative bg-muted/30 py-16 sm:py-20"
      aria-labelledby="security-heading"
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
            Security
          </span>
          <h2
            id="security-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Assess with confidence.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            For formal assessments, Engagio provides configurable security and
            anti-cheat controls to help maintain assessment integrity.
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SECURITY_ITEMS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <Card className="border-border/60 py-0 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/[0.03]">
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
                    <item.icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
