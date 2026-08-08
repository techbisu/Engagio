"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  HelpCircle,
  Layers,
  Loader2,
  Maximize,
  PlayCircle,
  ShieldAlert,
  Target,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { api } from "./api"
import type { AttemptListResponse, QuizLinkBySlugResponse } from "./api"
import { RegistrationForm } from "./registration-form"
import { PaymentScreen } from "./payment-screen"
import { cn } from "@/lib/utils"
import type { SafeUser } from "@/types"

interface RegCheckResponse {
  registered: boolean
  registration?: {
    id: string
    createdAt: string
    data: Record<string, unknown>
  }
}

interface PaymentStatusResponse {
  registration: {
    id: string
    paymentStatus: "NONE" | "PENDING_VERIFICATION" | "COMPLETED" | "REJECTED"
    rejectionReason?: string | null
  } | null
  paymentStatus: "NONE" | "PENDING_VERIFICATION" | "COMPLETED" | "REJECTED"
}

export interface QuizStartProps {
  slug: string
  user: SafeUser
  onBegin: (meta: QuizLinkBySlugResponse) => void
  onBack: () => void
}

export function QuizStart({ slug, user, onBegin, onBack }: QuizStartProps) {
  const {
    data: meta,
    isLoading,
    isError,
    error,
  } = useQuery<QuizLinkBySlugResponse>({
    queryKey: ["quiz-link", slug],
    queryFn: () => api<QuizLinkBySlugResponse>(`/api/quiz-links/by-slug/${encodeURIComponent(slug)}`),
    retry: false,
  })

  // Fetch the user's attempts to figure out remaining attempts (only if logged in)
  const { data: attemptsData } = useQuery<AttemptListResponse>({
    queryKey: ["attempts", "list"],
    queryFn: () => api<AttemptListResponse>("/api/attempts/list"),
    enabled: !!user,
  })

  // Check whether the student has already registered for this event.
  // Only fires when the event requires registration, the user is logged in,
  // and we know the event id (i.e. after the meta query has resolved).
  const regCheckQuery = useQuery<RegCheckResponse>({
    queryKey: ["registration-check", meta?.event?.id],
    queryFn: () =>
      api<RegCheckResponse>(
        `/api/registrations/check?eventId=${encodeURIComponent(meta!.event!.id)}`,
      ),
    enabled:
      !!meta?.event?.id && !!user && !!meta?.requireRegistration,
    retry: false,
  })

  const isRegistered = regCheckQuery.data?.registered === true
  const checkingRegistration =
    !!meta?.requireRegistration && regCheckQuery.isLoading
  // We render the RegistrationForm only after the reg-check query has
  // finished (loaded or errored) so we don't flash the form while we're
  // still deciding whether the student is already registered.
  const needsRegistration =
    !!meta?.requireRegistration &&
    !isRegistered &&
    regCheckQuery.isFetched

  // ---- Payment gate ---------------------------------------------------
  // The event requires manual payment when:
  //   - The event's paymentMethod is "MANUAL" AND
  //   - The paymentAmount is > 0 (or there's any payment config at all).
  // We only render the PaymentScreen when the student is past the
  // registration gate (either registered already, or registration isn't
  // required at all — in which case we can't have a `Registration` row yet,
  // so payment can't apply; treat as no payment required).
  const eventRequiresPayment =
    !!meta?.event?.id &&
    (meta.event?.paymentMethod === "MANUAL") &&
    !!isRegistered

  const paymentStatusQuery = useQuery<PaymentStatusResponse>({
    queryKey: ["payment-status", meta?.event?.id],
    queryFn: () =>
      api<PaymentStatusResponse>(
        `/api/registrations/payment?eventId=${encodeURIComponent(meta!.event!.id)}`,
      ),
    enabled: eventRequiresPayment && !!user,
    retry: false,
  })

  const paymentStatus = paymentStatusQuery.data?.paymentStatus ?? "NONE"
  // Render the PaymentScreen when:
  //   - event requires payment AND
  //   - we have fetched the payment status (don't flash) AND
  //   - paymentStatus is not COMPLETED.
  const needsPayment =
    eventRequiresPayment &&
    paymentStatusQuery.isFetched &&
    paymentStatus !== "COMPLETED"

  const usedAttempts = React.useMemo(() => {
    if (!attemptsData?.attempts || !meta) return 0
    return attemptsData.attempts.filter(
      (a) =>
        a.quizLink?.slug === meta.quizLink.slug &&
        a.status !== "IN_PROGRESS",
    ).length
  }, [attemptsData, meta])

  const maxAttempts = meta?.maxAttempts ?? 0
  const remaining =
    maxAttempts > 0 ? Math.max(0, maxAttempts - usedAttempts) : Infinity
  const maxReached = maxAttempts > 0 && remaining <= 0

  // Loading state
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 text-muted-foreground">
          <ArrowLeft className="size-4" /> Back to Dashboard
        </Button>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error / not found / inactive / expired
  if (isError || !meta) {
    const message =
      error instanceof Error
        ? error.message
        : "We couldn't load this quiz. Please check the code and try again."
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 text-muted-foreground">
          <ArrowLeft className="size-4" /> Back to Dashboard
        </Button>
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              <CardTitle>Quiz unavailable</CardTitle>
            </div>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onBack} variant="outline">
              <ArrowLeft className="size-4" /> Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Registration gate: render the registration form INSTEAD of the
  // pre-quiz card when the event requires registration and the student
  // hasn't registered yet. The form invalidates the ['registration-check']
  // query on success — once that refetch returns registered:true,
  // needsRegistration flips to false and the pre-quiz card renders.
  if (needsRegistration && meta.event) {
    return (
      <RegistrationForm
        eventId={meta.event.id}
        eventTitle={meta.event.title}
        onRegistered={() => {
          // No-op: the form already invalidates the query; the parent
          // re-renders automatically when the refetch resolves.
        }}
        onBack={onBack}
      />
    )
  }

  // Payment gate: render the PaymentScreen instead of the pre-quiz card
  // when the event requires MANUAL payment AND the student's registration
  // is not yet COMPLETED. After payment verification (onPaid), we
  // invalidate the payment-status query and fall through to the pre-quiz
  // card below.
  if (needsPayment && meta.event) {
    const ev = meta.event
    return (
      <PaymentScreen
        eventId={ev.id}
        eventTitle={ev.title}
        paymentAmount={ev.paymentAmount ?? 0}
        paymentCurrency={ev.paymentCurrency ?? "INR"}
        paymentInstructions={ev.paymentInstructions ?? null}
        upiId={ev.upiId ?? null}
        upiLink={ev.upiLink ?? null}
        qrCodeUrl={ev.qrCodeUrl ?? null}
        requireTransactionRef={ev.requireTransactionRef ?? true}
        requireScreenshot={ev.requireScreenshot ?? true}
        onPaid={() => {
          // Invalidate the payment-status query so it refetches and
          // (assuming the admin approved) `paymentStatus` flips to
          // COMPLETED, which makes `needsPayment` false.
          paymentStatusQuery.refetch()
        }}
        onBack={onBack}
      />
    )
  }

  const event = meta.event
  const quizLink = meta.quizLink
  const hasImage = !!event?.image

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 text-muted-foreground">
        <ArrowLeft className="size-4" /> Back to Dashboard
      </Button>

      {/* Hero card */}
      <Card className="overflow-hidden">
        {hasImage && (
          <div className="relative aspect-[16/7] w-full bg-slate-100 dark:bg-slate-800">
            <img
              src={event!.image!}
              alt={event!.title}
              className="size-full object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = "none"
              }}
            />
          </div>
        )}
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
              Quiz code: {quizLink.slug}
            </Badge>
            {meta.requireFullscreen && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                <Maximize className="size-3" /> Fullscreen required
              </Badge>
            )}
            {meta.requireRegistration && isRegistered && (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckCircle2 className="size-3" /> Registered
              </Badge>
            )}
          </div>
          <CardTitle className="text-2xl">{event?.title ?? "Quiz"}</CardTitle>
          {event?.description && (
            <CardDescription className="text-sm leading-relaxed sm:text-base">
              {event.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Summary grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryItem
              icon={HelpCircle}
              label="Questions"
              value={String(meta.questionCount)}
            />
            <SummaryItem
              icon={Clock}
              label="Time limit"
              value={meta.timeLimit > 0 ? `${meta.timeLimit} min` : "No limit"}
            />
            <SummaryItem
              icon={Target}
              label="Pass mark"
              value={`${meta.passThreshold}%`}
            />
            <SummaryItem
              icon={Layers}
              label="Max attempts"
              value={meta.maxAttempts > 0 ? String(meta.maxAttempts) : "∞"}
            />
          </div>

          <Separator />

          {/* Anti-cheat warning */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Anti-cheat protection enabled
                </p>
                <p className="text-amber-800 dark:text-amber-300">
                  You&apos;ll need to enter fullscreen mode. Switching tabs,
                  copying, or right-clicking will be flagged. Your IP and device
                  info will be logged.
                </p>
              </div>
            </div>
          </div>

          {/* Attempts info */}
          {maxAttempts > 0 && (
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4",
                maxReached
                  ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                  : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
              )}
            >
              <Award
                className={cn(
                  "size-5 shrink-0",
                  maxReached
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              />
              <div className="flex-1 text-sm">
                {maxReached ? (
                  <>
                    <p className="font-semibold text-red-900 dark:text-red-200">
                      Max attempts reached
                    </p>
                    <p className="text-red-700 dark:text-red-300">
                      You&apos;ve used all {maxAttempts} attempt
                      {maxAttempts === 1 ? "" : "s"} for this quiz.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                      {remaining} attempt{remaining === 1 ? "" : "s"} remaining
                    </p>
                    <p className="text-emerald-700 dark:text-emerald-300">
                      You&apos;ve used {usedAttempts} of {maxAttempts}.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onBack} className="sm:order-1">
              <ArrowLeft className="size-4" /> Back to Dashboard
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => meta && onBegin(meta)}
                  disabled={
                    maxReached ||
                    checkingRegistration ||
                    (eventRequiresPayment && paymentStatusQuery.isLoading)
                  }
                  className="bg-emerald-600 text-white hover:bg-emerald-700 sm:order-2"
                >
                  {maxReached ? (
                    <>
                      <AlertTriangle className="size-4" /> Max attempts reached
                    </>
                  ) : checkingRegistration ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Checking…
                    </>
                  ) : eventRequiresPayment &&
                    paymentStatusQuery.isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Checking payment…
                    </>
                  ) : (
                    <>
                      <PlayCircle className="size-4" /> Begin Quiz
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              {checkingRegistration && (
                <TooltipContent>Checking registration…</TooltipContent>
              )}
              {eventRequiresPayment && paymentStatusQuery.isLoading && (
                <TooltipContent>Checking payment status…</TooltipContent>
              )}
            </Tooltip>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <Icon className="mx-auto mb-1 size-4 text-emerald-600 dark:text-emerald-400" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
