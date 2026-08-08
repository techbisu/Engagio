"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Download,
  Search,
  Eye,
  Users,
  Mail,
  CheckCircle2,
  XCircle,
  CalendarDays,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
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
import { cn, formatDateTime, initials, truncate } from "@/lib/utils"

import { api } from "./api"
import type { EventFieldDto, RegistrationDto } from "@/types"

interface RegistrationsListProps {
  eventId: string
  eventTitle: string
  onBack: () => void
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "event"
}

/** Build a CSV string from registrations and field labels. */
function buildCsv(
  registrations: RegistrationDto[],
  fields: EventFieldDto[]
): string {
  const columns = [
    "Name",
    "Email",
    ...fields.map((f) => f.label),
    "Registered At",
  ]
  const escape = (val: unknown): string => {
    const str = val == null ? "" : String(val)
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
  const rows: string[] = [columns.map(escape).join(",")]
  for (const r of registrations) {
    const name = r.user?.name || ""
    const email = r.user?.email || ""
    const fieldVals = fields.map((f) => {
      const v = r.data?.[f.id]
      if (f.type === "checkbox") {
        return v ? "Yes" : "No"
      }
      return v ?? ""
    })
    const row = [name, email, ...fieldVals, r.createdAt].map(escape)
    rows.push(row.join(","))
  }
  return rows.join("\n")
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 500)
}

function renderValue(
  value: string | number | boolean | undefined,
  type?: string
): React.ReactNode {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-foreground/60">—</span>
  }
  if (type === "checkbox") {
    return value ? (
      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
    ) : (
      <XCircle className="size-4 text-slate-400" />
    )
  }
  if (type === "date" && typeof value === "string") {
    try {
      return new Date(value).toLocaleDateString()
    } catch {
      return String(value)
    }
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }
  const str = String(value)
  return <span title={str}>{truncate(str, 40)}</span>
}

