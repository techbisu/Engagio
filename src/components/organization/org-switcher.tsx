"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Building2,
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  Settings,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"

import {
  api,
  setOrgSlug,
  ORG_CHANGED_EVENT_NAME,
  type OrganizationSummaryDto,
} from "./api"

interface OrgSwitcherProps {
  /** Called when the user switches orgs (the slug is also persisted). */
  onSwitch?: (slug: string) => void
  /** Called when the user clicks "Create Organization". */
  onCreate?: () => void
  /** Called when the user clicks "Organization settings". */
  onOpenSettings?: () => void
  /** Hide the dropdown entirely if the user has only 1 org. */
  hideOnSingle?: boolean
  className?: string
}

export function OrgSwitcher({
  onSwitch,
  onCreate,
  onOpenSettings,
  hideOnSingle = true,
  className,
}: OrgSwitcherProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)

  // Load all orgs the current user belongs to.
  const orgsQuery = useQuery<{ organizations: OrganizationSummaryDto[] }>({
    queryKey: ["organizations"],
    queryFn: () => api<{ organizations: OrganizationSummaryDto[] }>("/api/organizations"),
    retry: 1,
    staleTime: 60_000,
  })

  // Resolve the currently-active org (from /api/organizations/current).
  // Falls back to the first membership when no slug is set.
  const currentQuery = useQuery<{
    organization?: OrganizationSummaryDto
  } | null>({
    queryKey: ["organizations", "current"],
    queryFn: async () => {
      try {
        return await api<{
          organization?: OrganizationSummaryDto
        }>("/api/organizations/current")
      } catch {
        return null
      }
    },
    retry: 0,
    staleTime: 30_000,
  })

  // Listen for org-changed events dispatched by setOrgSlug() elsewhere.
  React.useEffect(() => {
    function handleOrgChange() {
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", "current"] })
      // Invalidate all org-scoped queries — they need to refetch with the new header.
      queryClient.invalidateQueries({ queryKey: ["events"] })
      queryClient.invalidateQueries({ queryKey: ["analytics"] })
      queryClient.invalidateQueries({ queryKey: ["attempts"] })
    }
    window.addEventListener(ORG_CHANGED_EVENT_NAME, handleOrgChange)
    return () =>
      window.removeEventListener(ORG_CHANGED_EVENT_NAME, handleOrgChange)
  }, [queryClient])

  const orgs = orgsQuery.data?.organizations ?? []
  const current = currentQuery.data?.organization ?? orgs[0] ?? null

  // Loading state
  if (orgsQuery.isLoading || currentQuery.isLoading) {
    return (
      <Skeleton
        className={cn("h-9 w-44 rounded-md", className)}
        aria-label="Loading organization"
      />
    )
  }

  // No orgs at all — show a "create org" CTA so the user can onboard.
  if (orgs.length === 0) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCreate}
        className={cn(
          "gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40",
          className,
        )}
      >
        <Plus className="size-4" />
        <span className="hidden sm:inline">Create Organization</span>
        <span className="sm:hidden">Create</span>
      </Button>
    )
  }

  // Only one org — show name without a dropdown (unless explicitly requested).
  if (orgs.length === 1 && hideOnSingle) {
    return (
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900",
          className,
        )}
        title={current?.name ?? "Organization"}
      >
        <OrgAvatar org={current} className="size-5" />
        <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
          {current?.name ?? "Organization"}
        </span>
        {onOpenSettings && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            onClick={onOpenSettings}
            aria-label="Organization settings"
          >
            <Settings className="size-3.5" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-2 border-slate-200 bg-white pr-2 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60",
            className,
          )}
          aria-label="Switch organization"
        >
          <OrgAvatar org={current} className="size-5" />
          <span className="max-w-[120px] truncate text-sm font-medium text-slate-700 dark:text-slate-200 sm:max-w-[180px]">
            {current?.name ?? "Select organization"}
          </span>
          <ChevronsUpDown className="size-3.5 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 p-0"
        sideOffset={6}
      >
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-wider text-slate-500">
          <span>Your organizations</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {orgs.length}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-72 overflow-y-auto py-1">
          <AnimatePresence initial={false}>
            {orgs.map((org) => {
              const isActive = current?.slug === org.slug
              return (
                <DropdownMenuItem
                  key={org.id}
                  onSelect={(e) => {
                    e.preventDefault()
                    if (!isActive) {
                      setOrgSlug(org.slug)
                      onSwitch?.(org.slug)
                      // Force refetch of all org-scoped queries immediately.
                      queryClient.invalidateQueries({ queryKey: ["organizations", "current"] })
                      queryClient.invalidateQueries({ queryKey: ["events"] })
                      queryClient.invalidateQueries({ queryKey: ["analytics"] })
                    }
                    setOpen(false)
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-none px-3 py-2 outline-none focus:bg-emerald-50 focus:text-emerald-700 dark:focus:bg-emerald-950/40 dark:focus:text-emerald-300",
                    isActive && "bg-emerald-50/50 dark:bg-emerald-950/20",
                  )}
                >
                  <OrgAvatar org={org} className="size-7" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {org.name}
                    </span>
                    <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {org.memberCount} {org.memberCount === 1 ? "member" : "members"}
                      {" · "}
                      <span className="capitalize">{org.role.toLowerCase().replace(/_/g, " ")}</span>
                    </span>
                  </div>
                  {isActive && (
                    <motion.span
                      layout
                      className="grid size-5 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </motion.span>
                  )}
                </DropdownMenuItem>
              )
            })}
          </AnimatePresence>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="flex flex-col gap-0.5 p-1.5">
          {onOpenSettings && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setOpen(false)
                onOpenSettings()
              }}
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 outline-none focus:bg-slate-100 dark:text-slate-200 dark:focus:bg-slate-800"
            >
              <Settings className="size-4 text-slate-500" />
              Organization settings
            </DropdownMenuItem>
          )}
          {onCreate && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setOpen(false)
                onCreate()
              }}
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-emerald-700 outline-none hover:bg-emerald-50 focus:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40 dark:focus:bg-emerald-950/40"
            >
              <Plus className="size-4" />
              Create organization
            </DropdownMenuItem>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function OrgAvatar({
  org,
  className,
}: {
  org: { name: string; logoUrl?: string | null; primaryColor?: string } | null | undefined
  className?: string
}) {
  const color = org?.primaryColor || "#10b981"
  if (!org) {
    return (
      <span
        className={cn(
          "grid place-items-center rounded bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
          className,
        )}
      >
        <Loader2 className="size-3 animate-spin" />
      </span>
    )
  }
  if (org.logoUrl) {
    return (
      <Avatar className={cn("rounded", className)}>
        <AvatarImage src={org.logoUrl} alt={`${org.name} logo`} />
        <AvatarFallback
          className="rounded text-[10px] font-semibold text-white"
          style={{ background: color }}
        >
          {org.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    )
  }
  return (
    <span
      className={cn(
        "grid place-items-center rounded text-white",
        className,
      )}
      style={{ background: color }}
      aria-hidden="true"
    >
      <Building2 className="size-3.5" />
    </span>
  )
}
