'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Building2,
  Users,
  CalendarDays,
  Library,
  Activity,
  UserCheck,
  BarChart3,
  Award,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ViewName } from '@/types'

interface OrgNode {
  icon: LucideIcon
  label: string
}

const ORG_NODES: OrgNode[] = [
  { icon: Users, label: 'Team' },
  { icon: CalendarDays, label: 'Events' },
  { icon: Library, label: 'Question Bank' },
  { icon: Activity, label: 'Activities' },
  { icon: UserCheck, label: 'Participants' },
  { icon: BarChart3, label: 'Results' },
  { icon: Award, label: 'Certificates' },
]

interface OrganizationSectionProps {
  onNavigate: (view: ViewName) => void
}

export function OrganizationSection({ onNavigate }: OrganizationSectionProps) {
  return (
    <section
      id="organization"
      className="relative bg-muted/30 py-20 sm:py-24"
      aria-labelledby="org-heading"
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
            Organization
          </span>
          <h2
            id="org-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Built for organizations.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Create your organization&apos;s workspace, invite your team, manage
            events, reuse your question bank, customize your branding, and run
            everything from one dashboard.
          </p>
        </motion.div>

        <div className="mx-auto mt-12 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8"
          >
            {/* Root node */}
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-600/20">
                <Building2 className="size-6" />
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Workspace
                </p>
                <p className="text-base font-semibold text-foreground">
                  Organization
                </p>
              </div>
            </div>

            {/* Children (tree) */}
            <ul className="mt-4 space-y-1 border-l-2 border-emerald-500/30 pl-6">
              {ORG_NODES.map((node) => (
                <li
                  key={node.label}
                  className="relative flex items-center gap-3 py-1.5"
                >
                  <span
                    aria-hidden
                    className="absolute -left-[1.65rem] top-1/2 h-px w-6 -translate-y-1/2 bg-emerald-500/30"
                  />
                  <span className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                    <node.icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {node.label}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex justify-center">
              <Button
                onClick={() => onNavigate('login')}
                className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-600/95 hover:to-teal-500/95"
              >
                Create your organization
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