export function RegistrationsList({
  eventId,
  eventTitle,
  onBack,
}: RegistrationsListProps) {
  const qc = useQueryClient()

  const {
    data: registrations,
    isLoading,
    isError,
    error,
  } = useQuery<RegistrationDto[]>({
    queryKey: ["registrations", eventId],
    queryFn: () =>
      api<RegistrationDto[]>(`/api/events/${eventId}/registrations`),
    enabled: !!eventId,
  })

  const { data: fields } = useQuery<EventFieldDto[]>({
    queryKey: ["fields", eventId],
    queryFn: () => api<EventFieldDto[]>(`/api/events/${eventId}/fields`),
    enabled: !!eventId,
  })

  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<RegistrationDto | null>(null)
  const [exporting, setExporting] = React.useState(false)

  const list = registrations || []
  const fieldList = (fields || []).slice().sort((a, b) => a.order - b.order)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) => {
      const name = (r.user?.name || "").toLowerCase()
      const email = (r.user?.email || "").toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [list, search])

  const uniqueEmails = React.useMemo(
    () => new Set(list.map((r) => r.user?.email).filter(Boolean)).size,
    [list]
  )

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(
        `/api/events/${eventId}/registrations?format=csv`
      )
      if (!res.ok) {
        let msg = `Request failed: ${res.status}`
        try {
          const j = await res.json()
          if (j?.error) msg = j.error
        } catch {
          /* ignore */
        }
        throw new Error(msg)
      }
      const text = await res.text()
      const filename = `registrations-${slugify(eventTitle)}.csv`
      downloadCsv(text, filename)
      toast.success(`Exported ${list.length} registration${list.length === 1 ? "" : "s"}`)
    } catch (e) {
      // Fallback: build CSV client-side from current query data.
      if (list.length > 0) {
        const csv = buildCsv(list, fieldList)
        downloadCsv(csv, `registrations-${slugify(eventTitle)}.csv`)
        toast.success("Exported (client-side fallback)")
      } else {
        toast.error("Export failed: " + (e as Error).message)
      }
    } finally {
      setExporting(false)
      // Keep server cache fresh.
      qc.invalidateQueries({ queryKey: ["registrations", eventId] })
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2 text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to events
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight truncate">
              Registrations —{" "}
              <span className="text-emerald-700 dark:text-emerald-400">
                {eventTitle}
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              {list.length} student{list.length === 1 ? "" : "s"} registered for this event.
            </p>
          </div>
          <Button
            onClick={handleExport}
            disabled={exporting || list.length === 0}
            variant="outline"
          >
            <Download className="size-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Users className="size-4" />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums">{list.length}</p>
              <p className="text-xs text-muted-foreground">Total registrations</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400">
              <Mail className="size-4" />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums">{uniqueEmails}</p>
              <p className="text-xs text-muted-foreground">Unique emails</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <CalendarDays className="size-4" />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums">
                {fieldList.length}
              </p>
              <p className="text-xs text-muted-foreground">Form fields</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      {list.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
            aria-label="Search registrations"
          />
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card className="border-rose-200 dark:border-rose-500/30">
          <CardContent className="pt-6 text-sm text-rose-600 dark:text-rose-400">
            Failed to load registrations: {(error as Error)?.message || "Unknown error"}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="py-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Users className="size-7" />
            </div>
            <p className="mt-4 text-lg font-semibold">No registrations yet</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-md">
              Share the quiz link with students — once they register, they&apos;ll appear here.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No registrations match &quot;{search}&quot;.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Student</TableHead>
                  {fieldList.map((f) => (
                    <TableHead key={f.id} className="min-w-[120px]">
                      {f.label}
                      {f.required && <span className="text-rose-500"> *</span>}
                    </TableHead>
                  ))}
                  <TableHead className="min-w-[150px]">Registered At</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          {r.user?.image ? (
                            <AvatarImage src={r.user.image} alt={r.user.name || ""} />
                          ) : null}
                          <AvatarFallback className="bg-emerald-50 text-emerald-700 text-xs dark:bg-emerald-500/10 dark:text-emerald-400">
                            {initials(r.user?.name || r.user?.email || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {r.user?.name || "Unnamed"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.user?.email || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    {fieldList.map((f) => (
                      <TableCell key={f.id} className="text-sm">
                        {renderValue(r.data?.[f.id], f.type)}
                      </TableCell>
                    ))}
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="View details"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelected(r)
                        }}
                      >
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="w-full text-left p-3 hover:bg-muted/40 transition-colors flex items-start gap-3"
              >
                <Avatar className="size-9 shrink-0">
                  {r.user?.image ? (
                    <AvatarImage src={r.user.image} alt={r.user.name || ""} />
                  ) : null}
                  <AvatarFallback className="bg-emerald-50 text-emerald-700 text-xs dark:bg-emerald-500/10 dark:text-emerald-400">
                    {initials(r.user?.name || r.user?.email || "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium truncate">{r.user?.name || "Unnamed"}</p>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDateTime(r.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{r.user?.email}</p>
                  {fieldList.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {fieldList.slice(0, 3).map((f) => (
                        <Badge
                          key={f.id}
                          variant="outline"
                          className="text-[10px] font-normal bg-slate-50 dark:bg-slate-800/60"
                        >
                          {f.label}:{" "}
                          {(() => {
                            const v = r.data?.[f.id]
                            if (f.type === "checkbox") return v ? "Yes" : "No"
                            if (v == null || v === "") return "—"
                            return truncate(String(v), 16)
                          })()}
                        </Badge>
                      ))}
                      {fieldList.length > 3 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal bg-slate-50 dark:bg-slate-800/60"
                        >
                          +{fieldList.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registration details</DialogTitle>
            <DialogDescription>
              Submitted {selected ? formatDateTime(selected.createdAt) : ""}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Student */}
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Avatar className="size-10">
                  {selected.user?.image ? (
                    <AvatarImage
                      src={selected.user.image}
                      alt={selected.user.name || ""}
                    />
                  ) : null}
                  <AvatarFallback className="bg-emerald-50 text-emerald-700 text-sm dark:bg-emerald-500/10 dark:text-emerald-400">
                    {initials(selected.user?.name || selected.user?.email || "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {selected.user?.name || "Unnamed"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {selected.user?.email || "—"}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Field values */}
              {fieldList.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No form fields are configured for this event.
                </p>
              ) : (
                <dl className="space-y-2.5">
                  {fieldList.map((f) => {
                    const v = selected.data?.[f.label]
                    return (
                      <div
                        key={f.id}
                        className="grid grid-cols-3 gap-3 items-start text-sm"
                      >
                        <dt className="text-muted-foreground font-medium col-span-1">
                          {f.label}
                        </dt>
                        <dd className="col-span-2 break-words">
                          {f.type === "checkbox" ? (
                            v ? (
                              <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30">
                                <CheckCircle2 className="size-3" /> Yes
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                <XCircle className="size-3" /> No
                              </Badge>
                            )
                          ) : v === undefined || v === null || v === "" ? (
                            <span className="text-muted-foreground/60">—</span>
                          ) : (
                            String(v)
                          )}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">User ID</p>
                  <p className="font-mono break-all">{selected.userId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Registration ID</p>
                  <p className="font-mono break-all">{selected.id}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
