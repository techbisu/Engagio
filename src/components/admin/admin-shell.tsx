"use client"

import * as React from "react"
import {
  LayoutDashboard,
  CalendarDays,
  FileQuestion,
  Link2,
  ClipboardList,
  Users,
  Menu,
  LogOut,
  ShieldCheck,
  Shield,
  ChevronRight,
  ReceiptIndianRupee,
  Award,
  Trophy,
  Sparkles,
  Settings as SettingsIcon,
} from "lucide-react"

import { cn, initials } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import type { AdminTab, SafeUser } from "@/types"

import { Dashboard } from "./dashboard"
import { EventsManager } from "./events-manager"
import { QuestionsManager } from "./questions-manager"
import { LinksManager } from "./links-manager"
import { AttemptsTable } from "./attempts-table"
import { UsersList } from "./users-list"
import { RegistrationFormBuilder } from "./registration-form-builder"
import { RegistrationsList } from "./registrations-list"
import { CertificatesPanel } from "./certificates-panel"
import { PaymentsPanel } from "./payments-panel"
import { ResultsCertDashboard } from "./results-cert-dashboard"
import { ActivitiesPanel } from "./activities/activities-panel"
import { OrgSwitcher } from "@/components/organization/org-switcher"
import { ThemeToggle } from "@/components/shared/theme-toggle"

interface AdminShellProps {
  initialTab?: AdminTab
  user: SafeUser
  onNavigate?: (view: "landing" | "login" | "student" | "platform") => void
  onSignOut: () => void
  onTabChange?: (tab: AdminTab) => void
  /** Called when the user switches org via the OrgSwitcher. */
  onOrgSwitch?: (slug: string) => void
  /** Called when the user wants to open org settings. */
  onOpenOrgSettings?: () => void
  /** Called when the user wants to create a new org. */
  onOpenOrgOnboarding?: () => void
}

interface NavItem {
  id: AdminTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Overview & analytics" },
  { id: "events", label: "Events", icon: CalendarDays, description: "Manage quiz events" },
  { id: "questions", label: "Questions", icon: FileQuestion, description: "Per-event questions" },
  { id: "links", label: "Quiz Links", icon: Link2, description: "Shareable quiz URLs" },
  { id: "activities", label: "Activities", icon: Sparkles, description: "Polls, surveys, Q&A, voting" },
  { id: "attempts", label: "Attempts", icon: ClipboardList, description: "All participant attempts" },
  { id: "payments", label: "Payments", icon: ReceiptIndianRupee, description: "Verify manual UPI payments" },
  { id: "results", label: "Results & Certs", icon: Trophy, description: "Publish results + issue certificates" },
  { id: "users", label: "Users", icon: Users, description: "Registered participants" },
  { id: "certificates", label: "Certificates", icon: Award, description: "Issue & verify certificates" },
]

const TAB_LABEL: Record<AdminTab, string> = {
  dashboard: "Dashboard",
  events: "Events",
  questions: "Questions",
  links: "Quiz Links",
  activities: "Activities",
  attempts: "Attempts",
  payments: "Payments",
  results: "Results & Certs",
  users: "Users",
  certificates: "Certificates",
}

