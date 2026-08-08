"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Sparkles,
  Trophy,
  Unlink,
} from "lucide-react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShareAchievementCard } from "./share-achievement-card"
import { api, type PublicAchievementDto } from "./api"

export interface PublicSharePageProps {
  token: string
  /** Optional: home handler used by the "back to home" button. */
  onExit?: () => void
}

type FetchState =
  | { kind: "loading" }
  | { kind: "error"; status: number; message: string }
  | { kind: "private" }
  | { kind: "revoked" }
  | { kind: "ready"; data: PublicAchievementDto }

export function PublicSharePage({ token, onExit }: PublicSharePageProps) {
  const query = useQuery<PublicAchievementDto>({
    queryKey: ["share", "public", token],
    queryFn: () =>
      api<PublicAchievementDto>(`/api/share/${token}`, {
        // Public endpoint — no auth headers needed.
      }),
    enabled: !!token,
    retry: false,
    staleTime: 60_000,
  })

  // Derive the UI state from the query result.
  const state: FetchState = React.useMemo(() => {
    if (query.isLoading) return { kind: "loading" }
    if (query.isError) {
      const status =
        (query.error as { status?: number } | undefined)?.status ?? 0
      // If the response was 404 (revoked) vs 403 (private), we want different UI.
      // We can't always read the status from the Error — so we re-derive from message.
      const msg = query.error instanceof Error ? query.error.message : ""
      if (/private|403|forbidden/i.test(msg)) {
        return { kind: "private" }
      }
      if (/revok|no longer|404|not found/i.test(msg)) {
        return { kind: "revoked" }
      }
      return { kind: "error", status: 0, message: msg || "Couldn't load." }
    }
    const data = query.data
    if (!data) return { kind: "loading" }
    if (data.visibility === "PRIVATE") return { kind: "private" }
    return { kind: "ready", data }
  }, [query])

  // Set document.title + meta description dynamically for OG-ish behavior.
  React.useEffect(() => {
    if (state.kind === "ready") {
      const { ogTitle, ogDescription } = state.data
      document.title = ogTitle
        ? `${ogTitle} · Engagio`
        : `${state.data.participantName}'s Achievement · Engagio`
      setMetaDescription(
        ogDescription ||
          `${state.data.participantName} achieved ${state.data.title} on Engagio.`,
      )
      setMetaProperty("og:title", ogTitle || state.data.title)
      setMetaProperty(
        "og:description",
        ogDescription ||
          `${state.data.participantName} achieved ${state.data.title}.`,
      )
      if (state.data.imageUrl) {
        setMetaProperty("og:image", state.data.imageUrl)
        setMetaName("twitter:card", "summary_large_image")
      }
    } else {
      document.title = "Shared Achievement · Engagio"
    }
  }, [state])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => onExit?.()}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Back to Engagio</span>
            <span className="sm:hidden">Back</span>
          </button>
          <Link
            href="/?view=login"
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300"
          >
            <Sparkles className="size-3.5" />
            Powered by Engagio
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full">
          {state.kind === "loading" ? <LoadingState /> : null}
          {state.kind === "error" ? (
            <ErrorState message={state.message} onExit={onExit} />
          ) : null}
          {state.kind === "private" ? (
            <PrivateState onExit={onExit} />
          ) : null}
          {state.kind === "revoked" ? (
            <RevokedState onExit={onExit} />
          ) : null}
          {state.kind === "ready" ? (
            <AchievementView data={state.data} onExit={onExit} />
          ) : null}
        </div>
      </main>

      <footer className="mt-auto border-t border-slate-200/60 px-4 py-4 dark:border-slate-800">
        <div className="mx-auto max-w-3xl text-center text-[11px] text-muted-foreground">
          <span>© {new Date().getFullYear()} Engagio · </span>
          <Link
            href="/?view=login"
            className="font-medium text-emerald-700 hover:underline dark:text-emerald-300"
          >
            Create your own event
          </Link>
        </div>
      </footer>
    </div>
  )
}

// ---- Loading / error / empty states ----

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <Loader2 className="size-10 animate-spin text-emerald-600" />
      <p className="text-sm text-muted-foreground">Loading achievement…</p>
    </div>
  )
}

function ErrorState({
  message,
  onExit,
}: {
  message: string
  onExit?: () => void
}) {
  return (
    <CenteredCard
      icon={<Unlink className="size-8 text-rose-500" />}
      title="Couldn't load this achievement"
      subtitle={message}
    >
      <Button onClick={() => onExit?.()} variant="outline">
        Back to Engagio
      </Button>
    </CenteredCard>
  )
}

function PrivateState({ onExit }: { onExit?: () => void }) {
  return (
    <CenteredCard
      icon={<Lock className="size-8 text-slate-500" />}
      title="This achievement is private"
      subtitle="The owner has set this achievement to private. Only they can view it."
    >
      <Button onClick={() => onExit?.()} variant="outline">
        Back to Engagio
      </Button>
    </CenteredCard>
  )
}

function RevokedState({ onExit }: { onExit?: () => void }) {
  return (
    <CenteredCard
      icon={<Unlink className="size-8 text-amber-500" />}
      title="This link is no longer available"
      subtitle="The owner has revoked this share link, or it doesn't exist anymore."
    >
      <Button onClick={() => onExit?.()} variant="outline">
        Back to Engagio
      </Button>
    </CenteredCard>
  )
}

function AchievementView({
  data,
  onExit,
}: {
  data: PublicAchievementDto
  onExit?: () => void
}) {
  return (
    <div className="space-y-6">
      {/* Achievement card (use generated PNG if available, else styled card) */}
      <div className="mx-auto w-full max-w-[420px]">
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt={`${data.title} — ${data.participantName}`}
            className="w-full rounded-2xl shadow-xl ring-1 ring-black/5"
          />
        ) : (
          <ShareAchievementCard achievement={data} />
        )}
      </div>

      {/* Meta row */}
      <div className="mx-auto flex max-w-[420px] flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        {data.participantName && (
          <Badge variant="outline" className="gap-1">
            <Trophy className="size-3 text-emerald-600" />
            {data.participantName}
          </Badge>
        )}
        {data.createdAt && (
          <Badge variant="outline" className="gap-1">
            <CalendarDays className="size-3" />
            {format(new Date(data.createdAt), "MMM d, yyyy")}
          </Badge>
        )}
        {data.visibility === "LINK_ONLY" && (
          <Badge
            variant="outline"
            className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <EyeOff className="size-3" />
            Link only
          </Badge>
        )}
        {data.visibility === "PUBLIC" && (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <Eye className="size-3" />
            Public
          </Badge>
        )}
      </div>

      {/* CTAs */}
      <div className="mx-auto flex max-w-[420px] flex-col gap-2 sm:flex-row sm:justify-center">
        {data.achievementData?.eventTitle && (
          <Button variant="outline" onClick={() => onExit?.()}>
            <Trophy className="size-4" />
            View Event
          </Button>
        )}
        <Link href="/?view=login" className="sm:inline-flex">
          <Button
            className={cn(
              "w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto",
            )}
          >
            <Sparkles className="size-4" />
            Create your own event with Engagio
          </Button>
        </Link>
      </div>
    </div>
  )
}

function CenteredCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border bg-white p-8 text-center shadow-sm dark:bg-slate-900">
      <div className="grid size-16 place-items-center rounded-full bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        {icon}
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  )
}

// ---- Meta tag helpers ----

function setMetaName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute("name", name)
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}

function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute("property", property)
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}

function setMetaDescription(content: string) {
  setMetaName("description", content)
}
