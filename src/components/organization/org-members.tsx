"use client"

import * as React from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  Check,
  Crown,
  Loader2,
  Mail,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react"
import { format, parseISO } from "date-fns"

import { cn, formatDate, initials } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"

import {
  api,
  INVITABLE_ROLES,
  ALL_ROLES,
  ROLE_LABEL,
  hasRole,
  type OrgMemberDto,
  type OrgRole,
  type MemberStatus,
} from "./api"

interface OrgMembersProps {
  orgId: string
  /** Whether the current user can manage members (OWNER/ADMIN). */
  canManage?: boolean
  /** Hide the page header (when embedded in settings tabs). */
  hideHeader?: boolean
}

const ROLE_BADGE_CLASS: Record<OrgRole, string> = {
  OWNER:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  ADMIN:
    "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
  EVENT_MANAGER:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  MODERATOR:
    "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300",
  EVALUATOR:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
  CHECKIN_STAFF:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
  PARTICIPANT:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
}

const STATUS_BADGE_CLASS: Record<MemberStatus, string> = {
  ACTIVE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  INVITED:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  SUSPENDED:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
}

export function OrgMembers({ orgId, canManage = true, hideHeader = false }: OrgMembersProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")

  // ─── Members query ────────────────────────────────────────────────────
  const membersQuery = useQuery<{ members: OrgMemberDto[] }>({
    queryKey: ["organizations", orgId, "members"],
    queryFn: () =>
      api<{ members: OrgMemberDto[] }>(`/api/organizations/${orgId}/members`),
    retry: 1,
    staleTime: 30_000,
  })

  const members = React.useMemo(() => membersQuery.data?.members ?? [], [membersQuery.data])

  // Filter by role (All / Staff / Participants)
  const [roleFilter, setRoleFilter] = React.useState<"ALL" | "STAFF" | "PARTICIPANT">("ALL")

  const filtered = React.useMemo(() => {
    let result = members
    if (roleFilter === "STAFF") {
      result = result.filter((m) => m.role !== "PARTICIPANT")
    } else if (roleFilter === "PARTICIPANT") {
      result = result.filter((m) => m.role === "PARTICIPANT")
    }
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        (m) =>
          m.user.email.toLowerCase().includes(s) ||
          (m.user.name?.toLowerCase().includes(s) ?? false),
      )
    }
    return result
  }, [members, search, roleFilter])

  // ─── Invite dialog ───────────────────────────────────────────────────
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteRole, setInviteRole] = React.useState<OrgRole>("EVENT_MANAGER")

  const inviteMutation = useMutation({
    mutationFn: () =>
      api<{ member: OrgMemberDto }>(`/api/organizations/${orgId}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "members"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "stats"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "audit-log"] })
      const userName = data.member.user.name || data.member.user.email
      toast.success("Member invited", {
        description: `${userName} has been added as ${ROLE_LABEL[inviteRole]}.`,
      })
      setInviteOpen(false)
      setInviteEmail("")
      setInviteRole("EVENT_MANAGER")
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to invite member"
      toast.error("Could not invite member", { description: msg })
    },
  })

  // ─── Change role dialog ──────────────────────────────────────────────
  const [changeRoleTarget, setChangeRoleTarget] = React.useState<OrgMemberDto | null>(null)
  const [newRole, setNewRole] = React.useState<OrgRole>("PARTICIPANT")

  const changeRoleMutation = useMutation({
    mutationFn: (member: OrgMemberDto) =>
      api<{ member: OrgMemberDto }>(
        `/api/organizations/${orgId}/members/${member.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: newRole }),
        },
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "members"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "audit-log"] })
      const userName = data.member.user.name || data.member.user.email
      toast.success("Role updated", {
        description: `${userName} is now ${ROLE_LABEL[newRole]}.`,
      })
      setChangeRoleTarget(null)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to change role"
      toast.error("Could not change role", { description: msg })
    },
  })

  // ─── Remove member dialog ────────────────────────────────────────────
  const [removeTarget, setRemoveTarget] = React.useState<OrgMemberDto | null>(null)

  const removeMutation = useMutation({
    mutationFn: (member: OrgMemberDto) =>
      api<{ ok: true }>(`/api/organizations/${orgId}/members/${member.id}`, {
        method: "DELETE",
      }),
    onSuccess: (_, member) => {
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "members"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "stats"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "audit-log"] })
      const userName = member.user.name || member.user.email
      toast.success("Member removed", { description: `${userName} is no longer part of this organization.` })
      setRemoveTarget(null)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to remove member"
      toast.error("Could not remove member", { description: msg })
    },
  })

  // ─── Helpers ──────────────────────────────────────────────────────────
  const ownerCount = React.useMemo(
    () => members.filter((m) => m.role === "OWNER").length,
    [members],
  )

  function openChangeRole(member: OrgMemberDto) {
    setChangeRoleTarget(member)
    setNewRole(member.role)
  }

  function openRemove(member: OrgMemberDto) {
    // Prevent removing the last OWNER.
    if (member.role === "OWNER" && ownerCount <= 1) {
      toast.warning("Cannot remove the last owner", {
        description: "Assign another member as owner before removing this one.",
      })
      return
    }
    setRemoveTarget(member)
  }

  return (
    <div className="space-y-5">
      {!hideHeader && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              <UsersIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
              Members
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {members.length} {members.length === 1 ? "person" : "people"} in this organization.
            </p>
          </div>
          {canManage && (
            <Button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm hover:from-emerald-700 hover:to-teal-700"
            >
              <UserPlus className="size-4" />
              Invite Member
            </Button>
          )}
        </div>
      )}

      {!hideHeader && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by email or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              aria-label="Search members"
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-border p-1">
            <button
              onClick={() => setRoleFilter("ALL")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${roleFilter === "ALL" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
            >All</button>
            <button
              onClick={() => setRoleFilter("STAFF")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${roleFilter === "STAFF" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
            >Staff</button>
            <button
              onClick={() => setRoleFilter("PARTICIPANT")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${roleFilter === "PARTICIPANT" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
            >Participants</button>
          </div>
        </div>
      )}

      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          {membersQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : membersQuery.isError ? (
            <div className="p-6 text-sm text-rose-600 dark:text-rose-400">
              Failed to load members:{" "}
              {(membersQuery.error as Error)?.message || "Unknown error"}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title={search ? "No matches" : "No members yet"}
              description={
                search
                  ? "Try adjusting your search query."
                  : "Invite teammates to start collaborating on events and activities."
              }
              actionLabel={canManage && !search ? "Invite Member" : undefined}
              onAction={canManage && !search ? () => setInviteOpen(true) : undefined}
              className="m-4"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/60 dark:bg-slate-800/40">
                  <TableHead className="pl-4">Member</TableHead>
                  <TableHead className="hidden md:table-cell">Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  {canManage && (
                    <TableHead className="w-12 text-right pr-4">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence initial={false}>
                  {filtered.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      canManage={canManage}
                      onOpenChangeRole={() => openChangeRole(member)}
                      onOpenRemove={() => openRemove(member)}
                    />
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Invite dialog ──────────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-emerald-600 dark:text-emerald-400" />
              Invite member
            </DialogTitle>
            <DialogDescription>
              They&apos;ll receive an invitation to join this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-sm font-medium">
                Email address
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  className="pl-8"
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as OrgRole)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="flex items-start gap-1 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                You can change roles anytime after they join.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setInviteOpen(false)}
              disabled={inviteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => inviteMutation.mutate()}
              disabled={
                inviteMutation.isPending ||
                !inviteEmail.trim() ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)
              }
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Mail className="size-4" /> Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Change role dialog ─────────────────────────────────────────── */}
      <Dialog
        open={!!changeRoleTarget}
        onOpenChange={(o) => !o && setChangeRoleTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-5 text-emerald-600 dark:text-emerald-400" />
              Change role
            </DialogTitle>
            <DialogDescription>
              {changeRoleTarget?.user.name || changeRoleTarget?.user.email} &middot;{" "}
              currently {changeRoleTarget ? ROLE_LABEL[changeRoleTarget.role] : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm font-medium">New role</Label>
            <Select
              value={newRole}
              onValueChange={(v) => setNewRole(v as OrgRole)}
              disabled={changeRoleTarget?.role === "OWNER"}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => (
                  <SelectItem
                    key={r}
                    value={r}
                    disabled={
                      // Can't demote the only OWNER.
                      changeRoleTarget?.role === "OWNER" &&
                      r !== "OWNER" &&
                      ownerCount <= 1
                    }
                  >
                    {ROLE_LABEL[r]}
                    {r === "OWNER" && changeRoleTarget?.role === "OWNER" && " (current)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {changeRoleTarget?.role === "OWNER" && ownerCount <= 1 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                You can&apos;t demote the only owner. Promote another member first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setChangeRoleTarget(null)}
              disabled={changeRoleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => changeRoleTarget && changeRoleMutation.mutate(changeRoleTarget)}
              disabled={
                changeRoleMutation.isPending ||
                !changeRoleTarget ||
                newRole === changeRoleTarget.role
              }
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {changeRoleMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Remove member dialog ───────────────────────────────────────── */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {removeTarget?.user.name || removeTarget?.user.email}
              </span>{" "}
              will no longer have access to this organization&apos;s events, activities, or members. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (removeTarget) removeMutation.mutate(removeTarget)
              }}
              disabled={removeMutation.isPending}
              className="gap-1.5 bg-rose-600 text-white hover:bg-rose-700"
            >
              {removeMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Member row ──────────────────────────────────────────────────────────────

function MemberRow({
  member,
  canManage,
  onOpenChangeRole,
  onOpenRemove,
}: {
  member: OrgMemberDto
  canManage: boolean
  onOpenChangeRole: () => void
  onOpenRemove: () => void
}) {
  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="group"
    >
      <TableCell className="pl-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-9 ring-1 ring-slate-200 dark:ring-slate-700">
            {member.user.image ? (
              <AvatarImage src={member.user.image} alt={member.user.name || ""} />
            ) : null}
            <AvatarFallback
              className="bg-emerald-50 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              {initials(member.user.name) || member.user.email[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {member.user.name || member.user.email.split("@")[0]}
              </p>
              {member.role === "OWNER" && (
                <Crown className="size-3.5 shrink-0 text-amber-500" aria-label="Owner" />
              )}
            </div>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {member.user.email}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Badge
          variant="outline"
          className={cn("gap-1 font-medium", ROLE_BADGE_CLASS[member.role])}
        >
          {member.role === "OWNER" && <Crown className="size-3" />}
          {ROLE_LABEL[member.role]}
        </Badge>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Badge
          variant="outline"
          className={cn("font-medium", STATUS_BADGE_CLASS[member.status])}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {member.status === "INVITED" ? "Invited" : member.status === "SUSPENDED" ? "Suspended" : "Active"}
        </Badge>
      </TableCell>
      <TableCell className="hidden text-sm text-slate-500 dark:text-slate-400 lg:table-cell">
        {formatDate(member.createdAt)}
      </TableCell>
      {canManage && (
        <TableCell className="pr-4 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-slate-400 opacity-60 transition-opacity hover:opacity-100 group-hover:opacity-100"
                aria-label={`Actions for ${member.user.name || member.user.email}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-slate-500">
                Member actions
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onOpenChangeRole}
                className="gap-2 text-sm"
              >
                <UserCog className="size-4 text-slate-500" />
                Change role…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onOpenRemove}
                className="gap-2 text-sm text-rose-600 focus:text-rose-700 dark:text-rose-400"
              >
                <Trash2 className="size-4" />
                Remove member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}
    </motion.tr>
  )
}
