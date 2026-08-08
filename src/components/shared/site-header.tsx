'use client'

import * as React from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { BrandLogo } from '@/components/shared/brand-logo'
import { UserMenu } from '@/components/shared/user-menu'
import { SignOutButton } from '@/components/shared/sign-out-button'
import type { SafeUser, ViewName } from '@/types'

interface SiteHeaderProps {
  session: { user: SafeUser } | null
  onNavigate: (view: ViewName) => void
  onSignOut: () => void
}

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
] as const

export function SiteHeader({ session, onNavigate, onSignOut }: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const user = session?.user ?? null
  const isAdmin = user?.role === 'ADMIN'

  const handleNav = (view: ViewName) => {
    onNavigate(view)
    setMobileOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => onNavigate('landing')}
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Go to homepage"
        >
          <BrandLogo size="md" />
        </button>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop auth */}
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleNav(isAdmin ? 'admin' : 'student')}
                className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-600/90 hover:to-teal-500/90"
              >
                {isAdmin ? 'Admin Panel' : 'My Dashboard'}
              </Button>
              <UserMenu
                user={user}
                onNavigate={(v) => onNavigate(v as ViewName)}
                onSignOut={onSignOut}
              />
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('login')}
              >
                Sign In
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => onNavigate('login')}
                className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-600/90 hover:to-teal-500/90"
              >
                Get Started
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full max-w-xs">
            <SheetHeader>
              <SheetTitle className="text-left">
                <BrandLogo size="sm" />
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <SheetClose asChild key={link.href}>
                  <a
                    href={link.href}
                    className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </SheetClose>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-2 border-t border-border p-4">
              {user ? (
                <>
                  <Button
                    variant="default"
                    onClick={() => handleNav(isAdmin ? 'admin' : 'student')}
                    className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-600/90 hover:to-teal-500/90"
                  >
                    {isAdmin ? 'Admin Panel' : 'My Dashboard'}
                  </Button>
                  <SignOutButton
                    variant="outline"
                    onSignedOut={() => {
                      onSignOut()
                      setMobileOpen(false)
                    }}
                    className="w-full"
                  />
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleNav('login')}
                  >
                    Sign In
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => handleNav('login')}
                    className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-600/90 hover:to-teal-500/90"
                  >
                    Get Started Free
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
