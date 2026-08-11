"use client"

import * as React from "react"
import { useSession, signOut } from "next-auth/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  useAppStore,
  parseInitialRoute,
  syncUrl,
  type QuizMeta,
} from "@/store/app-store"
import type { SafeUser } from "@/types"

import { SiteHeader } from "@/components/shared/site-header"
import { SiteFooter } from "@/components/shared/site-footer"
import { LoginForm } from "@/components/auth/login-form"
import { ParticipantLogin } from "@/components/auth/participant-login"
import { SuperAdminLogin } from "@/components/auth/super-admin-login"
import { SuperAdminSecurity } from "@/components/auth/super-admin-security"
import { OrgLandingPage } from "@/components/public/org-landing-page"
import { EventLandingPage } from "@/components/public/event-landing-page"

import { Hero } from "@/components/landing/hero"
import { TrustStrip } from "@/components/landing/trust-strip"
import { Features } from "@/components/landing/features"
import { ActivitiesSection } from "@/components/landing/activities-section"
import { HowItWorks } from "@/components/landing/how-it-works"
import { UseCases } from "@/components/landing/use-cases"
import { AssessmentSection } from "@/components/landing/assessment-section"
import { SecuritySection } from "@/components/landing/security-section"
import { CertificateSection } from "@/components/landing/certificate-section"
import { OrganizationSection } from "@/components/landing/organization-section"
import { TeamSection } from "@/components/landing/team-section"
import { CtaSection } from "@/components/landing/cta-section"
import { PricingSection } from "@/components/landing/pricing-section"
import { AboutPage } from "@/components/landing/about-page"
import { PrivacyPage } from "@/components/landing/privacy-page"
import { TermsPage } from "@/components/landing/terms-page"
import { ContactPage } from "@/components/landing/contact-page"
import { Faq } from "@/components/landing/faq"

import { PlatformAdminShell } from "@/components/platform/platform-admin-shell"

import { AdminShell } from "@/components/admin/admin-shell"
import { StudentShell } from "@/components/student/student-shell"
import { StudentDashboard } from "@/components/student/student-dashboard"
import { QuizStart } from "@/components/student/quiz-start"
import { QuizRunner } from "@/components/quiz/quiz-runner"
import { Leaderboard } from "@/components/student/leaderboard"
import { MyCertificates } from "@/components/student/my-certificates"
import { VerifyCertificate } from "@/components/cert/verify-certificate"

import { ActivityJoin } from "@/components/activities/activity-join"
import { LiveDisplay } from "@/components/activities/live-display"

import { PublicSharePage } from "@/components/achievements/public-share-page"

import { OrgOnboarding } from "@/components/organization/org-onboarding"
import { NoOrgRedirect } from "@/components/organization/no-org-redirect"
import { OrgDashboard } from "@/components/organization/org-dashboard"
import { OrgSettings } from "@/components/organization/org-settings"
import { AcceptInvitation } from "@/components/organization/accept-invitation"
import {
  api as orgApi,
  clearOrgSlug,
  ORG_CHANGED_EVENT_NAME,
  type OrganizationDto,
  type OrganizationSummaryDto,
} from "@/components/organization/api"
import { OrgDashboardShell } from "@/components/organization/org-dashboard-shell"

import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  publicOrigin,
} from "@/lib/seo"

// ---------------------------------------------------------------------------
// SEO structured data — Organization + WebSite schema for the Engagio
// platform. Emitted as JSON-LD <script> tags on the landing view so search
// engines understand the product / brand. Built once at module load.
// ---------------------------------------------------------------------------
const ENGAGIO_ORIGIN = publicOrigin()
const LANDING_ORG_JSON_LD = buildOrganizationJsonLd({
  name: "Engagio",
  description:
    "Interactive event & learning platform for hosting engaging events, workshops, conferences, training programs, and assessments — with registration, live activities, quizzes, results, and certificates.",
  url: ENGAGIO_ORIGIN,
  logo: `${ENGAGIO_ORIGIN}/logo.svg`,
  sameAs: [],
})
const LANDING_WEBSITE_JSON_LD = buildWebSiteJsonLd({
  name: "Engagio",
  url: ENGAGIO_ORIGIN,
  description:
    "Create engaging events, workshops, conferences, training programs, and assessments — with registration, live activities, quizzes, results, and certificates.",
})

