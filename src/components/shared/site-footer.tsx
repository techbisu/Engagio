'use client'

import * as React from 'react'
import { Github, Twitter, Linkedin } from 'lucide-react'
import { BrandLogo } from '@/components/shared/brand-logo'

const PRODUCT_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
] as const

const COMPANY_LINKS = [
  { label: 'About', href: '#' },
  { label: 'Blog', href: '#' },
  { label: 'Contact', href: '#' },
] as const

const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms of Service', href: '#' },
] as const

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          {/* Brand column */}
          <div className="col-span-2">
            <BrandLogo size="md" />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              The all-in-one platform to run flawless quizzes for workshops,
              events, and exams — with anti-cheat built in.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a
                href="#"
                aria-label="GitHub"
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-600"
              >
                <Github className="size-4" />
              </a>
              <a
                href="#"
                aria-label="Twitter / X"
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-600"
              >
                <Twitter className="size-4" />
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-600"
              >
                <Linkedin className="size-4" />
              </a>
            </div>
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>© 2025 QuizMaster Pro. Built with Next.js.</p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
            All systems operational
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: readonly { label: string; href: string }[]
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
