"use client"

import * as React from "react"
import {
  ArrowLeft,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
} from "lucide-react"

import { cn, initials } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BrandLogo } from "@/components/shared/brand-logo"
import type { SafeUser } from "@/types"

import { OrgSwitcher } from "./org-switcher"

interface OrgDashboardShellProps {
  user: SafeUser
  children: React.ReactNode
  onSignOut: () => void
  onNavigateHome: () => void
  onOpenSettings?: () => void
  onOpenOnboarding?: () => void
  onOrgSwitch?: (slug: string) => void
}

/**
 * A clean, modern shell for organization views (dashboard, settings).
 * Distinct from AdminShell — no admin chrome, just the org switcher + user menu.
 */
export function OrgDashboardShell({
  user,
  children,
  onSignOut,
  onNavigateHome,
  onOpenSettings,
  onOpenOnboarding,
  onOrgSwitch,
}: OrgDashboardShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-6">
        <button
          type="button"
          onClick={onNavigateHome}
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          aria-label="Go to home"
        >
          <BrandLogo size="sm" iconOnly />
        </button>

        <span className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 sm:inline-block" />

        {/* Org switcher */}
        <OrgSwitcher
          onSwitch={onOrgSwitch}
          onCreate={onOpenOnboarding}
          onOpenSettings={onOpenSettings}
        />

        <div className="ml-auto flex items-center gap-2">
          {onOpenSettings && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenSettings}
              className="hidden gap-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 sm:inline-flex"
            >
              <Settings className="size-4" />
              Settings
            </Button>
          )}
          {onOpenOnboarding && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenOnboarding}
              className="hidden gap-1.5 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40 sm:inline-flex"
            >
              <Plus className="size-4" />
              New org
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-1.5">
                <Avatar className="size-7">
                  {user.image ? (
                    <AvatarImage src={user.image} alt={user.name || ""} />
                  ) : null}
                  <AvatarFallback className="bg-emerald-50 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {initials(user.name || user.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium max-w-[140px] truncate sm:block">
                  {user.name || user.email}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-sm font-medium truncate">
                  {user.name || "Unnamed user"}
                </span>
                <span className="text-xs text-muted-foreground font-normal truncate">
                  {user.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onNavigateHome}>
                <LayoutDashboard className="size-4" /> Back to home
              </DropdownMenuItem>
              {onOpenSettings && (
                <DropdownMenuItem onClick={onOpenSettings}>
                  <Settings className="size-4" /> Organization settings
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-rose-600 focus:text-rose-700"
                onClick={onSignOut}
              >
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetTitle className="sr-only">Organization menu</SheetTitle>
              <div className="flex h-14 items-center gap-2 border-b px-4">
                <ArrowLeft className="size-4 text-slate-500" />
                <span className="text-sm font-semibold">Menu</span>
              </div>
              <div className="flex flex-col gap-1 p-3">
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    onNavigateHome()
                    setMobileOpen(false)
                  }}
                >
                  <LayoutDashboard className="size-4" /> Home
                </Button>
                {onOpenSettings && (
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => {
                      onOpenSettings()
                      setMobileOpen(false)
                    }}
                  >
                    <Settings className="size-4" /> Settings
                  </Button>
                )}
                {onOpenOnboarding && (
                  <Button
                    variant="ghost"
                    className="justify-start text-emerald-700 dark:text-emerald-300"
                    onClick={() => {
                      onOpenOnboarding()
                      setMobileOpen(false)
                    }}
                  >
                    <Plus className="size-4" /> New organization
                  </Button>
                )}
              </div>
              <div className="mt-auto border-t border-slate-200 p-3 dark:border-slate-800">
                <Button
                  variant="outline"
                  className="w-full gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
                  onClick={() => {
                    onSignOut()
                    setMobileOpen(false)
                  }}
                >
                  <LogOut className="size-4" /> Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-7xl flex-col sm:flex-row items-center justify-between gap-1 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Engagio. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <span className="inline-flex size-1.5 rounded-full bg-emerald-500" />
            Organization workspace
          </p>
        </div>
      </footer>
    </div>
  )
}
