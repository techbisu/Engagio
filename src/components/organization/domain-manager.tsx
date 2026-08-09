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
  AlertCircle,
  Check,
  Copy,
  Globe,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"

import { api, type PlanName } from "./api"

// ─── Types ────────────────────────────────────────────────────────────────

type DomainType = "SUBDOMAIN" | "CUSTOM_DOMAIN"
type DomainStatus =
  | "PENDING"
  | "VERIFYING"
  | "VERIFIED"
  | "ACTIVE"
  | "FAILED"
  | "DISABLED"

interface DomainDto {
  id: string
  domain: string
  type: DomainType
  isPrimary: boolean
  status: DomainStatus
  verifiedAt: string | null
  createdAt: string
}

interface DnsInstructions {
  recordType: "CNAME" | "TXT"
  name: string
  value: string
  instructions: string
}

interface AddDomainResponse {
  domain: DomainDto
  verificationToken: string
  dnsInstructions: DnsInstructions
}

interface VerifyDomainResponse {
  verified: boolean
  status: DomainStatus
  message: string
}

interface BillingSummary {
  plan: {
    name: PlanName
    displayName: string
    priceMonthly: number
    priceYearly: number
  }
  entitlements: {
    features: Record<string, boolean>
    limits: Record<string, unknown>
  }
}

interface DomainManagerProps {
  orgId: string
  /** The org's subdomain slug — used for the read-only subdomain preview. */
  orgSlug?: string
  /** Hide the page header (when embedded in settings tabs). */
  hideHeader?: boolean
  /** Called when the user clicks "View Plans" on the locked card. */
  onViewPlans?: () => void
}

// ─── Status badge config ─────────────────────────────────────────────────

const STATUS_BADGE: Record<
  DomainStatus,
  { label: string; className: string; dot: string }
