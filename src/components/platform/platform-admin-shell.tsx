"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Building2,
  Users,
  Trophy,
  CreditCard,
  TrendingUp,
  Activity,
  Shield,
  Globe,
  Award,
  Receipt,
  Search,
  Ban,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BarChart3,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BrandLogo } from "@/components/shared/brand-logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { SignOutButton } from "@/components/shared/sign-out-button"
import { PlatformPaymentsManager } from "./platform-payments-manager"
// Lazy-load the heavy analytics component (recharts is ~200KB gzipped).
// It's only rendered when the admin clicks the "Analytics" tab.
const PlatformAnalytics = dynamic(
  () => import("@/components/platform/platform-analytics").then((m) => m.PlatformAnalytics),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    ),
  }
)
import { cn } from "@/lib/utils"
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/i18n"
import type { SafeUser } from "@/types"

interface PlatformAdminShellProps {
  user: SafeUser
  onSignOut: () => void
  onNavigateHome: () => void
  onOpenAdmin: () => void
  onOpenSecurity?: () => void
}

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: TrendingUp },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "organizations", label: "Organizations", icon: Building2 },
  { id: "users", label: "Users", icon: Users },
  { id: "plans", label: "Plans & Billing", icon: CreditCard },
  { id: "payments", label: "Payments", icon: Receipt },
] as const

type PlatformTab = (typeof TABS)[number]["id"]

