"use client"

import * as React from "react"
import { Award, GraduationCap, Home, LogOut } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { BrandLogo } from "@/components/shared/brand-logo"
import { cn, initials } from "@/lib/utils"
import type { SafeUser } from "@/types"

interface StudentShellProps {
  user: SafeUser
  onSignOut: () => void
  onNavigateHome: () => void
  onNavigateMyCertificates?: () => void
  children: React.ReactNode
}

export function StudentShell({
  user,
  onSignOut,
  onNavigateHome,
  onNavigateMyCertificates,
  children,
}: StudentShellProps) {
  const greetingName = user.name?.split(" ")[0] || user.email.split("@")[0]

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Go to dashboard home"
          >
            <BrandLogo size="sm" />
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <Badge
              variant="outline"
              className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 sm:inline-flex"
            >
              <GraduationCap className="size-3" /> Participant
            </Badge>

            {onNavigateMyCertificates && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateMyCertificates}
                className="hidden border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40 sm:inline-flex"
              >
                <Award className="size-4" />
                <span className="hidden md:inline">My Certificates</span>
                <span className="md:hidden">Certificates</span>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 gap-2 rounded-full pl-1.5 pr-2 sm:pr-3"
                  aria-label="Open user menu"
                >
                  <Avatar className="size-8 ring-2 ring-emerald-500/30 ring-offset-2 ring-offset-background">
                    {user.image ? (
                      <AvatarImage src={user.image} alt={user.name || user.email} />
                    ) : null}
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                      {initials(user.name) || user.email[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">
                    {user.name || greetingName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium leading-none">
                    {user.name || "Participant"}
                  </span>
                  <span className="text-xs text-muted-foreground leading-none">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onNavigateHome}>
                  <Home className="text-emerald-600" aria-hidden="true" />
                  <span>Dashboard</span>
                </DropdownMenuItem>
                {onNavigateMyCertificates && (
                  <DropdownMenuItem onClick={onNavigateMyCertificates}>
                    <Award className="text-emerald-600" aria-hidden="true" />
                    <span>My Certificates</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onSignOut}>
                  <LogOut aria-hidden="true" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
            Hi, {greetingName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Your quizzes and results
          </p>
        </div>
        {children}
      </main>

      {/* Sticky footer */}
      <footer
        className={cn(
          "mt-auto border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Engagio. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
            Engagio
          </p>
        </div>
      </footer>
    </div>
  )
}