> = {
  PENDING: {
    label: "Pending",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  VERIFYING: {
    label: "Verifying",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    dot: "bg-amber-500 animate-pulse",
  },
  VERIFIED: {
    label: "Verified",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  ACTIVE: {
    label: "Active",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  FAILED: {
    label: "Failed",
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  DISABLED: {
    label: "Disabled",
    className:
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
    dot: "bg-slate-400",
  },
}

// ─── Component ───────────────────────────────────────────────────────────

export function DomainManager({
  orgId,
  orgSlug,
  hideHeader = false,
  onViewPlans,
}: DomainManagerProps) {
  const queryClient = useQueryClient()

  // ─── Domains list ─────────────────────────────────────────────────────
  const domainsQuery = useQuery<{ domains: DomainDto[] }>({
    queryKey: ["organizations", orgId, "domains"],
    queryFn: () =>
      api<{ domains: DomainDto[] }>(`/api/organizations/${orgId}/domains`),
    retry: 1,
    staleTime: 30_000,
  })

  // ─── Billing summary (just for hasFeature check) ──────────────────────
  const billingQuery = useQuery<BillingSummary>({
    queryKey: ["organizations", orgId, "billing"],
    queryFn: () => api<BillingSummary>(`/api/organizations/${orgId}/billing`),
    retry: 1,
    staleTime: 30_000,
  })

  const hasCustomDomainFeature =
    billingQuery.data?.entitlements.features.custom_domain === true

  const domains = domainsQuery.data?.domains ?? []
  const subdomain = domains.find((d) => d.type === "SUBDOMAIN")
  const customDomains = domains.filter((d) => d.type === "CUSTOM_DOMAIN")

  const subdomainHost = subdomain?.domain ?? `${orgSlug ?? "your-org"}.engagio.app`

  // ─── Add domain dialog ────────────────────────────────────────────────
  const [addOpen, setAddOpen] = React.useState(false)
  const [newDomain, setNewDomain] = React.useState("")
  const [dnsDialog, setDnsDialog] = React.useState<{
    open: boolean
    domain?: DomainDto
    token?: string
    dns?: DnsInstructions
  }>({ open: false })

  const addMutation = useMutation({
    mutationFn: () =>
      api<AddDomainResponse>(`/api/organizations/${orgId}/domains`, {
        method: "POST",
        body: JSON.stringify({ domain: newDomain.trim() }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "domains"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "audit-log"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "billing"] })
      toast.success("Domain added", {
        description: "Add the DNS records below to verify ownership.",
      })
      setAddOpen(false)
      setNewDomain("")
      setDnsDialog({
        open: true,
        domain: data.domain,
        token: data.verificationToken,
        dns: data.dnsInstructions,
      })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to add domain"
      toast.error("Could not add domain", { description: msg })
    },
  })

  // ─── Verify domain ────────────────────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: (domainId: string) =>
      api<VerifyDomainResponse>(
        `/api/organizations/${orgId}/domains/${domainId}/verify`,
        { method: "POST", body: JSON.stringify({}) }
      ),
    onSuccess: (data, _domainId) => {
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "domains"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "audit-log"] })
      if (data.verified) {
        toast.success("Domain verified!", {
          description: data.message || "Your custom domain is now active.",
        })
        setDnsDialog({ open: false })
      } else {
        toast.error("Verification failed", { description: data.message })
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to verify domain"
      toast.error("Could not verify domain", { description: msg })
    },
  })

  // ─── Remove domain ────────────────────────────────────────────────────
  const [removeTarget, setRemoveTarget] = React.useState<DomainDto | null>(null)

  const removeMutation = useMutation({
    mutationFn: (domainId: string) =>
      api<{ success: boolean }>(
        `/api/organizations/${orgId}/domains/${domainId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "domains"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "audit-log"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "billing"] })
      toast.success("Domain removed", {
        description: "The domain has been disabled.",
      })
      setRemoveTarget(null)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to remove domain"
      toast.error("Could not remove domain", { description: msg })
    },
  })

  const copyToClipboard = (text: string, label: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Copy failed — please copy manually")
    )
  }

  // ─── Loading skeleton ─────────────────────────────────────────────────
  if (domainsQuery.isLoading) {
    return (
      <div className="space-y-4">
        {!hideHeader && <DomainManagerHeader />}
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {!hideHeader && <DomainManagerHeader />}

      {/* ─── Subdomain section (read-only) ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="size-4 text-emerald-600 dark:text-emerald-400" />
            Your subdomain
          </CardTitle>
          <CardDescription>
            Every organization gets a free <code>{`{slug}.engagio.app`}</code>{" "}
            subdomain. This is always available, even on the Free plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <code className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                {subdomainHost}
              </code>
              {subdomain?.status === "ACTIVE" && (
                <Badge
                  className={cn(
                    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  )}
                >
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Active
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(subdomainHost, "Subdomain URL")}
              className="shrink-0"
            >
              <Copy className="size-3.5" />
              Copy URL
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Custom domain section ──────────────────────────────────────── */}
      {hasCustomDomainFeature ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Custom domains
                </CardTitle>
                <CardDescription>
                  Host your event pages on your own domain (e.g.{" "}
                  <code>events.yourcompany.com</code>). DNS verification required.
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setAddOpen(true)}
                className="shrink-0"
              >
                <Plus className="size-3.5" />
                Add Custom Domain
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {customDomains.length === 0 ? (
              <EmptyState
                icon={Globe}
                title="No custom domains yet"
                description="Add a custom domain to host your events on your own brand URL."
                actionLabel="Add Custom Domain"
                onAction={() => setAddOpen(true)}
              />
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                <AnimatePresence initial={false}>
                  {customDomains.map((domain) => {
                    const status = STATUS_BADGE[domain.status]
                    const canVerify =
                      domain.status === "PENDING" ||
                      domain.status === "FAILED" ||
                      domain.status === "VERIFYING"
                    return (
                      <motion.li
                        key={domain.id}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <Globe className="size-4" />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">
                                {domain.domain}
                              </span>
                              <Badge className={status.className}>
                                <span className={cn("size-1.5 rounded-full", status.dot)} />
                                {status.label}
                              </Badge>
                              {domain.isPrimary && (
                                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  Primary
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {domain.verifiedAt
                                ? `Verified on ${new Date(domain.verifiedAt).toLocaleDateString()}`
                                : "Awaiting DNS verification"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pl-12 sm:pl-0">
                          {canVerify && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={verifyMutation.isPending}
                              onClick={() => {
                                verifyMutation.mutate(domain.id)
                              }}
                            >
                              {verifyMutation.isPending &&
                              verifyMutation.variables === domain.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="size-3.5" />
                              )}
                              Verify
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                            onClick={() => setRemoveTarget(domain)}
                          >
                            <Trash2 className="size-3.5" />
                            Remove
                          </Button>
                        </div>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
                <Lock className="size-5" />
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Custom domains are available on paid plans
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Upgrade to STARTER or higher to host your events on your own
                  domain.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="default"
              className="shrink-0"
              onClick={() => onViewPlans?.()}
            >
              View Plans
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Add domain dialog ──────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a custom domain</DialogTitle>
            <DialogDescription>
              Enter the domain you want to host your Engagio pages on. You&apos;ll
              need to add DNS records in your provider&apos;s dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="domain-input">Domain</Label>
            <Input
              id="domain-input"
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="events.yourcompany.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !addMutation.isPending && newDomain.trim()) {
                  e.preventDefault()
                  addMutation.mutate()
                }
              }}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Use a subdomain like <code>events.example.com</code> for easiest
              setup. The root domain requires A-record configuration.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={addMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !newDomain.trim()}
            >
              {addMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Add domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DNS instructions dialog ─────────────────────────────────────── */}
      <Dialog
        open={dnsDialog.open}
        onOpenChange={(open) =>
          setDnsDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure your DNS</DialogTitle>
            <DialogDescription>
              Add the following records in <code>{dnsDialog.domain?.domain}</code>
              &apos;s DNS provider. DNS propagation usually takes a few minutes,
              but can take up to 24 hours.
            </DialogDescription>
          </DialogHeader>

          {dnsDialog.dns && dnsDialog.token ? (
            <div className="space-y-4">
              {/* CNAME record */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    CNAME record
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() =>
                      copyToClipboard(
                        `${dnsDialog.dns!.name} → ${dnsDialog.dns!.value}`,
                        "CNAME record"
                      )
                    }
                  >
                    <Copy className="size-3" />
                    Copy
                  </Button>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Name:</span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {dnsDialog.dns.name}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">Target:</span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {dnsDialog.dns.value}
                  </span>
                </div>
              </div>

              {/* TXT record */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    TXT record (verification)
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() =>
                      copyToClipboard(
                        dnsDialog.token ?? "",
                        "Verification token"
                      )
                    }
                  >
                    <Copy className="size-3" />
                    Copy
                  </Button>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Name:</span>
                  <span className="text-slate-900 dark:text-slate-100">
                    _engagio-verify.{dnsDialog.dns.name}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">Value:</span>
                  <span className="break-all text-slate-900 dark:text-slate-100">
                    {dnsDialog.token}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>
                  DNS lookups from serverless environments can be unreliable
                  during propagation. If verification fails, wait a few minutes
                  and try again.
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDnsDialog({ open: false })}
            >
              I&apos;ll do this later
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (dnsDialog.domain) {
                  verifyMutation.mutate(dnsDialog.domain.id)
                }
              }}
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              I&apos;ve added the DNS records. Verify now.
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Remove domain confirmation ─────────────────────────────────── */}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove this domain?"
        description={
          removeTarget
            ? `This will disable "${removeTarget.domain}". Your subdomain will continue to work. Existing links on this custom domain will stop resolving.`
            : ""
        }
        confirmText="Remove domain"
        variant="destructive"
        loading={removeMutation.isPending}
        onConfirm={() => {
          if (removeTarget) removeMutation.mutate(removeTarget.id)
        }}
      />
    </div>
  )
}

// ─── Header ────────────────────────────────────────────────────────────────

function DomainManagerHeader() {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        <Globe className="size-5 text-emerald-600 dark:text-emerald-400" />
        Domains
      </h2>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        Manage your subdomain and add custom domains for white-labeled event pages.
      </p>
    </div>
  )
}

// Re-export for callers that want to embed the header externally.
export { DomainManagerHeader }
