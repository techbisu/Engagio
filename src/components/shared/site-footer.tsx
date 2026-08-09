'use client'

import * as React from 'react'
import { Github, Twitter, Linkedin } from 'lucide-react'
import { BrandLogo } from '@/components/shared/brand-logo'
import type { ViewName } from '@/types'

interface SiteFooterProps {
  onNavigate?: (view: ViewName) => void
}

const PRODUCT_LINKS = [
  { label: 'Events', href: '#features', view: null as ViewName | null },
  { label: 'Activities', href: '#activities', view: null as ViewName | null },
  { label: 'Assessments', href: '#assessment', view: null as ViewName | null },
  { label: 'Certificates', href: '#certificates', view: null as ViewName | null },
] as const

const SOLUTIONS_LINKS = [
  { label: 'Medical Summits', href: '#solutions', view: null as ViewName | null },
  { label: 'Workshops', href: '#solutions', view: null as ViewName | null },
  { label: 'Corporate Training', href: '#solutions', view: null as ViewName | null },
  { label: 'Conferences', href: '#solutions', view: null as ViewName | null },
  { label: 'Education', href: '#solutions', view: null as ViewName | null },
] as const

const COMPANY_LINKS = [
  { label: 'About', href: null, view: 'about' as ViewName },
  { label: 'Privacy', href: null, view: 'privacy' as ViewName },
  { label: 'Terms', href: null, view: 'terms' as ViewName },
  { label: 'Contact', href: null, view: 'contact' as ViewName },
] as const

export function SiteFooter({ onNavigate }: SiteFooterProps = {}) {
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
                href="https://github.com/techbisu/Engagio"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
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

          <FooterColumn title="Product" links={PRODUCT_LINKS} onNavigate={onNavigate} />
          <FooterColumn title="Solutions" links={SOLUTIONS_LINKS} onNavigate={onNavigate} />
          <FooterColumn title="Company" links={COMPANY_LINKS} onNavigate={onNavigate} />
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

type FooterLink = {
  label: string
  href: string | null
  view: ViewName | null
}

function FooterColumn({
  title,
  links,
  onNavigate,
}: {
  title: string
  links: readonly FooterLink[]
  onNavigate?: (view: ViewName) => void
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            {link.view && onNavigate ? (
              <button
                onClick={() => onNavigate(link.view as ViewName)}
                className="text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </button>
            ) : (
              <a
                href={link.href || '#'}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
