'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Crown,
  ShieldCheck,
  CalendarClock,
  MessagesSquare,
  CheckSquare,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Role {
  icon: LucideIcon
  name: string
  description: string
}

const ROLES: Role[] = [
  {
    icon: Crown,
    name: 'Owner',
    description: 'Full control, billing, and team management.',
  },
  {
    icon: ShieldCheck,
    name: 'Admin',
    description: 'Manage events, questions, and configuration.',
  },
  {
    icon: CalendarClock,
    name: 'Event Manager',
    description: 'Organize events, registrations, and schedules.',
  },
  {
    icon: MessagesSquare,
    name: 'Moderator',
    description: 'Run live activities, polls, and Q&A sessions.',
  },
  {
    icon: CheckSquare,
    name: 'Evaluator',
    description: 'Review answers, grade, and publish results.',
  },
  {
    icon: ClipboardCheck,
    name: 'Check-in Staff',
    description: 'Verify participants at the door.',
  },
]

export function TeamSection() {
  return (
    <section
      id="team"
      className="relative bg-background py-20 sm:py-24"
      aria-labelledby="team-heading"
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
            Team
          </span>
          <h2
            id="team-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Bring your team with you.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Give organizers, moderators, evaluators, and check-in staff the right
            access without sharing a single admin account.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((role, i) => (
            <motion.div
              key={role.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
            >
              <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-md hover:shadow-emerald-600/5">
                <CardContent className="flex items-start gap-3 p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                    <role.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {role.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {role.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