export function AdminShell({
  initialTab = "dashboard",
  user,
  onNavigate,
  onSignOut,
  onTabChange,
  onOrgSwitch,
  onOpenOrgSettings,
  onOpenOrgOnboarding,
}: AdminShellProps) {
  const [tab, setTab] = React.useState<AdminTab>(initialTab)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  // Sub-view state for questions manager (event context).
  const [questionsCtx, setQuestionsCtx] = React.useState<{
    eventId: string
    eventTitle: string
  } | null>(null)

  // Sub-view state for registration form builder (event context).
  const [registrationCtx, setRegistrationCtx] = React.useState<{
    eventId: string
    eventTitle: string
  } | null>(null)

  // Sub-view state for registrations list (event context).
  const [registrationsListCtx, setRegistrationsListCtx] = React.useState<{
    eventId: string
    eventTitle: string
  } | null>(null)

  // Preselected event for generating a link (set from events manager).
  const [linkPreselectedEventId, setLinkPreselectedEventId] = React.useState<
    string | undefined
  >(undefined)

  // Preselected event for attempts filter (from events manager "View Attempts").
  const [attemptsEventId, setAttemptsEventId] = React.useState<string | undefined>(undefined)

  // Preselected slug for attempts filter (from links manager "View Attempts").
  const [attemptsPreselectedSlug, setAttemptsPreselectedSlug] = React.useState<
    string | undefined
  >(undefined)

  // Sub-view state for Activities panel (event context). Set from the events
  // manager "Manage Activities" action, or from the activities tab itself.
  const [activitiesCtx, setActivitiesCtx] = React.useState<{
    eventId: string
    eventTitle: string
  } | null>(null)

  const changeTab = React.useCallback(
    (next: AdminTab) => {
      setTab(next)
      onTabChange?.(next)
      setMobileOpen(false)
    },
    [onTabChange]
  )

  // Handlers for cross-tab navigation from the events manager.
  const handleManageQuestions = React.useCallback(
    (eventId: string, eventTitle: string) => {
      setQuestionsCtx({ eventId, eventTitle })
      setLinkPreselectedEventId(undefined)
      changeTab("questions")
    },
    [changeTab]
  )

  const handleGenerateLink = React.useCallback(
    (eventId: string) => {
      setLinkPreselectedEventId(eventId)
      changeTab("links")
    },
    [changeTab]
  )

  const handleViewAnalytics = React.useCallback(
    (_eventId: string) => {
      setAttemptsEventId(undefined)
      changeTab("dashboard")
    },
    [changeTab]
  )

  const handleManageRegistration = React.useCallback(
    (eventId: string, eventTitle: string) => {
      setRegistrationCtx({ eventId, eventTitle })
      setRegistrationsListCtx(null)
      changeTab("events")
    },
    [changeTab]
  )

  const handleViewRegistrations = React.useCallback(
    (eventId: string, eventTitle: string) => {
      setRegistrationsListCtx({ eventId, eventTitle })
      setRegistrationCtx(null)
      changeTab("events")
    },
    [changeTab]
  )

  const handleViewAttempts = React.useCallback(
    (slug?: string) => {
      setAttemptsEventId(undefined)
      setAttemptsPreselectedSlug(slug)
      changeTab("attempts")
    },
    [changeTab]
  )

  const handleManageQuizLinks = React.useCallback(
    (_quizLinkId: string) => {
      // For now we just switch to the links tab; the link manager shows the
      // full list, and the user can pick the quiz link by its ID prefix.
      changeTab("links")
    },
    [changeTab]
  )

  const handleSignOut = () => {
    onSignOut()
  }

  const navContent = (
    <nav className="flex flex-col gap-1 p-3" aria-label="Admin navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = tab === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => changeTab(item.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
              active
                ? "bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-500/10 dark:text-emerald-400"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0",
                active
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
              )}
            />
            <span className="flex-1 text-left">{item.label}</span>
            {active && <ChevronRight className="size-4" />}
          </button>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white px-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        {/* Mobile drawer trigger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
            <div className="flex h-14 items-center gap-2 border-b px-4">
              <BrandMark />
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold">Engagio</span>
                <span className="text-[10px] uppercase tracking-wider text-emerald-600">
                  Admin Panel
                </span>
              </div>
            </div>
            {navContent}
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-2">
            <BrandMark />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Engagio</span>
            <span className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Admin Panel
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <OrgSwitcher
            onSwitch={onOrgSwitch}
            onCreate={onOpenOrgOnboarding}
            onOpenSettings={onOpenOrgSettings}
            className="hidden sm:flex"
          />

          <Badge
            variant="outline"
            className="hidden sm:inline-flex items-center gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
          >
            <ShieldCheck className="size-3" />
            {user.role === "ADMIN" ? "Admin" : "Participant"}
          </Badge>

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-1.5">
                <Avatar className="size-7">
                  {user.image ? (
                    <AvatarImage src={user.image} alt={user.name || ""} />
                  ) : null}
                  <AvatarFallback className="bg-emerald-50 text-emerald-700 text-xs dark:bg-emerald-500/10 dark:text-emerald-400">
                    {initials(user.name || user.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-sm font-medium max-w-[140px] truncate">
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
              {onOpenOrgSettings && (
                <DropdownMenuItem onClick={onOpenOrgSettings}>
                  <SettingsIcon className="size-4" /> Organization settings
                </DropdownMenuItem>
              )}
              {onOpenOrgOnboarding && (
                <DropdownMenuItem onClick={onOpenOrgOnboarding}>
                  <Sparkles className="size-4" /> Create organization
                </DropdownMenuItem>
              )}
              {onNavigate && (
                <DropdownMenuItem onClick={() => onNavigate("student")}>
                  <Users className="size-4" /> Switch to participant view
                </DropdownMenuItem>
              )}
              {onNavigate && (
                <DropdownMenuItem onClick={() => onNavigate("landing")}>
                  <LayoutDashboard className="size-4" /> Back to home
                </DropdownMenuItem>
              )}
              {user.role === "ADMIN" && onNavigate && (
                <DropdownMenuItem onClick={() => onNavigate("platform" as any)}>
                  <Shield className="size-4" /> Platform Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-rose-600 focus:text-rose-700"
                onClick={handleSignOut}
              >
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-white dark:bg-slate-900 dark:border-slate-800">
          <div className="flex-1 overflow-y-auto">
            {navContent}
          </div>
          <div className="border-t p-3 text-[11px] text-muted-foreground dark:border-slate-800">
            <p className="font-medium text-slate-700 dark:text-slate-300">Need help?</p>
            <p>Check the docs or contact your administrator.</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
            {/* Breadcrumb / heading */}
            <div className="mb-5">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {TAB_LABEL[tab]}
              </p>
            </div>

            {tab === "dashboard" && (
              <Dashboard onViewAttempts={() => changeTab("attempts")} />
            )}

            {tab === "events" &&
              (registrationCtx ? (
                <RegistrationFormBuilder
                  eventId={registrationCtx.eventId}
                  eventTitle={registrationCtx.eventTitle}
                  onBack={() => setRegistrationCtx(null)}
                />
              ) : registrationsListCtx ? (
                <RegistrationsList
                  eventId={registrationsListCtx.eventId}
                  eventTitle={registrationsListCtx.eventTitle}
                  onBack={() => setRegistrationsListCtx(null)}
                />
              ) : (
                <EventsManager
                  onManageQuestions={handleManageQuestions}
                  onGenerateLink={handleGenerateLink}
                  onViewAnalytics={handleViewAnalytics}
                  onManageRegistration={handleManageRegistration}
                  onViewRegistrations={handleViewRegistrations}
                />
              ))}

            {tab === "questions" &&
              (questionsCtx ? (
                <QuestionsManager
                  eventId={questionsCtx.eventId}
                  eventTitle={questionsCtx.eventTitle}
                  onBack={() => changeTab("events")}
                />
              ) : (
                <NoEventSelected onBrowseEvents={() => changeTab("events")} />
              ))}

            {tab === "links" && (
              <LinksManager
                preselectedEventId={linkPreselectedEventId}
                onViewAttempts={(slug) => handleViewAttempts(slug)}
              />
            )}

            {tab === "activities" && (
              <ActivitiesPanel
                eventId={activitiesCtx?.eventId}
                eventTitle={activitiesCtx?.eventTitle}
                onBack={
                  activitiesCtx
                    ? () => {
                        setActivitiesCtx(null)
                        changeTab("events")
                      }
                    : undefined
                }
                onManageQuizLinks={handleManageQuizLinks}
              />
            )}

            {tab === "attempts" && (
              <AttemptsTable
                eventId={attemptsEventId}
                preselectedSlug={attemptsPreselectedSlug}
              />
            )}

            {tab === "payments" && <PaymentsPanel />}

            {tab === "results" && <ResultsCertDashboard />}

            {tab === "users" && <UsersList />}

            {tab === "certificates" && <CertificatesPanel />}
          </div>
        </main>
      </div>

      {/* Sticky footer */}
      <footer className="mt-auto border-t bg-white px-4 py-3 dark:bg-slate-900 dark:border-slate-800">
        <div className="mx-auto flex w-full max-w-7xl flex-col sm:flex-row items-center justify-between gap-1 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Engagio. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <span className="inline-flex size-1.5 rounded-full bg-emerald-500" />
            Admin v1.0
          </p>
        </div>
      </footer>
    </div>
  )
}

function BrandMark() {
  return (
    <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
      <span className="text-sm font-bold">Q</span>
    </div>
  )
}

function NoEventSelected({ onBrowseEvents }: { onBrowseEvents: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
        <FileQuestion className="size-7" />
      </div>
      <p className="mt-4 text-lg font-semibold">No event selected</p>
      <p className="mt-1 text-sm text-muted-foreground max-w-md">
        Pick an event to manage its questions. You can also use the
        &quot;Manage Questions&quot; action on any event card.
      </p>
      <Button
        onClick={onBrowseEvents}
        className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <CalendarDays className="size-4" />
        Browse events
      </Button>
    </div>
  )
}
