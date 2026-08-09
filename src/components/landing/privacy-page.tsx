'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Shield, Database, Eye, Cookie, Mail, Globe } from 'lucide-react'

export function PrivacyPage() {
  const sections = [
    {
      icon: Database,
      title: 'Data we collect',
      content: [
        'Account information: Your name, email address, and profile image when you sign up.',
        'Organization data: Organization name, branding assets, and settings you configure.',
        'Event data: Event details, registration forms, questions, activities, and participant responses.',
        'Payment data: Transaction references and payment screenshots for manual verification. We do not store full payment gateway credentials in plaintext.',
        'Usage data: Aggregated metrics like event counts, participation counts, and feature usage for plan limit enforcement.',
      ],
    },
    {
      icon: Eye,
      title: 'How we use your data',
      content: [
        'To provide and maintain the Engagio platform — events, activities, assessments, certificates, and analytics.',
        'To verify payments and manage event registrations.',
        'To enforce plan limits and feature entitlements.',
        'To send transactional emails (registration confirmation, result publication, certificate issuance).',
        'To improve our product and fix issues. We never sell your data to third parties.',
      ],
    },
    {
      icon: Shield,
      title: 'Data security',
      content: [
        'All data is stored in a PostgreSQL database with organization-level tenant isolation. One organization cannot access another organization\'s data.',
        'Payment provider credentials are encrypted at rest using AES-256-CBC.',
        'Authentication uses secure, HttpOnly cookies with NextAuth.js.',
        'Image uploads go through Cloudinary with file-type and size validation.',
        'Public share links use cryptographically random tokens — not sequential IDs.',
      ],
    },
    {
      icon: Cookie,
      title: 'Cookies & local storage',
      content: [
        'Authentication cookies: Required for login. These are HttpOnly and Secure.',
        'Theme preference: Stored in localStorage to remember your Light/Dark/System choice.',
        'Organization context: Stored in localStorage to remember your selected organization.',
        'We do not use third-party advertising or tracking cookies.',
      ],
    },
    {
      icon: Globe,
      title: 'Your rights',
      content: [
        'Access: You can view your data through the platform dashboard.',
        'Correction: You can update your profile and organization settings at any time.',
        'Deletion: You can delete your events and organizations. Account deletion is available on request.',
        'Export: You can export your data via CSV from the admin panel.',
        'Privacy control: Achievement cards default to "Link only" visibility. You control whether your results are public.',
      ],
    },
    {
      icon: Mail,
      title: 'Contact us',
      content: [
        'If you have questions about this privacy policy or your data, please contact us at privacy@engagio.app.',
        'We will respond to your request within 30 days.',
      ],
    },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <section className="bg-gradient-to-b from-emerald-50/50 to-background dark:from-emerald-950/20 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <Shield className="size-3" />
              Privacy Policy
            </span>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Your privacy matters.
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {sections.map((section, i) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <section.icon className="size-5" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
                </div>
                <ul className="mt-4 ml-13 space-y-2 pl-1">
                  {section.content.map((item, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground">
                      • {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
