'use client'

import * as React from 'react'
import { Github, Twitter, Linkedin } from 'lucide-react'
import { BrandLogo } from '@/components/shared/brand-logo'

const PRODUCT_LINKS = [
  { label: 'Events', href: '#features' },
  { label: 'Activities', href: '#activities' },
  { label: 'Assessments', href: '#assessment' },
  { label: 'Certificates', href: '#certificates' },
] as const

const SOLUTIONS_LINKS = [
  { label: 'Medical Summits', href: '#solutions' },
  { label: 'Workshops', href: '#solutions' },
  { label: 'Corporate Training', href: '#solutions' },
  { label: 'Conferences', href: '#solutions' },
  { label: 'Education', href: '#solutions' },
] as const

const COMPANY_LINKS = [
  { label: 'About', href: '#' },
  { label: 'Privacy', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'Contact', href: '#' },
] as const

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-border/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 lg:col-span-1">
            <BrandLogo size="md" />
            <p className="mt-2 text-sm font-medium text-foreground">
              Engage. Learn. Connect.
            </p>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              The all-in-one platform for interactive events, workshops,
              training, and certifications — from registration to certificate.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a
                href="#"
                aria-label="GitHub"
                title="Coming soon"
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-600"
              >
                <Github className="size-4" />
              </a>
              <a
                href="#"
                aria-label="Twitter / X"
                title="Coming soon"
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-600"
              >
                <Twitter className="size-4" />
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                title="Coming soon"
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-600"
              >
                <Linkedin className="size-4" />
              </a>
            </div>
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Solutions" links={SOLUTIONS_LINKS} />
          <FooterColumn
            title="Company"
            links={COMPANY_LINKS}
            comingSoon
          />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>© 2026 Engagio. All rights reserved.</p>
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
  comingSoon = false,
}: {
  title: string
  links: readonly { label: string; href: string }[]
  comingSoon?: boolean
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              title={comingSoon ? 'Coming soon' : undefined}
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