export function PlatformAdminShell({
  user,
  onSignOut,
  onNavigateHome,
  onOpenAdmin,
  onOpenSecurity,
}: PlatformAdminShellProps) {
  const [tab, setTab] = React.useState<PlatformTab>("dashboard")

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={onNavigateHome} className="rounded-md">
              <BrandLogo size="md" />
            </button>
            <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
              <Shield className="mr-1 size-3" />
              PLATFORM ADMIN
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {onOpenSecurity && (
              <Button variant="ghost" size="sm" onClick={onOpenSecurity}>
                <Shield className="mr-1.5 size-4" />
                Security
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onOpenAdmin}>
              <Building2 className="mr-1.5 size-4" />
              Org Admin
            </Button>
            <ThemeToggle />
            <SignOutButton onSignedOut={onSignOut} variant="ghost" size="icon" />
          </div>
        </div>
      </header>

      <div className="border-b border-border/60 bg-background">
        <div className="flex items-center gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                tab === t.id
                  ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          {tab === "dashboard" && <PlatformDashboard />}
          {tab === "analytics" && <PlatformAnalytics />}
          {tab === "organizations" && <OrganizationsManager />}
          {tab === "users" && <UsersManager />}
          {tab === "plans" && <PlansBillingManager />}
          {tab === "payments" && <PlatformPaymentsManager />}
        </div>
      </main>

      <footer className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © 2026 Engagio Platform. Super Admin Panel.
      </footer>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "emerald",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  hint?: string
  tone?: "emerald" | "amber" | "teal" | "slate" | "rose"
}) {
  const toneMap: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    teal: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  }
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex size-10 items-center justify-center rounded-lg", toneMap[tone])}>
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PlatformDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: () => fetch("/api/platform/stats").then((r) => r.json()),
  })

  if (isLoading || !data) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading platform stats...</div>
  }

  const s = data
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of the entire Engagio platform.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={Building2} label="Organizations" value={formatNumber(s.organizations.total)} hint={`${s.organizations.active} active`} tone="emerald" />
        <StatCard icon={Users} label="Total Users" value={formatNumber(s.users.total)} hint={`${s.users.admins} admins`} tone="teal" />
        <StatCard icon={Activity} label="Events" value={formatNumber(s.content.events)} hint={`${s.content.activeEvents} active`} tone="amber" />
        <StatCard icon={Trophy} label="Activities" value={formatNumber(s.content.activities)} tone="slate" />
        <StatCard icon={CreditCard} label="Active Subscriptions" value={formatNumber(s.billing.activeSubscriptions)} tone="emerald" />
        <StatCard icon={Receipt} label="Monthly Revenue" value={formatCurrency(s.billing.monthlyRevenue, "INR")} hint="est." tone="emerald" />
        <StatCard icon={Award} label="Certificates" value={formatNumber(s.certificates.total)} hint={`${s.certificates.valid} valid`} tone="teal" />
        <StatCard icon={TrendingUp} label="Achievements" value={formatNumber(s.achievements.total)} hint={`${s.achievements.shares} shares`} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {s.recentOrganizations?.map((org: any) => (
                <div key={org.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{org.name}</p>
                    <p className="text-xs text-muted-foreground">{org.slug} · {org.industry || "N/A"}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={org.status === "ACTIVE" ? "border-emerald-200 text-emerald-700" : "border-rose-200 text-rose-700"}>
                      {org.status}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{org.eventCount} events · {org.memberCount} members</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {s.recentUsers?.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{u.name || u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant="outline" className={u.role === "ADMIN" ? "border-amber-200 text-amber-700" : ""}>
                    {u.role}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function OrganizationsManager() {
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("ALL")
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["platform-orgs", search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (statusFilter !== "ALL") params.set("status", statusFilter)
      return fetch(`/api/platform/organizations?${params}`).then((r) => r.json())
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status?: string }) => {
      const res = await fetch(`/api/platform/organizations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Failed to update")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-orgs"] })
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] })
      toast.success("Organization updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const orgs = data?.organizations || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
        <p className="text-sm text-muted-foreground">Manage all organizations on the platform.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, slug, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead className="hidden sm:table-cell">Plan</TableHead>
                  <TableHead className="hidden md:table-cell">Stats</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
                ) : orgs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No organizations found.</TableCell></TableRow>
                ) : (
                  orgs.map((org: any) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-xs text-muted-foreground">{org.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{org.plan}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {org.stats.events} events · {org.stats.members} members
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          org.status === "ACTIVE" && "border-emerald-200 text-emerald-700",
                          org.status === "SUSPENDED" && "border-rose-200 text-rose-700",
                          org.status === "ARCHIVED" && "border-slate-200 text-slate-500",
                        )}>
                          {org.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">Actions</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {org.status !== "ACTIVE" && (
                              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: org.id, status: "ACTIVE" })}>
                                <CheckCircle2 className="mr-2 size-4 text-emerald-600" /> Activate
                              </DropdownMenuItem>
                            )}
                            {org.status === "ACTIVE" && (
                              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: org.id, status: "SUSPENDED" })}>
                                <Ban className="mr-2 size-4 text-rose-600" /> Suspend
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => updateMutation.mutate({ id: org.id, status: "ARCHIVED" })}>
                              <AlertCircle className="mr-2 size-4 text-slate-500" /> Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function UsersManager() {
  const [search, setSearch] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState("ALL")

  const { data, isLoading } = useQuery({
    queryKey: ["platform-users", search, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (roleFilter !== "ALL") params.set("role", roleFilter)
      return fetch(`/api/platform/users?${params}`).then((r) => r.json())
    },
  })

  const users = data?.users || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">All registered users on the platform.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            <SelectItem value="ADMIN">Admins</SelectItem>
            <SelectItem value="PARTICIPANT">Participants</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Stats</TableHead>
                  <TableHead className="hidden sm:table-cell">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No users found.</TableCell></TableRow>
                ) : (
                  users.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{u.name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={u.role === "ADMIN" ? "border-amber-200 text-amber-700" : ""}>
                          {u.role === "ADMIN" ? "Admin" : "Participant"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {u.stats.attempts} attempts · {u.stats.registrations} regs · {u.stats.organizations} orgs
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {formatDateTime(u.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PlansBillingManager() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: () => fetch("/api/platform/plans").then((r) => r.json()),
  })

  const plans = data?.plans || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plans & Billing</h1>
        <p className="text-sm text-muted-foreground">Manage SaaS plans, pricing, and subscriptions across all organizations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plans</CardTitle>
          <CardDescription>Each plan has multi-currency pricing. Org count = organizations on this plan.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Orgs</TableHead>
                  <TableHead>Subs</TableHead>
                  <TableHead className="hidden md:table-cell">Prices</TableHead>
                  <TableHead className="hidden lg:table-cell">Limits</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
                ) : (
                  plans.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{p.displayName}</p>
                          <p className="text-xs text-muted-foreground">{p.name}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{p.organizationCount}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{p.subscriptionCount}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="space-y-0.5">
                          {p.prices.map((pr: any) => (
                            <div key={pr.currency} className="text-xs text-muted-foreground">
                              {pr.currency}: {formatCurrency(pr.monthlyAmount, pr.currency)}/mo
                            </div>
                          ))}
                          {p.prices.length === 0 && <span className="text-xs text-muted-foreground">No prices set</span>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {p.limits?.maxEvents === -1 ? "∞" : p.limits?.maxEvents || 0} events · {" "}
                        {p.limits?.maxMembers === -1 ? "∞" : p.limits?.maxMembers || 0} members
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={p.isActive ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-500"}>
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Summary</CardTitle>
          <CardDescription>Estimated monthly revenue per plan.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {plans.filter((p: any) => p.subscriptionCount > 0).map((p: any) => (
              <div key={p.id} className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">{p.displayName}</p>
                <p className="text-lg font-bold">{p.subscriptionCount}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(p.priceMonthly * p.subscriptionCount, "INR")}/mo
                </p>
              </div>
            ))}
            {plans.filter((p: any) => p.subscriptionCount > 0).length === 0 && (
              <p className="col-span-4 py-4 text-center text-sm text-muted-foreground">
                No active paid subscriptions yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Payments tab (platform-wide manual/UPI payment approvals) ────────────────

interface PlatformPayment {
  id: string
  amount: number
  currency: string
  paymentMethod: string | null
  paymentStatus: string // PENDING_VERIFICATION | COMPLETED | REJECTED
  paymentRef: string | null
  rejectionReason: string | null
  verifiedAt: string | null
  createdAt: string
  user: { name: string | null; email: string }
  event: { id: string; title: string }
  organization: { id: string; name: string; slug: string } | null
}

interface PlatformPaymentsResponse {
  payments: PlatformPayment[]
  stats: { pending: number; approved: number; rejected: number; totalAmount: number }
}

function PaymentStatusBadge({ status }: { status: string }) {
  if (status === "PENDING_VERIFICATION") {
    return (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
      >
        Pending
      </Badge>
    )
  }
  if (status === "COMPLETED") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
      >
        Approved
      </Badge>
    )
  }
  if (status === "REJECTED") {
    return (
      <Badge
        variant="outline"
        className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
      >
        Rejected
      </Badge>
    )
  }
  return <Badge variant="outline">{status}</Badge>
}

function PlatformPaymentsManager() {
  const [statusFilter, setStatusFilter] = React.useState("ALL")
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["platform-payments", statusFilter],
    queryFn: async (): Promise<PlatformPaymentsResponse> => {
      const params = new URLSearchParams()
      if (statusFilter !== "ALL") params.set("status", statusFilter)
      const res = await fetch(`/api/platform/payments?${params}`)
      if (!res.ok) throw new Error("Failed to load payments")
      return res.json()
    },
  })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/platform/payments/${id}/approve`, {
        method: "POST",
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || "Failed to approve payment")
      return body
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-payments"] })
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] })
      toast.success("Payment approved")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await fetch(`/api/platform/payments/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason: reason }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || "Failed to reject payment")
      return body
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-payments"] })
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] })
      toast.success("Payment rejected")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleReject = (id: string) => {
    const reason = window.prompt("Enter rejection reason (required):")?.trim()
    if (!reason) return
    rejectMutation.mutate({ id, reason })
  }

  const stats = data?.stats
  const payments = data?.payments ?? []
  const approvingId = approveMutation.isPending ? approveMutation.variables : null
  const rejectingId = rejectMutation.isPending ? rejectMutation.variables?.id : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve or reject manual UPI payments across all organizations.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Activity} label="Pending" value={formatNumber(stats?.pending ?? 0)} tone="amber" />
        <StatCard icon={CheckCircle2} label="Approved" value={formatNumber(stats?.approved ?? 0)} tone="emerald" />
        <StatCard icon={Ban} label="Rejected" value={formatNumber(stats?.rejected ?? 0)} tone="rose" />
        <StatCard
          icon={Receipt}
          label="Approved Revenue"
          value={formatCurrency(stats?.totalAmount ?? 0, "INR")}
          tone="emerald"
        />
      </div>

      {/* Status filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="PENDING_VERIFICATION">Pending</SelectItem>
            <SelectItem value="COMPLETED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payments table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="hidden md:table-cell">Organization</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Reference</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      Loading payments...
                    </TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      No payments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{p.user.name || "Unnamed"}</p>
                          <p className="text-xs text-muted-foreground">{p.user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{p.event.title}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {p.organization ? (
                          <div>
                            <p className="text-sm">{p.organization.name}</p>
                            <p className="text-xs text-muted-foreground">{p.organization.slug}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No org</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{formatCurrency(p.amount, p.currency)}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{p.paymentMethod || "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={p.paymentStatus} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <p className="text-xs text-muted-foreground">{p.paymentRef || "—"}</p>
                        {p.rejectionReason && (
                          <p className="mt-0.5 text-xs text-rose-600 dark:text-rose-400">
                            {p.rejectionReason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {formatDateTime(p.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.paymentStatus === "PENDING_VERIFICATION" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                              disabled={approveMutation.isPending || rejectingId === p.id}
                              onClick={() => approveMutation.mutate(p.id)}
                            >
                              {approvingId === p.id ? (
                                <Loader2 className="mr-1 size-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-1 size-4" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
                              disabled={rejectMutation.isPending || approvingId === p.id}
                              onClick={() => handleReject(p.id)}
                            >
                              {rejectingId === p.id ? (
                                <Loader2 className="mr-1 size-4 animate-spin" />
                              ) : (
                                <Ban className="mr-1 size-4" />
                              )}
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {p.verifiedAt
                              ? `Decided ${formatDateTime(p.verifiedAt)}`
                              : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
