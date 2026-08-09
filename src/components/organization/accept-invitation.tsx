"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  Mail,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react"

import { cn, timeAgo } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  api,
  setOrgSlug,
  ROLE_LABEL,
  type OrgInvitationDto,
} from "./api"
import type { SafeUser } from "@/types"

interface AcceptInvitationProps {
  token: string
  /** Current signed-in user (null if not signed in). */
  user?: SafeUser | null
  onAccepted: () => void
  /** Called when the user wants to sign in with a different account. */
  onSignIn?: () => void
}

export function AcceptInvitation({
  token,
  user,
  onAccepted,
  onSignIn,
}: AcceptInvitationProps) {
  const queryClient = useQueryClient()

  // ─── Fetch invitation details ─────────────────────────────────────────
  const invitationQuery = useQuery<OrgInvitationDto>({
    queryKey: ["organizations", "invitations", token],
    queryFn: () =>
      api<OrgInvitationDto>(`/api/organizations/invitations/${token}`),
    retry: 1,
    staleTime: 30_000,
  })

  // ─── Accept mutation ──────────────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: () =>
      api<{ organization: { id: string; slug: string }; member: unknown }>(
        `/api/organizations/invitations/${token}`,
        { method: "POST" },
      ),
    onSuccess: (data) => {
      // Set the new org as active so subsequent queries target it.
      setOrgSlug(data.organization.slug)
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", "current"] })
      toast.success("Invitation accepted", {
        description: "Welcome to your new organization.",
      })
      onAccepted()
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to accept invitation"
      toast.error("Could not accept invitation", { description: msg })
    },
  })

  // ─── Loading state ────────────────────────────────────────────────────
  if (invitationQuery.isLoading) {
    return (
      <InvitationShell>
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Loading invitation…
          </p>
        </div>
      </InvitationShell>
    )
  }

  // ─── Error state (token invalid or fetch failed) ─────────────────────
  if (invitationQuery.isError || !invitationQuery.data) {
    return (
      <InvitationShell>
        <ErrorState
          icon={XCircle}
          title="Invitation not found"
          description={
            (invitationQuery.error as Error)?.message ||
            "This invitation link is invalid or has been removed."
          }
          onSignIn={onSignIn}
        />
      </InvitationShell>
    )
  }

  const invitation = invitationQuery.data

  // ─── Already accepted ────────────────────────────────────────────────
  if (invitation.status === "ACCEPTED") {
    return (
      <InvitationShell>
        <Card className="border-emerald-200 dark:border-emerald-900/60">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="size-7" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
              Already a member
            </h2>
            <p className="mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">
              You&apos;ve already accepted this invitation to join{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {invitation.organization.name}
              </span>
              .
            </p>
            <Button
              type="button"
              onClick={onAccepted}
              className="mt-5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Go to organization
            </Button>
          </CardContent>
        </Card>
      </InvitationShell>
    )
  }

  // ─── Expired ──────────────────────────────────────────────────────────
  const isExpired =
    invitation.status === "EXPIRED" ||
    new Date(invitation.expiresAt).getTime() < Date.now()

  if (isExpired) {
    return (
      <InvitationShell>
        <ErrorState
          icon={Clock}
          title="Invitation expired"
          description={`This invitation to ${invitation.organization.name} expired ${timeAgo(invitation.expiresAt)}. Please request a new invitation from an administrator.`}
          onSignIn={onSignIn}
        />
      </InvitationShell>
    )
  }

  // ─── Cancelled ───────────────────────────────────────────────────────
  if (invitation.status === "CANCELLED") {
    return (
      <InvitationShell>
        <ErrorState
          icon={XCircle}
          title="Invitation cancelled"
          description={`The invitation to ${invitation.organization.name} was cancelled by an administrator.`}
          onSignIn={onSignIn}
        />
      </InvitationShell>
    )
  }

  // ─── Email mismatch ───────────────────────────────────────────────────
  const emailMismatch =
    user && invitation.email.toLowerCase() !== user.email.toLowerCase()

  if (emailMismatch) {
    return (
      <InvitationShell>
        <Card className="border-amber-200 dark:border-amber-900/60">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertCircle className="size-7" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
              Wrong email address
            </h2>
            <p className="mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">
              This invitation was sent to{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {invitation.email}
              </span>
              , but you&apos;re signed in as{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {user.email}
              </span>
              . Sign out and sign in with the invited email to accept.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {onSignIn && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSignIn}
                  className="border-slate-200 dark:border-slate-700"
                >
                  Sign out &amp; switch
                </Button>
              )}
              <Button
                type="button"
                onClick={onAccepted}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Continue to dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </InvitationShell>
    )
  }

  // ─── Not signed in ─────────────────────────────────────────────────────
  if (!user) {
    return (
      <InvitationShell>
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
          <div
            className="px-6 py-8 text-white"
            style={{
              background: `linear-gradient(135deg, ${invitation.organization.primaryColor || "#10b981"}, #14b8a6)`,
            }}
          >
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/20">
                <Building2 className="size-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-white/80">
                  Invitation to join
                </p>
                <h1 className="text-xl font-bold">
                  {invitation.organization.name}
                </h1>
              </div>
            </div>
          </div>
          <CardContent className="space-y-4 py-6">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="text-sm">
                  <p className="text-slate-700 dark:text-slate-200">
                    You&apos;ve been invited as{" "}
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      {ROLE_LABEL[invitation.role]}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Sent to{" "}
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {invitation.email}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sign in with{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {invitation.email}
              </span>{" "}
              to accept this invitation and join the organization.
            </p>
            <Button
              type="button"
              onClick={onSignIn}
              className="w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <LogIn className="size-4" />
              Sign in to accept
            </Button>
          </CardContent>
        </Card>
      </InvitationShell>
    )
  }

  // ─── Accept view (default) ─────────────────────────────────────────────
  return (
    <InvitationShell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <Card className="overflow-hidden border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div
            className="px-6 py-8 text-white"
            style={{
              background: `linear-gradient(135deg, ${invitation.organization.primaryColor || "#10b981"}, ${invitation.organization.secondaryColor || "#14b8a6"})`,
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar className="size-11 rounded-xl ring-1 ring-inset ring-white/20">
                {invitation.organization.logoUrl ? (
                  <AvatarImage
                    src={invitation.organization.logoUrl}
                    alt={`${invitation.organization.name} logo`}
                  />
                ) : null}
                <AvatarFallback
                  className="rounded-xl bg-white/15 text-sm font-semibold"
                >
                  <Building2 className="size-5" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-white/80">
                  You&apos;re invited to join
                </p>
                <h1 className="truncate text-xl font-bold sm:text-2xl">
                  {invitation.organization.name}
                </h1>
              </div>
            </div>
          </div>

          <CardHeader>
            <CardTitle className="text-base text-slate-900 dark:text-slate-50">
              Accept your invitation
            </CardTitle>
            <CardDescription>
              You&apos;ll be added as{" "}
              <Badge
                variant="outline"
                className="mx-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                {ROLE_LABEL[invitation.role]}
              </Badge>
              to this organization.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Invited email</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-100">
                    {invitation.email}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Role</dt>
                  <dd className="font-medium text-emerald-700 dark:text-emerald-300">
                    {ROLE_LABEL[invitation.role]}
                  </dd>
                </div>
                {invitation.invitedBy && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">Invited by</dt>
                    <dd className="font-medium text-slate-800 dark:text-slate-100">
                      {invitation.invitedBy.name || invitation.invitedBy.email}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Expires</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-100">
                    {timeAgo(invitation.expiresAt)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50/50 p-3 dark:bg-emerald-950/20">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs text-emerald-900 dark:text-emerald-200">
                As a member, you&apos;ll be able to access events, activities,
                and team features based on your role.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="w-full gap-1.5 bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Accepting…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Accept Invitation
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </InvitationShell>
  )
}

// ─── Layout helpers ─────────────────────────────────────────────────────────

function InvitationShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-0 size-80 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-0 size-96 rounded-full bg-teal-300/20 blur-3xl dark:bg-teal-500/10"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  )
}

function ErrorState({
  icon: Icon,
  title,
  description,
  onSignIn,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  onSignIn?: () => void
}) {
  return (
    <Card className="border-rose-200 dark:border-rose-900/60">
      <CardContent className="flex flex-col items-center py-10 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <Icon className="size-7" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
          {title}
        </h2>
        <p className="mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>
        {onSignIn && (
          <Button
            type="button"
            variant="outline"
            onClick={onSignIn}
            className="mt-5 border-slate-200 dark:border-slate-700"
          >
            Back to sign in
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
