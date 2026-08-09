'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { FileText, Check } from 'lucide-react'

export function TermsPage() {
  const sections = [
    {
      title: '1. Acceptance of terms',
      content:
        'By creating an account or using the Engagio platform, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the platform.',
    },
    {
      title: '2. Your account',
      content:
        'You are responsible for maintaining the security of your account and password. You must provide accurate and complete information when creating your account. Organizations are responsible for all activity conducted under their member accounts.',
    },
    {
      title: '3. Organizations and members',
      content:
        'An organization is a workspace owned by the user who created it (the Owner). Owners can invite members and assign roles. Organization data — including events, questions, registrations, and certificates — belongs to the organization and is isolated from other organizations on the platform.',
    },
    {
      title: '4. Acceptable use',
      content:
        'You agree not to use Engagio to: (a) violate any law or regulation, (b) infringe on intellectual property rights, (c) upload malicious code or harmful content, (d) attempt to access data belonging to another organization, (e) abuse, harass, or harm other users, or (f) interfere with the proper functioning of the platform.',
    },
    {
      title: '5. Event content and participant data',
      content:
        'You retain ownership of all content you create on Engagio — events, questions, activities, certificates, and branding. You are responsible for obtaining participant consent for data collection through registration forms. Engagio acts as a data processor on your behalf.',
    },
    {
      title: '6. Payments',
      content:
        'There are two separate payment flows: (a) SaaS subscription payments from your organization to Engagio for plan upgrades, and (b) event registration payments from participants to your organization. Event registration payments are processed through your configured payment provider (manual UPI, Razorpay, or Stripe). Engagio does not handle participant payment funds directly unless using a connected account model.',
    },
    {
      title: '7. Plan limits and usage',
      content:
        'Each plan (Free, Starter, Professional, Enterprise) has specific limits on events, members, participants, and features. These limits are enforced server-side. If you exceed your plan limits, you will need to upgrade your plan to continue creating new resources.',
    },
    {
      title: '8. Certificates and verification',
      content:
        'Certificates issued through Engagio are backed by a unique verification token and public verification page. Certificate revocation is supported. Engagio is not liable for the accuracy of content on certificates — organizations are responsible for verifying participant eligibility before issuance.',
    },
    {
      title: '9. Service availability',
      content:
        'We strive for high availability but do not guarantee uninterrupted service. We are not liable for downtime, data loss, or any damages resulting from service interruptions. We recommend exporting your data regularly.',
    },
    {
      title: '10. Account termination',
      content:
        'You can delete your organization or account at any time. Upon deletion, your data will be permanently removed within 30 days. If you violate these terms, we may suspend or terminate your account without notice.',
    },
    {
      title: '11. Limitation of liability',
      content:
        'Engagio is provided "as is" without warranties of any kind. We are not liable for indirect, incidental, or consequential damages, including loss of data, revenue, or profits. Our total liability shall not exceed the amount you have paid in the preceding 12 months.',
    },
    {
      title: '12. Changes to terms',
      content:
        'We may update these terms from time to time. We will notify you of significant changes via email. Continued use of the platform after changes constitutes acceptance of the updated terms.',
    },
    {
      title: '13. Contact',
      content:
        'For questions about these terms, please contact us at legal@engagio.app.',
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
              <FileText className="size-3" />
              Terms of Service
            </span>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Terms of Service
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-10">
            {sections.map((section, i) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.03 }}
              >
                <h2 className="text-lg font-semibold text-foreground">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {section.content}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-12 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20"
          >
            <div className="flex items-start gap-3">
              <Check className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm text-muted-foreground">
                By using Engagio, you acknowledge that you have read and understood
                these terms. If you have any questions, we&apos;re happy to help at{' '}
                <a href="mailto:legal@engagio.app" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                  legal@engagio.app
                </a>
                .
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
