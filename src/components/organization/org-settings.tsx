"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  Building2,
  Check,
  ClipboardList,
  History,
  Loader2,
  Palette,
  Save,
  Settings as SettingsIcon,
  Upload,
  Users as UsersIcon,
} from "lucide-react"
import { format, parseISO } from "date-fns"

import { cn, formatDate, formatDateTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/shared/empty-state"
import { uploadImage } from "@/lib/upload-client"

import {
  api,
  type AuditLogDto,
  type OrganizationDto,
} from "./api"
import { OrgMembers } from "./org-members"

interface OrgSettingsProps {
  orgId: string
  /** Whether the current user can edit org settings. */
  canEdit?: boolean
  /** Hide the page header (when embedded in another shell). */
  hideHeader?: boolean
  /** Initial tab. */
  initialTab?: "general" | "branding" | "members" | "audit"
  onBack?: () => void
}

const INDUSTRIES = [
  "Medical",
  "Education",
  "Corporate",
  "Training",
  "Professional Association",
  "NGO",
  "Other",
] as const

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const

const LOCALES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "hi", label: "Hindi" },
  { value: "pt", label: "Portuguese" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
] as const

export function OrgSettings({
  orgId,
  canEdit = true,
  hideHeader = false,
  initialTab = "general",
  onBack,
}: OrgSettingsProps) {
  const [tab, setTab] = React.useState<"general" | "branding" | "members" | "audit">(initialTab)

  return (
    <div className="space-y-5">
      {!hideHeader && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              <SettingsIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
              Organization settings
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Manage organization details, branding, members, and audit history.
            </p>
          </div>
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              Back
            </Button>
          )}
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:flex sm:w-auto">
          <TabsTrigger value="general" className="gap-1.5">
            <SettingsIcon className="size-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-1.5">
            <Palette className="size-3.5" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5">
            <UsersIcon className="size-3.5" />
            Members
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <History className="size-3.5" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-5">
          <GeneralTab orgId={orgId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="branding" className="mt-5">
          <BrandingTab orgId={orgId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="members" className="mt-5">
          <OrgMembers orgId={orgId} canManage={canEdit} hideHeader />
        </TabsContent>

        <TabsContent value="audit" className="mt-5">
          <AuditTab orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── General tab ─────────────────────────────────────────────────────────────

interface GeneralFormState {
  name: string
  description: string
  website: string
  email: string
  phone: string
  industry: string
  timezone: string
  locale: string
}

function GeneralTab({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const orgQuery = useQuery<{ organization: OrganizationDto }>({
    queryKey: ["organizations", orgId],
    queryFn: () => api<{ organization: OrganizationDto }>(`/api/organizations/${orgId}`),
    retry: 1,
    staleTime: 60_000,
  })

  const org = orgQuery.data?.organization

  const [form, setForm] = React.useState<GeneralFormState | null>(null)

  // Sync form state when org loads.
  React.useEffect(() => {
    if (!org) return
    setForm({
      name: org.name ?? "",
      description: org.description ?? "",
      website: org.website ?? "",
      email: org.email ?? "",
      phone: org.phone ?? "",
      industry: org.industry ?? "",
      timezone: org.timezone ?? "UTC",
      locale: org.locale ?? "en",
    })
  }, [org])

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<GeneralFormState>) =>
      api<{ organization: OrganizationDto }>(`/api/organizations/${orgId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId] })
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", "current"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "audit-log"] })
      // Re-sync form from server response.
      const o = data.organization
      setForm({
        name: o.name,
        description: o.description ?? "",
        website: o.website ?? "",
        email: o.email ?? "",
        phone: o.phone ?? "",
        industry: o.industry ?? "",
        timezone: o.timezone,
        locale: o.locale,
      })
      toast.success("Changes saved", {
        description: "Organization details updated successfully.",
      })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to save changes"
      toast.error("Could not save changes", { description: msg })
    },
  })

  if (orgQuery.isLoading || !form) {
    return (
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="space-y-4 py-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const set = <K extends keyof GeneralFormState>(key: K, value: GeneralFormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="space-y-5 py-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="org-name" className="text-sm font-medium">
              Organization name
            </Label>
            <Input
              id="org-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={!canEdit || updateMutation.isPending}
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="org-description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="org-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              disabled={!canEdit || updateMutation.isPending}
              rows={3}
              maxLength={500}
              placeholder="Briefly describe what your organization does"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-website" className="text-sm font-medium">
              Website
            </Label>
            <Input
              id="org-website"
              type="url"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              disabled={!canEdit || updateMutation.isPending}
              placeholder="https://example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-email" className="text-sm font-medium">
              Contact email
            </Label>
            <Input
              id="org-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={!canEdit || updateMutation.isPending}
              placeholder="hello@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-phone" className="text-sm font-medium">
              Phone
            </Label>
            <Input
              id="org-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              disabled={!canEdit || updateMutation.isPending}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Industry</Label>
            <Select
              value={form.industry}
              onValueChange={(v) => set("industry", v)}
              disabled={!canEdit || updateMutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((ind) => (
                  <SelectItem key={ind} value={ind}>
                    {ind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Timezone</Label>
            <Select
              value={form.timezone}
              onValueChange={(v) => set("timezone", v)}
              disabled={!canEdit || updateMutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Language</Label>
            <Select
              value={form.locale}
              onValueChange={(v) => set("locale", v)}
              disabled={!canEdit || updateMutation.isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button
              type="button"
              onClick={() => updateMutation.mutate(form)}
              disabled={updateMutation.isPending}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {updateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Branding tab ───────────────────────────────────────────────────────────

interface BrandingFormState {
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
}

function BrandingTab({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const orgQuery = useQuery<{ organization: OrganizationDto }>({
    queryKey: ["organizations", orgId],
    queryFn: () => api<{ organization: OrganizationDto }>(`/api/organizations/${orgId}`),
    retry: 1,
    staleTime: 60_000,
  })

  const org = orgQuery.data?.organization

  const [form, setForm] = React.useState<BrandingFormState | null>(null)
  const [uploading, setUploading] = React.useState(false)

  React.useEffect(() => {
    if (!org) return
    setForm({
      logoUrl: org.logoUrl ?? null,
      primaryColor: org.primaryColor || "#10b981",
      secondaryColor: org.secondaryColor || "#14b8a6",
    })
  }, [org])

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<BrandingFormState>) =>
      api<{ organization: OrganizationDto }>(`/api/organizations/${orgId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId] })
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", "current"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "audit-log"] })
      const o = data.organization
      setForm({
        logoUrl: o.logoUrl ?? null,
        primaryColor: o.primaryColor,
        secondaryColor: o.secondaryColor,
      })
      toast.success("Branding saved", {
        description: "Your brand colors and logo have been updated.",
      })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to save branding"
      toast.error("Could not save branding", { description: msg })
    },
  })

  async function handleLogoUpload(file: File) {
    setUploading(true)
    try {
      const res = await uploadImage(file, "organizations")
      // Optimistic local update; persisted on save.
      setForm((f) => (f ? { ...f, logoUrl: res.url } : f))
      toast.success("Logo uploaded", {
        description: "Click Save changes to apply it to your organization.",
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed"
      toast.error("Logo upload failed", { description: msg })
    } finally {
      setUploading(false)
    }
  }

  if (orgQuery.isLoading || !form) {
    return (
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="space-y-4 py-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Live preview */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="py-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Palette className="size-4 text-emerald-600 dark:text-emerald-400" />
            Live preview
          </h3>
          <motion.div
            key={`${form.primaryColor}-${form.secondaryColor}`}
            initial={{ opacity: 0.8, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
          >
            <div
              className="px-5 py-6 text-white"
              style={{
                background: `linear-gradient(135deg, ${form.primaryColor}, ${form.secondaryColor})`,
              }}
            >
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center overflow-hidden rounded-lg bg-white/15 ring-1 ring-inset ring-white/20">
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt="Organization logo preview"
                      className="size-full object-cover"
                    />
                  ) : (
                    <Building2 className="size-6" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-bold leading-tight">
                    {org?.name || "Your organization"}
                  </p>
                  <p className="text-sm text-white/80">
                    {org?.description || "Brand preview"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white px-5 py-3 dark:bg-slate-900">
              <span
                className="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium text-white"
                style={{ background: form.primaryColor }}
              >
                Primary
              </span>
              <span
                className="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium text-white"
                style={{ background: form.secondaryColor }}
              >
                Secondary
              </span>
            </div>
          </motion.div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            These colors appear in your org dashboard header, certificate templates, and the org switcher.
          </p>
        </CardContent>
      </Card>

      {/* Editor */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="space-y-5 py-6">
          {/* Logo upload */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Logo</Label>
            <div className="flex items-center gap-4">
              <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                {form.logoUrl ? (
                  <img
                    src={form.logoUrl}
                    alt="Logo"
                    className="size-full object-cover"
                  />
                ) : (
                  <Building2 className="size-6 text-slate-400" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label
                  className={cn(
                    "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
                    (!canEdit || uploading) && "cursor-not-allowed opacity-50",
                  )}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Upload logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    disabled={!canEdit || uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleLogoUpload(f)
                      e.target.value = ""
                    }}
                    className="sr-only"
                  />
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  PNG, JPG, or SVG. Up to 1MB.
                </p>
              </div>
            </div>
          </div>

          {/* Color pickers */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="primary-color" className="text-sm font-medium">
                Primary color
              </Label>
              <ColorInput
                id="primary-color"
                value={form.primaryColor}
                onChange={(v) => setForm((f) => (f ? { ...f, primaryColor: v } : f))}
                disabled={!canEdit || updateMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="secondary-color" className="text-sm font-medium">
                Secondary color
              </Label>
              <ColorInput
                id="secondary-color"
                value={form.secondaryColor}
                onChange={(v) => setForm((f) => (f ? { ...f, secondaryColor: v } : f))}
                disabled={!canEdit || updateMutation.isPending}
              />
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button
                type="button"
                onClick={() => updateMutation.mutate(form)}
                disabled={updateMutation.isPending || uploading}
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ColorInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="absolute -left-1 -top-1 size-12 cursor-pointer border-0 bg-transparent p-0"
          aria-label="Color picker"
        />
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 font-mono uppercase"
        maxLength={7}
      />
    </div>
  )
}

// ─── Audit Log tab ───────────────────────────────────────────────────────────

function AuditTab({ orgId }: { orgId: string }) {
  const auditQuery = useQuery<{ logs: AuditLogDto[] }>({
    queryKey: ["organizations", orgId, "audit-log", { limit: 100 }],
    queryFn: () =>
      api<{ logs: AuditLogDto[] }>(
        `/api/organizations/${orgId}/audit-log?limit=100`,
      ),
    retry: 1,
    staleTime: 30_000,
  })

  const logs = auditQuery.data?.logs ?? []

  if (auditQuery.isLoading) {
    return (
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="space-y-2 py-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (auditQuery.isError) {
    return (
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="py-6 text-sm text-rose-600 dark:text-rose-400">
          Failed to load audit log.{" "}
          <button
            type="button"
            onClick={() => auditQuery.refetch()}
            className="underline"
          >
            Try again
          </button>
        </CardContent>
      </Card>
    )
  }

  if (logs.length === 0) {
    return (
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="py-6">
          <EmptyState
            icon={ClipboardList}
            title="No audit log entries yet"
            description="Actions like creating events, inviting members, and verifying payments will be recorded here for compliance."
            className="border-dashed"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {logs.length} {logs.length === 1 ? "entry" : "entries"}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => auditQuery.refetch()}
            disabled={auditQuery.isFetching}
            className="h-7 text-xs text-slate-500"
          >
            {auditQuery.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/60 dark:bg-slate-800/40">
              <TableHead className="pl-4">Action</TableHead>
              <TableHead className="hidden sm:table-cell">Entity</TableHead>
              <TableHead className="hidden md:table-cell">User</TableHead>
              <TableHead className="pr-4 text-right">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="pl-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-emerald-400 dark:bg-emerald-500" />
                    <span className="font-mono text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      {formatAction(log.action)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm text-slate-600 dark:text-slate-300 sm:table-cell">
                  {log.entityType ? (
                    <span className="text-slate-600 dark:text-slate-300">
                      {log.entityType}
                      {log.entityId && (
                        <span className="ml-1 text-xs text-slate-400">
                          ({log.entityId.slice(-6)})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden text-sm text-slate-600 dark:text-slate-300 md:table-cell">
                  {log.user?.name || log.user?.email || (
                    <span className="text-slate-400">System</span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(log.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function formatAction(action: string): string {
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