/**
 * Helper: GET /api/me → returns { id, email, name, image, role } or null.
 * Used as the source of truth for the current user on the client.
 */
async function fetchMe(): Promise<SafeUser | null> {
  try {
    const res = await fetch("/api/me", { credentials: "include" })
    if (!res.ok) return null
    const data = await res.json()
    return (data as SafeUser) ?? null
  } catch {
    return null
  }
}

export default function Home() {
  // --- Hydrate initial view from URL on first client render --------------
  const [hydrated, setHydrated] = React.useState(false)
  const {
    view,
    setView,
    adminTab,
    setAdminTab,
    studentSubView,
    setStudentSubView,
    quizSlug,
    setQuizSlug,
    quizMeta,
    setQuizMeta,
    eventSlug,
    setEventSlug,
    user,
    setUser,
    verifyToken,
    setVerifyToken,
    shareToken,
    setShareToken,
    activitySlug,
    setActivitySlug,
    liveActivityId,
    liveActivityType,
    setLiveActivity,
    currentOrgSlug,
    setCurrentOrgSlug,
    inviteToken,
    setInviteToken,
  } = useAppStore()

  React.useEffect(() => {
    if (hydrated) return
    const initial = parseInitialRoute()
    setView(initial.view)
    setAdminTab(initial.adminTab)
    if (initial.quizSlug) setQuizSlug(initial.quizSlug)
    if (initial.verifyToken) setVerifyToken(initial.verifyToken)
    if (initial.shareToken) setShareToken(initial.shareToken)
    if (initial.activitySlug) setActivitySlug(initial.activitySlug)
    if (initial.liveActivityId) setLiveActivity(initial.liveActivityId)
    if (initial.inviteToken) setInviteToken(initial.inviteToken)
    setHydrated(true)
  }, [
    hydrated,
    setView,
    setAdminTab,
    setQuizSlug,
    setVerifyToken,
    setShareToken,
    setActivitySlug,
    setLiveActivity,
    setInviteToken,
  ])

  // --- Session sync -------------------------------------------------------
  // We use NextAuth's useSession for live auth state changes (e.g., after
  // signIn/signOut) and reconcile it with the Zustand store. We also fetch
  // /api/me as a fallback to ensure role + id are always populated (the
  // JWT session sometimes lacks the freshly-set role on first sign-in).
  const { data: session, status: sessionStatus } = useSession()

  const meQuery = useQuery({
    queryKey: ["me", session?.user?.email ?? "anon"],
    queryFn: fetchMe,
    enabled: sessionStatus !== "loading",
    staleTime: 60_000,
  })

  React.useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data)
    } else if (meQuery.isError || (sessionStatus === "unauthenticated" && !meQuery.isLoading)) {
      setUser(null)
    }
  }, [meQuery.data, meQuery.isError, meQuery.isLoading, sessionStatus, setUser])

  // --- URL sync ----------------------------------------------------------
  React.useEffect(() => {
    syncUrl(view, {
      quizSlug,
      verifyToken,
      shareToken,
      activitySlug,
      liveActivityId,
      inviteToken,
    })
  }, [view, quizSlug, verifyToken, shareToken, activitySlug, liveActivityId, inviteToken])

  // --- Routing guards ----------------------------------------------------
  // If user lands on a protected view without a session, redirect to login.
  // IMPORTANT: Wait for BOTH session loading AND meQuery to finish before
  // redirecting — otherwise a page reload would logout the user because
  // the session hasn't loaded yet.
  React.useEffect(() => {
    if (sessionStatus === "loading") return
    if (meQuery.isLoading) return // Wait for /api/me to finish
    const isAuthed = !!user
    if (!isAuthed && (view === "admin" || view === "student" || view === "platform")) {
      setView("login")
    }
    // Quiz view: if not authed, STAY on quiz view — the participant login
    // is rendered inline (not redirected to the org admin login).
    // Activity view: same — show participant login inline.
    // Org dashboard/settings: require auth.
    if (!isAuthed && (view === "org-dashboard" || view === "org-settings")) {
      setView("login")
    }
    // Accept-invitation: redirect to login if not signed in (we still want to
    // show the invitation details after they log in).
    if (!isAuthed && view === "accept-invitation" && inviteToken) {
      setView("login")
    }
  }, [view, user, sessionStatus, setView, inviteToken])

  // --- Handlers ----------------------------------------------------------
  const queryClient = useQueryClient()

  const handleSignOut = React.useCallback(async () => {
    await signOut({ redirect: false })
    // Clear ALL cached queries so the next user doesn't see the previous
    // user's data (attempts, analytics, etc.).
    queryClient.clear()
    clearOrgSlug()
    setCurrentOrgSlug(null)
    setUser(null)
    setView("landing")
  }, [setUser, setView, queryClient, setCurrentOrgSlug])

  // ─── Auth-aware routing ────────────────────────────────────────────────
  // routeAfterAuth runs the post-login routing logic. It's called from:
  //   1. LoginForm.onSuccess (email login flow)
  //   2. The auto-route useEffect (Google OAuth flow — the Google callback
  //      redirects back to /?view=login, then this effect detects the new
  //      session and routes the user to the right view).
  // `didAutoRouteRef` prevents double-routing when both paths fire for the
  // same user id.
  const didAutoRouteRef = React.useRef<string | null>(null)

  const routeAfterAuth = React.useCallback(
    async (me: SafeUser) => {
      // 1. Invitation deep-link → accept invitation
      if (inviteToken) {
        setView("accept-invitation")
        return
      }

      // 2. Quiz deep-link → participant quiz flow (ALWAYS — even for admins)
      if (quizSlug) {
        setStudentSubView("quiz-start")
        setView("student")
        return
      }

      // 3. Activity deep-link → participant activity flow
      if (activitySlug) {
        setView("activity")
        return
      }

      // 4. Event deep-link → event landing page
      if (eventSlug) {
        setView("event-landing")
        return
      }

      // 5. Check if the user has an organization membership.
      //    If they have an org → admin panel.
      //    If they don't have an org → show the intermediate "no org" page
      //    (which explains the situation and routes them to registration).
      //    NEVER send org-login users to the participant dashboard.
      try {
        const orgRes = await fetch("/api/organizations")
        const orgData = await orgRes.json()
        if (orgData.organizations && orgData.organizations.length > 0) {
          setView("admin")
        } else {
          // No org → show toast + intermediate redirect page.
          toast.error("No organization found for this email.", {
            description: "Please register your organization first.",
          })
          setView("no-org")
        }
      } catch {
        // Org check failed → go to admin panel
        setView("admin")
      }
    },
    [setView, setStudentSubView, quizSlug, activitySlug, inviteToken, eventSlug],
  )

  const handleLoginSuccess = React.useCallback(
    async (role: string) => {
      const me = await fetchMe()
      if (me) {
        setUser(me)
        meQuery.refetch()
        didAutoRouteRef.current = me.id
        await routeAfterAuth(me)
      } else {
        meQuery.refetch()
      }
    },
    [meQuery, routeAfterAuth, setUser],
  )

  // Auto-route when a user becomes authenticated via Google OAuth (or any
  // session change that brings in a new user while sitting on the login view).
  React.useEffect(() => {
    if (sessionStatus === "loading" || meQuery.isLoading) return
    if (!user) {
      // Reset the auto-route ref when the user signs out.
      didAutoRouteRef.current = null
      return
    }
    // Only auto-route when we haven't already routed for this user AND the
    // user is currently sitting on the login view (Google OAuth callback lands
    // here). For other views, the user has already been routed (or is on a
    // deep-link view like quiz/event that should not be overridden).
    if (
      didAutoRouteRef.current !== user.id &&
      (view === "login" || view === "landing")
    ) {
      didAutoRouteRef.current = user.id
      void routeAfterAuth(user)
    } else if (didAutoRouteRef.current !== user.id) {
      // For any other view, just mark that we've seen this user (so we don't
      // re-run the routing logic if they navigate away and back).
      didAutoRouteRef.current = user.id
    }
  }, [user, sessionStatus, meQuery.isLoading, view, routeAfterAuth])

  const handleNavigate = React.useCallback(
    (target: typeof view) => {
      if (target === "admin" || target === "student") {
        if (!user) {
          setView("login")
          return
        }
      }
      setView(target)
    },
    [user, setView],
  )

  const handleStartQuiz = React.useCallback(
    (slug: string) => {
      setQuizSlug(slug)
      setStudentSubView("quiz-start")
      setView("student")
    },
    [setQuizSlug, setStudentSubView, setView],
  )

  const handleViewLeaderboard = React.useCallback(
    (slug: string) => {
      setQuizSlug(slug)
      setStudentSubView("leaderboard")
      setView("student")
    },
    [setQuizSlug, setStudentSubView, setView],
  )

  const handleQuizBegin = React.useCallback(
    (meta: {
      quizLink: { id: string }
      event?: { title?: string } | null
      timeLimit: number
      requireFullscreen: boolean
    }) => {
      const m: QuizMeta = {
        quizLinkId: meta.quizLink.id,
        slug: quizSlug ?? "",
        requireFullscreen: meta.requireFullscreen,
        timeLimit: meta.timeLimit,
        quizTitle: meta.event?.title,
      }
      setQuizMeta(m)
      setStudentSubView("quiz-runner")
    },
    [quizSlug, setQuizMeta, setStudentSubView],
  )

  const handleQuizExit = React.useCallback(() => {
    setQuizMeta(null)
    setQuizSlug(null)
    setStudentSubView("dashboard")
    setView("student")
  }, [setQuizMeta, setQuizSlug, setStudentSubView, setView])

  const handleNavigateMyCertificates = React.useCallback(() => {
    setStudentSubView("certificates")
    setView("student")
  }, [setStudentSubView, setView])

  const handleExitVerify = React.useCallback(() => {
    setVerifyToken(null)
    setView("landing")
  }, [setVerifyToken, setView])

  const handleExitShare = React.useCallback(() => {
    setShareToken(null)
    setView("landing")
  }, [setShareToken, setView])

  // --- Activity handlers -------------------------------------------------
  const handleActivityExit = React.useCallback(() => {
    setActivitySlug(null)
    setView("landing")
  }, [setActivitySlug, setView])

  const handleActivityQuizRedirect = React.useCallback(
    (quizSlugValue: string) => {
      // Switch to the existing quiz deep-link flow.
      setActivitySlug(null)
      setQuizSlug(quizSlugValue)
      setStudentSubView("quiz-start")
      setView("student")
    },
    [setActivitySlug, setQuizSlug, setStudentSubView, setView],
  )

  const handleOpenLiveDisplay = React.useCallback(
    (activityId: string, type?: import("@/types").ActivityType) => {
      setLiveActivity(activityId, type ?? null)
      setView("live-display")
    },
    [setLiveActivity, setView],
  )

  const handleExitLiveDisplay = React.useCallback(() => {
    setLiveActivity(null, null)
    // If we came from an activity join, go back there; otherwise go home.
    if (activitySlug) {
      setView("activity")
    } else {
      setView("landing")
    }
  }, [setLiveActivity, activitySlug, setView])

  // --- Org handlers ------------------------------------------------------
  // Hydrate the currentOrgSlug from localStorage on mount, and listen for
  // the `engagio-org-changed` custom event so the store stays in sync when
  // the OrgSwitcher (or anyone else) updates it.
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem("engagio-org-slug")
    if (stored && stored !== currentOrgSlug) {
      setCurrentOrgSlug(stored)
    }
    function handleOrgChange(e: Event) {
      const detail = (e as CustomEvent<{ slug: string | null }>).detail
      setCurrentOrgSlug(detail?.slug ?? null)
      // Invalidate all org-scoped queries — the new org context needs fresh data.
      queryClient.invalidateQueries()
    }
    window.addEventListener(ORG_CHANGED_EVENT_NAME, handleOrgChange)
    return () => window.removeEventListener(ORG_CHANGED_EVENT_NAME, handleOrgChange)
  }, [currentOrgSlug, setCurrentOrgSlug, queryClient])

  // Resolve the current organization details (for dashboard/settings views).
  const currentOrgQuery = useQuery<{ organization?: OrganizationSummaryDto } | null>({
    queryKey: ["organizations", "current"],
    queryFn: async () => {
      try {
        return await orgApi<{ organization?: OrganizationSummaryDto }>(
          "/api/organizations/current",
        )
      } catch {
        return null
      }
    },
    enabled: !!user && (view === "org-dashboard" || view === "org-settings"),
    staleTime: 30_000,
  })

  const fullOrgQuery = useQuery<{ organization: OrganizationDto } | null>({
    queryKey: ["organizations", "detail", currentOrgQuery.data?.organization?.id],
    queryFn: async () => {
      const id = currentOrgQuery.data?.organization?.id
      if (!id) return null
      try {
        return await orgApi<{ organization: OrganizationDto }>(
          `/api/organizations/${id}`,
        )
      } catch {
        return null
      }
    },
    enabled:
      !!currentOrgQuery.data?.organization?.id &&
      (view === "org-dashboard" || view === "org-settings"),
    staleTime: 30_000,
  })

  const handleOrgCreated = React.useCallback(
    (orgId: string) => {
      // Invalidate org lists so the switcher reflects the new membership.
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", "current"] })
      // Route the user to the admin shell (which is org-aware via the switcher).
      setView("admin")
      void orgId
    },
    [queryClient, setView],
  )

  const handleOrgSwitched = React.useCallback(
    (slug: string) => {
      // setOrgSlug already dispatched the event; just mirror into the store.
      setCurrentOrgSlug(slug)
    },
    [setCurrentOrgSlug],
  )

  const handleAcceptInvitation = React.useCallback(() => {
    setInviteToken(null)
    queryClient.invalidateQueries({ queryKey: ["organizations"] })
    queryClient.invalidateQueries({ queryKey: ["organizations", "current"] })
    setView("admin")
  }, [setInviteToken, setView, queryClient])

  // --- Render ------------------------------------------------------------
  if (sessionStatus === "loading" && !hydrated) {
    // Initial paint: minimal shell to avoid hydration mismatch
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  // PUBLIC LIVE-DISPLAY VIEW — no auth required, full-screen projector view,
  // no shell, no header, no footer.
  if (view === "live-display" && liveActivityId) {
    return (
      <LiveDisplay
        activityId={liveActivityId}
        type={liveActivityType ?? undefined}
        onExit={handleExitLiveDisplay}
      />
    )
  }

  // PUBLIC VERIFY VIEW — no auth required, full-screen, no header/footer chrome.
  if (view === "verify" && verifyToken) {
    return <VerifyCertificate token={verifyToken} onExit={handleExitVerify} />
  }

  // PUBLIC SHARE VIEW — no auth required, full-screen, no shell chrome.
  // Renders the shareable-achievement card for visitors with the share token.
  if (view === "share" && shareToken) {
    return (
      <React.Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        }
      >
        <PublicSharePage token={shareToken} onExit={handleExitShare} />
      </React.Suspense>
    )
  }

  // ORG REGISTER VIEW — public registration page. Aliases "org-onboarding"
  // for backwards compatibility. Renders the OrgOnboarding component directly
  // (Step 1: Google login, Step 2: org details).
  if (view === "org-register" || view === "org-onboarding") {
    return (
      <OrgOnboarding
        onCreated={handleOrgCreated}
        onCancel={user ? () => setView("admin") : undefined}
        forced={!user}
      />
    )
  }

  // NO-ORG INTERMEDIATE VIEW — shown when a user signs in via Google OAuth
  // but has no organization membership. Explains the situation and routes
  // them to registration (or sign-out so they can try a different account).
  if (view === "no-org") {
    return (
      <NoOrgRedirect
        email={user?.email}
        onRegister={() => setView("org-register")}
        onHome={() => setView("landing")}
      />
    )
  }

  // ACCEPT INVITATION VIEW — invitation deep-link (?invite=TOKEN).
  // Requires auth; the guard above redirects to login if not signed in.
  if (view === "accept-invitation" && inviteToken) {
    if (!user) {
      // Fall through to login.
    } else {
      return (
        <AcceptInvitation
          token={inviteToken}
          user={user}
          onAccepted={handleAcceptInvitation}
          onSignIn={() => {
            // Sign out then show login.
            void handleSignOut()
            setView("login")
          }}
        />
      )
    }
  }

  // ORG DASHBOARD VIEW — full-screen shell (clean, not the admin chrome).
  if (view === "org-dashboard" && user) {
    const org = fullOrgQuery.data?.organization
    const isLoading = currentOrgQuery.isLoading || fullOrgQuery.isLoading
    if (!org && isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      )
    }
    if (!org) {
      // No organization found — redirect to onboarding to create one.
      return (
        <OrgOnboarding
          onCreated={handleOrgCreated}
          onCancel={() => setView("landing")}
        />
      )
    }
    return (
      <OrgDashboardShell
        user={user}
        onSignOut={handleSignOut}
        onNavigateHome={() => setView("landing")}
        onOpenSettings={() => setView("org-settings")}
        onOpenOnboarding={() => setView("org-onboarding")}
        onOrgSwitch={handleOrgSwitched}
      >
        <OrgDashboard
          org={org}
          onCreateEvent={() => setView("admin")}
          onOpenMembers={() => setView("org-settings")}
          onOpenEvent={() => setView("admin")}
          onViewAllActivity={() => setView("org-settings")}
        />
      </OrgDashboardShell>
    )
  }

  // ORG SETTINGS VIEW — uses the same clean shell.
  if (view === "org-settings" && user) {
    const org = fullOrgQuery.data?.organization
    const isLoading = currentOrgQuery.isLoading || fullOrgQuery.isLoading
    if (!org && isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      )
    }
    if (!org) {
      // No organization found — redirect to onboarding to create one.
      return (
        <OrgOnboarding
          onCreated={handleOrgCreated}
          onCancel={() => setView("landing")}
        />
      )
    }
    return (
      <OrgDashboardShell
        user={user}
        onSignOut={handleSignOut}
        onNavigateHome={() => setView("landing")}
        onOpenSettings={() => setView("org-dashboard")}
        onOpenOnboarding={() => setView("org-onboarding")}
        onOrgSwitch={handleOrgSwitched}
      >
        <OrgSettings
          orgId={org.id}
          canEdit
          onBack={() => setView("org-dashboard")}
        />
      </OrgDashboardShell>
    )
  }

  // SUPER ADMIN LOGIN VIEW — separate from org login
  if (view === "superadmin") {
    // Wait for session + me to load before checking super admin status
    if (sessionStatus === "loading" || meQuery.isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-900">
          <div className="size-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </div>
      )
    }
    if (user && user.role === "ADMIN") {
      // Check if super admin via session
      const isSuper = (session as any)?.user?.isSuperAdmin === true
      if (isSuper) {
        return (
          <PlatformAdminShell
            user={user}
            onSignOut={handleSignOut}
            onNavigateHome={() => setView("landing")}
            onOpenAdmin={() => setView("admin")}
            onOpenSecurity={() => setView("superadmin-security")}
          />
        )
      }
    }
    // Not authed or not super admin → show login
    return (
      <SuperAdminLogin
        onSuccess={async () => {
          const me = await fetchMe()
          if (me) {
            setUser(me)
            meQuery.refetch()
            // Verify super admin in session
            const sessionRes = await fetch("/api/auth/session").then((r) => r.json())
            if (sessionRes?.user?.isSuperAdmin) {
              setView("platform")
            } else {
              toast.error("This account does not have Super Admin privileges.")
            }
          }
        }}
        onBack={() => setView("landing")}
      />
    )
  }

  // SUPER ADMIN SECURITY VIEW — TOTP 2FA setup (must be authed as super admin)
  if (view === "superadmin-security") {
    if (sessionStatus === "loading" || meQuery.isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-900">
          <div className="size-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </div>
      )
    }
    if (!user || user.role !== "ADMIN" || !(session as any)?.user?.isSuperAdmin) {
      // Not a super admin → redirect to superadmin login
      setView("superadmin")
      return null
    }
    return (
      <SuperAdminSecurity
        onBack={() => setView("platform")}
      />
    )
  }

  // PLATFORM ADMIN VIEW — super admin panel (reached after super admin login)
  if (view === "platform" && user && user.role === "ADMIN") {
    return (
      <PlatformAdminShell
        user={user}
        onSignOut={handleSignOut}
        onNavigateHome={() => setView("landing")}
        onOpenAdmin={() => setView("admin")}
        onOpenSecurity={() => setView("superadmin-security")}
      />
    )
  }

  // ADMIN VIEW
  if (view === "admin" && user && user.role === "ADMIN") {
    return (
      <AdminShell
        user={user}
        initialTab={adminTab}
        onTabChange={setAdminTab}
        onSignOut={handleSignOut}
        onNavigate={(v) => setView(v)}
        onOrgSwitch={handleOrgSwitched}
        onOpenOrgSettings={() => setView("org-settings")}
        onOpenOrgOnboarding={() => setView("org-onboarding")}
      />
    )
  }

  // STUDENT VIEW (dashboard + quiz-start + quiz-runner + activity)
  if (view === "student" && user) {
    let content: React.ReactNode
    if (studentSubView === "quiz-runner" && quizMeta) {
      // The quiz runner takes over the whole screen (no shell chrome).
      return (
        <QuizRunner
          quizLinkId={quizMeta.quizLinkId}
          requireFullscreen={quizMeta.requireFullscreen}
          timeLimit={quizMeta.timeLimit}
          quizTitle={quizMeta.quizTitle}
          user={user}
          onExit={handleQuizExit}
        />
      )
    }
    if (studentSubView === "quiz-start" && quizSlug) {
      content = (
        <QuizStart
          slug={quizSlug}
          user={user}
          onBegin={handleQuizBegin}
          onBack={() => {
            setQuizSlug(null)
            setStudentSubView("dashboard")
          }}
        />
      )
    } else if (studentSubView === "leaderboard" && quizSlug) {
      content = (
        <Leaderboard
          slug={quizSlug}
          onBack={() => {
            setQuizSlug(null)
            setStudentSubView("dashboard")
          }}
        />
      )
    } else if (studentSubView === "certificates") {
      content = <MyCertificates />
    } else if (studentSubView === "activity" && activitySlug) {
      content = (
        <ActivityJoin
          slug={activitySlug}
          user={user}
          onExit={handleActivityExit}
          onOpenLiveDisplay={handleOpenLiveDisplay}
          onQuizRedirect={handleActivityQuizRedirect}
        />
      )
    } else {
      content = (
        <StudentDashboard
          user={user}
          onStartQuiz={handleStartQuiz}
          onViewLeaderboard={handleViewLeaderboard}
        />
      )
    }
    return (
      <StudentShell
        user={user}
        onSignOut={handleSignOut}
        onNavigateHome={() => setView("landing")}
        onNavigateMyCertificates={handleNavigateMyCertificates}
      >
        {content}
      </StudentShell>
    )
  }

  // ACTIVITY deep-link view: requires auth. If authed, render the
  // ActivityJoin component inside the StudentShell so the participant has
  // normal chrome + sign-out.
  if (view === "activity" && activitySlug) {
    if (user) {
      return (
        <StudentShell
          user={user}
          onSignOut={handleSignOut}
          onNavigateHome={() => setView("landing")}
        >
          <ActivityJoin
            slug={activitySlug}
            user={user}
            onExit={handleActivityExit}
            onOpenLiveDisplay={handleOpenLiveDisplay}
            onQuizRedirect={handleActivityQuizRedirect}
          />
        </StudentShell>
      )
    }
    // Not authed — fall through to login (guard already redirected).
  }

  // PUBLIC ORG LANDING PAGE — ?org=SLUG
  if (view === "org-landing") {
    const orgSlugParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("org") : null
    if (orgSlugParam) {
      return (
        <OrgLandingPage
          orgSlug={orgSlugParam}
          onNavigate={handleNavigate}
          onOpenEvent={(eventSlug) => {
            setEventSlug(eventSlug)
            const url = new URL(window.location.href)
            url.searchParams.set("event", eventSlug)
            url.searchParams.delete("org")
            window.history.replaceState({}, "", url.toString())
            setView("event-landing")
          }}
        />
      )
    }
  }

  // PUBLIC EVENT LANDING PAGE — ?event=SLUG
  if (view === "event-landing") {
    const eventSlugParam = eventSlug || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("event") : null)
    if (eventSlugParam) {
      return (
        <EventLandingPage
          eventSlug={eventSlugParam}
          user={user}
          onNavigate={handleNavigate}
          onStartQuiz={(quizSlugParam) => {
            setQuizSlug(quizSlugParam)
            setStudentSubView("quiz-start")
            setView("student")
          }}
          onSignIn={async () => {
            const me = await fetchMe()
            if (me) {
              setUser(me)
              meQuery.refetch()
              // After sign-in, stay on event landing page (user will see "Start Test")
            }
          }}
        />
      )
    }
  }

  // QUIZ deep-link view: If authed → participant quiz-start. If not authed →
  // show participant login inline (NOT redirected to org admin login).
  if (view === "quiz" && quizSlug) {
    if (user) {
      return (
        <StudentShell
          user={user}
          onSignOut={handleSignOut}
          onNavigateHome={() => setView("landing")}
        >
          <QuizStart
            slug={quizSlug}
            user={user}
            onBegin={handleQuizBegin}
            onBack={() => {
              setQuizSlug(null)
              setStudentSubView("dashboard")
              setView("student")
            }}
          />
        </StudentShell>
      )
    }
    // Not authed → show participant login (with event context)
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader session={null} onNavigate={handleNavigate} onSignOut={handleSignOut} />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <ParticipantLogin
            slug={quizSlug}
            onSuccess={async () => {
              // After participant login:
              // 1. Fetch the user
              // 2. Auto-register them as a PARTICIPANT in the event's org
              // 3. Go to quiz-start
              const me = await fetchMe()
              if (me) {
                setUser(me)
                meQuery.refetch()

                // Auto-register as participant in the org that owns this event.
                // This adds them to the org's participant list so the org admin
                // can see who registered. Idempotent — safe if already a member.
                try {
                  await fetch("/api/events/register-participant", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ quizSlug }),
                  })
                } catch {
                  // Non-blocking — the quiz still works even if registration fails
                }

                setStudentSubView("quiz-start")
                setView("student")
              }
            }}
          />
        </main>
        <SiteFooter onNavigate={handleNavigate} />
      </div>
    )
  }

  // LOGIN VIEW
  if (view === "login") {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader session={null} onNavigate={handleNavigate} onSignOut={handleSignOut} />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <LoginForm
              onSuccess={handleLoginSuccess}
              onRegisterOrg={() => setView("org-register")}
            />
          </div>
        </main>
        <SiteFooter onNavigate={handleNavigate} />
      </div>
    )
  }

  // PRICING VIEW — standalone /?view=pricing page. Renders the full
  // PricingSection centered with the site header/footer chrome. No auth needed.
  if (view === "pricing") {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader
          session={user ? { user } : null}
          onNavigate={handleNavigate}
          onSignOut={handleSignOut}
        />
        <main className="flex-1">
          <PricingSection onNavigate={handleNavigate} standalone />
        </main>
        <SiteFooter onNavigate={handleNavigate} />
      </div>
    )
  }

  // ABOUT VIEW
  if (view === "about") {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader
          session={user ? { user } : null}
          onNavigate={handleNavigate}
          onSignOut={handleSignOut}
        />
        <main className="flex-1">
          <AboutPage onNavigate={handleNavigate} />
        </main>
        <SiteFooter onNavigate={handleNavigate} />
      </div>
    )
  }

  // PRIVACY VIEW
  if (view === "privacy") {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader
          session={user ? { user } : null}
          onNavigate={handleNavigate}
          onSignOut={handleSignOut}
        />
        <main className="flex-1">
          <PrivacyPage />
        </main>
        <SiteFooter onNavigate={handleNavigate} />
      </div>
    )
  }

  // TERMS VIEW
  if (view === "terms") {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader
          session={user ? { user } : null}
          onNavigate={handleNavigate}
          onSignOut={handleSignOut}
        />
        <main className="flex-1">
          <TermsPage />
        </main>
        <SiteFooter onNavigate={handleNavigate} />
      </div>
    )
  }

  // CONTACT VIEW
  if (view === "contact") {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader
          session={user ? { user } : null}
          onNavigate={handleNavigate}
          onSignOut={handleSignOut}
        />
        <main className="flex-1">
          <ContactPage onNavigate={handleNavigate} />
        </main>
        <SiteFooter onNavigate={handleNavigate} />
      </div>
    )
  }

  // LANDING VIEW (default)
  return (
    <div className="min-h-screen flex flex-col">
      {/* SEO: Organization + WebSite structured data for search engines. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LANDING_ORG_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LANDING_WEBSITE_JSON_LD) }}
      />
      <SiteHeader
        session={user ? { user } : null}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
      />
      <main className="flex-1">
        {/*
          Section order per the marketing-page consolidation spec:
            1. Hero
            2. Trust Strip
            3. Problem
            4. Features (Product Overview)
            5. How It Works (Event Journey)
            6. Activities
            7. Assessment
            8. Certificates
            9. (Achievement Sharing — covered by CertificateSection)
           10. Organization / SaaS
           11. Use Cases
           12. Security
           13. Pricing (DB-driven)
           14. FAQ
           15. Final CTA
        */}
        <Hero onNavigate={handleNavigate} session={user ? { user } : null} />
        <TrustStrip />
        <Features />
        <HowItWorks />
        <ActivitiesSection />
        <AssessmentSection />
        <CertificateSection />
        <OrganizationSection onNavigate={handleNavigate} />
        <TeamSection />
        <UseCases />
        <SecuritySection />
        <PricingSection onNavigate={handleNavigate} />
        <Faq />
        <CtaSection onNavigate={handleNavigate} />
      </main>
      <SiteFooter onNavigate={handleNavigate} />
    </div>
  )
}
