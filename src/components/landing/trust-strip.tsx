'use client'

import * as React from 'react'
import {
  ClipboardList,
  Radio,
  FileCheck2,
  BarChart3,
  Award,
  ChevronRight,
} from 'lucide-react'

const ITEMS = [
  { icon: ClipboardList, label: 'Registration' },
  { icon: Radio, label: 'Live Engagement' },
  { icon: FileCheck2, label: 'Assessments' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Award, label: 'Certificates' },
] as const

export function TrustStrip() {
  return (
    <section
      aria-label="Platform overview"
      className="border-y border-border/60 bg-muted/40"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ul className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          {ITEMS.map((item, i) => (
            <li
              key={item.label}
              className="flex items-center justify-center gap-2"
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="grid size-7 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <item.icon className="size-3.5" />
                </span>
                {item.label}
              </span>
              {i < ITEMS.length - 1 && (
                <ChevronRight
                  className="hidden size-4 text-muted-foreground/50 sm:block"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs text-muted-foreground sm:text-sm">
          One platform for the complete participant journey.
        </p>
      </div>
    </section>
  )
}
