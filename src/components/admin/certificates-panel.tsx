"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Award,
  CheckCircle2,
  Download,
  Eye,
  Inbox,
  Loader2,
  RotateCcw,
  Search,
  ShieldBan,
  Sparkles,
  XCircle,
} from "lucide-react";

import { api } from "./api";
import type { CertificateDto, EventDto, RegistrationDto } from "@/types";
import { ShareAchievementButton } from "@/components/achievements/share-achievement-button";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  CertificateRenderer,
  downloadCertificatePng,
} from "@/components/cert/certificate-renderer";
import { cn, initials } from "@/lib/utils";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
interface CertListResponse {
  certificates: CertificateDto[];
  total: number;
}

interface GenerateSingleResponse {
  certificate: CertificateDto;
}
interface GenerateBulkResponse {
  generated: number;
  certificates: CertificateDto[];
  errors: { userId: string; error: string }[];
}

const TEMPLATE_LABELS: Record<string, string> = {
  classic: "Classic",
  modern: "Modern",
  elegant: "Elegant",
  bold: "Bold",
  minimal: "Minimal",
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export function CertificatesPanel() {
  const qc = useQueryClient();

  // Filter state
  const [eventIdFilter, setEventIdFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  // Fetch events list for the filter dropdown + bulk-generate event picker.
  const eventsQuery = useQuery<EventDto[]>({
    queryKey: ["events"],
    queryFn: () => api<EventDto[]>("/api/events"),
  });
  const events = eventsQuery.data ?? [];

  // Fetch the certificates list (admin: ?all=true).
  const certsQuery = useQuery<CertListResponse>({
    queryKey: ["certificates", "admin", eventIdFilter],
    queryFn: () => {
      const qs = new URLSearchParams({ all: "true" });
      if (eventIdFilter && eventIdFilter !== "all") {
        qs.set("eventId", eventIdFilter);
      }
      return api<CertListResponse>(`/api/certificates?${qs.toString()}`);
    },
  });
  const certificates = certsQuery.data?.certificates ?? [];

  // --- View dialog state (certificate preview) ---
  const [viewingCert, setViewingCert] = React.useState<CertificateDto | null>(null);

  // --- Revoke / Reinstate mutation ---
  const revokeMutation = useMutation({
    mutationFn: async (args: { id: string; action: "revoke" | "reinstate" }) => {
      return api<{ success: boolean; certificate: CertificateDto }>(
        `/api/certificates/${args.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ action: args.action }),
        },
      );
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["certificates"] });
      qc.invalidateQueries({ queryKey: ["my-certificates"] });
      toast.success(
        vars.action === "revoke"
          ? "Certificate revoked"
          : "Certificate reinstated",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Filter UI helpers ---
  const filteredCerts = React.useMemo(() => {
    return certificates.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          c.recipientName.toLowerCase().includes(q) ||
          c.certificateNumber.toLowerCase().includes(q) ||
          (c.user?.email ?? "").toLowerCase().includes(q) ||
          (c.event?.title ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [certificates, statusFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Certificates
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Generate, view, download, revoke, and reinstate participant certificates.
          </p>
        </div>
        <Badge
          variant="outline"
          className="self-start border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 sm:self-auto"
        >
          <Award className="size-3" />
          {certificates.length} issued
        </Badge>
      </div>

      {/* Bulk-generate */}
      <BulkGenerateSection events={events} />

      {/* Filters + certificates table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Issued Certificates</CardTitle>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Label htmlFor="cert-search" className="sr-only">
                Search certificates
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="cert-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, cert no., or event…"
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={eventIdFilter} onValueChange={setEventIdFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {truncateSafe(e.title, 28)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="VALID">Valid</SelectItem>
                <SelectItem value="REVOKED">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {certsQuery.isLoading ? (
            <div className="space-y-2 px-6 sm:px-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : certsQuery.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              Failed to load certificates:{" "}
              {certsQuery.error instanceof Error
                ? certsQuery.error.message
                : "Unknown error"}
            </div>
          ) : filteredCerts.length === 0 ? (
            <EmptyState
              certificatesExist={certificates.length > 0}
              hasFilters={!!search || statusFilter !== "all" || eventIdFilter !== "all"}
            />
          ) : (
            <CertificatesTable
              certificates={filteredCerts}
              onView={(c) => setViewingCert(c)}
              onRevoke={(c) =>
                revokeMutation.mutate({ id: c.id, action: "revoke" })
              }
              onReinstate={(c) =>
                revokeMutation.mutate({ id: c.id, action: "reinstate" })
              }
              pendingActionId={
                revokeMutation.isPending ? revokeMutation.variables?.id : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      {/* View dialog */}
      <ViewCertificateDialog
        cert={viewingCert}
        open={!!viewingCert}
        onOpenChange={(o) => !o && setViewingCert(null)}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Bulk-generate section
// ----------------------------------------------------------------------------
function BulkGenerateSection({ events }: { events: EventDto[] }) {
  const qc = useQueryClient();
  const [selectedEventId, setSelectedEventId] = React.useState<string>("");
  const [selectedUserIds, setSelectedUserIds] = React.useState<Set<string>>(
    new Set(),
  );

  // Fetch registrations for the selected event (participants list).
  const regsQuery = useQuery<RegistrationDto[]>({
    queryKey: ["event-registrations", selectedEventId],
    queryFn: () =>
      api<RegistrationDto[]>(`/api/events/${selectedEventId}/registrations`),
    enabled: !!selectedEventId,
  });

  // Fetch existing certs for the selected event (so we can hide already-cert'd users).
  const existingCertsQuery = useQuery<CertListResponse>({
    queryKey: ["certificates", "admin", selectedEventId, "for-eligibility"],
    queryFn: () =>
      api<CertListResponse>(
        `/api/certificates?all=true&eventId=${encodeURIComponent(selectedEventId)}`,
      ),
    enabled: !!selectedEventId,
  });

  // Reset selection when event changes.
  React.useEffect(() => {
    setSelectedUserIds(new Set());
  }, [selectedEventId]);

  const existingCertUserIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of existingCertsQuery.data?.certificates ?? []) {
      set.add(c.userId);
    }
    return set;
  }, [existingCertsQuery.data]);

  const participants = React.useMemo(() => {
    return (regsQuery.data ?? []).filter(
      (r) => !existingCertUserIds.has(r.userId),
    );
  }, [regsQuery.data, existingCertUserIds]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const generateMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return api<GenerateBulkResponse>("/api/certificates/generate", {
        method: "POST",
        body: JSON.stringify({ userIds, eventId: selectedEventId }),
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["certificates"] });
      qc.invalidateQueries({ queryKey: ["my-certificates"] });
      qc.invalidateQueries({
        queryKey: ["certificates", "admin", selectedEventId, "for-eligibility"],
      });
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success(
        `Generated ${data.generated} certificate${
          data.generated === 1 ? "" : "s"
        }`,
      );
      if (data.errors.length > 0) {
        toast.warning(`${data.errors.length} participant(s) were not eligible`);
      }
      setSelectedUserIds(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedUserIds.size === participants.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(participants.map((p) => p.userId)));
    }
  };

  return (
    <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Sparkles className="size-4" />
          </span>
          <div>
            <CardTitle className="text-base">Generate Certificates</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Pick an event, then select participants to issue certificates.
              Ineligible participants are filtered out automatically.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="bulk-event">Event</Label>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger id="bulk-event">
                <SelectValue placeholder="Select an event…" />
              </SelectTrigger>
              <SelectContent>
                {events.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No events available
                  </SelectItem>
                ) : (
                  events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {truncateSafe(e.title, 40)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {selectedEvent && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                className="border-emerald-300 bg-white text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                Template: {TEMPLATE_LABELS[selectedEvent.certTemplate] ?? selectedEvent.certTemplate}
              </Badge>
              <Badge
                variant="outline"
                className="border-emerald-300 bg-white text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                Condition: {selectedEvent.certIssueCondition}
              </Badge>
              {!selectedEvent.certEnabled && (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  Cert disabled
                </Badge>
              )}
            </div>
          )}
        </div>

        {!selectedEventId ? (
          <div className="mt-4 rounded-lg border border-dashed border-emerald-300/60 bg-white/50 p-6 text-center text-sm text-muted-foreground dark:border-emerald-800/60 dark:bg-slate-900/40">
            Select an event above to see eligible participants.
          </div>
        ) : regsQuery.isLoading || existingCertsQuery.isLoading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : participants.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-emerald-300/60 bg-white/50 p-6 text-center text-sm text-muted-foreground dark:border-emerald-800/60 dark:bg-slate-900/40">
            <CheckCircle2 className="mx-auto mb-2 size-6 text-emerald-500" />
            No new participants to issue certificates to. Either there are no
            registrations yet, or everyone who is eligible already has a
            certificate.
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={
                    participants.length > 0 &&
                    selectedUserIds.size === participants.length
                  }
                  onCheckedChange={toggleAll}
                  aria-label="Select all participants"
                />
                <span className="text-muted-foreground">
                  Select all ({participants.length})
                </span>
              </label>
              <span className="text-xs text-muted-foreground">
                {selectedUserIds.size} selected
              </span>
            </div>
            <Separator className="my-3" />
            <div className="max-h-72 overflow-y-auto rounded-lg border bg-white dark:bg-slate-900">
              {participants.map((r) => (
                <label
                  key={r.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-muted/30",
                    selectedUserIds.has(r.userId) &&
                      "bg-emerald-50/60 dark:bg-emerald-950/30",
                  )}
                >
                  <Checkbox
                    checked={selectedUserIds.has(r.userId)}
                    onCheckedChange={() => toggleUser(r.userId)}
                    aria-label={`Select ${r.user?.name || r.user?.email}`}
                  />
                  <Avatar className="size-7">
                    {r.user?.image ? (
                      <AvatarImage src={r.user.image} alt={r.user?.name ?? ""} />
                    ) : null}
                    <AvatarFallback className="bg-emerald-50 text-xs text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {initials(r.user?.name) || r.user?.email?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {r.user?.name || "Unnamed participant"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.user?.email}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Issuing uses the event&apos;s configured condition ({" "}
                {selectedEvent?.certIssueCondition} ). Ineligible users will be
                skipped with an error message.
              </p>
              <Button
                type="button"
                disabled={
                  selectedUserIds.size === 0 ||
                  generateMutation.isPending ||
                  !selectedEvent
                }
                onClick={() =>
                  generateMutation.mutate(Array.from(selectedUserIds))
                }
                className="bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Award className="size-4" />
                )}
                Generate {selectedUserIds.size > 0 ? `(${selectedUserIds.size})` : ""}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Certificates table
// ----------------------------------------------------------------------------
function CertificatesTable({
  certificates,
  onView,
  onRevoke,
  onReinstate,
  pendingActionId,
}: {
  certificates: CertificateDto[];
  onView: (c: CertificateDto) => void;
  onRevoke: (c: CertificateDto) => void;
  onReinstate: (c: CertificateDto) => void;
  pendingActionId?: string;
}) {
  const [confirmRevoke, setConfirmRevoke] = React.useState<CertificateDto | null>(null);
  return (
    <>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Cert No.</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Event</TableHead>
              <TableHead className="w-[100px]">Template</TableHead>
              <TableHead className="w-[140px]">Issued</TableHead>
              <TableHead className="w-[90px]">Status</TableHead>
              <TableHead className="w-[230px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certificates.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">
                  {c.certificateNumber}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-emerald-50 text-xs text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {initials(c.recipientName) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.recipientName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.user?.email ?? "—"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <span className="line-clamp-2 text-sm text-foreground">
                    {c.event?.title ?? "Untitled event"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {TEMPLATE_LABELS[c.template] ?? c.template}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(c.issuedAt), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onView(c)}
                      aria-label="View certificate"
                    >
                      <Eye className="size-4" />
                    </Button>
                    <DownloadButton cert={c} />
                    {c.status === "VALID" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                        onClick={() => setConfirmRevoke(c)}
                        disabled={pendingActionId === c.id}
                        aria-label="Revoke certificate"
                      >
                        <ShieldBan className="size-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30"
                        onClick={() => onReinstate(c)}
                        disabled={pendingActionId === c.id}
                        aria-label="Reinstate certificate"
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-border px-4 sm:hidden sm:px-0">
        {certificates.map((c) => (
          <div key={c.id} className="py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {c.certificateNumber}
                </p>
                <p className="truncate font-medium text-foreground">
                  {c.recipientName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.user?.email ?? "—"}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-foreground/80">
                  {c.event?.title ?? "Untitled event"}
                </p>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => onView(c)}>
                <Eye className="size-4" /> View
              </Button>
              <DownloadButton cert={c} variant="outline" />
              {c.status === "VALID" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
                  onClick={() => setConfirmRevoke(c)}
                  disabled={pendingActionId === c.id}
                >
                  <ShieldBan className="size-4" /> Revoke
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                  onClick={() => onReinstate(c)}
                  disabled={pendingActionId === c.id}
                >
                  <RotateCcw className="size-4" /> Reinstate
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confirm revoke dialog */}
      <AlertDialog
        open={!!confirmRevoke}
        onOpenChange={(o) => !o && setConfirmRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke certificate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark{" "}
              <span className="font-medium text-foreground">
                {confirmRevoke?.recipientName}
              </span>
              &apos;s certificate ({confirmRevoke?.certificateNumber}) as
              REVOKED. The public verification page will show it as invalid.
              You can reinstate it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (confirmRevoke) onRevoke(confirmRevoke);
                setConfirmRevoke(null);
              }}
            >
              <ShieldBan className="size-4" /> Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DownloadButton({
  cert,
  variant = "ghost",
}: {
  cert: CertificateDto;
  variant?: "ghost" | "outline";
}) {
  // The CertificateRenderer uses an onRendered callback to expose the PNG.
  // We mount a hidden renderer and trigger a download when the data URL arrives.
  const [renderedDataUrl, setRenderedDataUrl] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Whenever the cert changes, invalidate the cached data URL.
  React.useEffect(() => {
    setRenderedDataUrl(null);
  }, [cert.id]);

  const handleDownload = () => {
    if (renderedDataUrl) {
      downloadCertificatePng(renderedDataUrl, cert.certificateNumber);
      return;
    }
    setPending(true);
    // Force re-render by toggling a key — the renderer will call onRendered.
    setRenderTrigger((n) => n + 1);
  };

  const [renderTrigger, setRenderTrigger] = React.useState(0);
  const handleRendered = React.useCallback((dataUrl: string) => {
    setRenderedDataUrl(dataUrl);
    setPending((p) => {
      if (p) {
        downloadCertificatePng(dataUrl, cert.certificateNumber);
      }
      return false;
    });
  }, [cert.certificateNumber]);

  return (
    <>
      <Button
        size="sm"
        variant={variant}
        onClick={handleDownload}
        disabled={pending}
        aria-label="Download PNG"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        <span className="sr-only">Download PNG</span>
      </Button>
      {/* Hidden certificate renderer — only mounted when needed. */}
      {pending && (
        <div aria-hidden className="absolute -left-[9999px] top-0 size-0 overflow-hidden">
          <CertificateRenderer
            key={`${cert.id}-${renderTrigger}`}
            template={cert.template}
            recipientName={cert.recipientName}
            eventName={cert.event?.title ?? "Untitled event"}
            orgName={cert.event?.certOrgName ?? null}
            signeeName={cert.event?.certSigneeName ?? null}
            signeeTitle={cert.event?.certSigneeTitle ?? null}
            signeeImage={cert.event?.certSigneeImage ?? null}
            logo={cert.event?.certLogo ?? null}
            certificateNumber={cert.certificateNumber}
            issuedAt={cert.issuedAt}
            verificationUrl={
              typeof window !== "undefined"
                ? `${window.location.origin}/?verify=${cert.verificationToken}`
                : `/?verify=${cert.verificationToken}`
            }
            onRendered={handleRendered}
            className="h-0 w-0"
          />
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------
// View certificate dialog
// ----------------------------------------------------------------------------
function ViewCertificateDialog({
  cert,
  open,
  onOpenChange,
}: {
  cert: CertificateDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [renderedDataUrl, setRenderedDataUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!open) setRenderedDataUrl(null);
  }, [open]);

  if (!cert) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="size-5 text-emerald-600" />
            Certificate Preview
          </DialogTitle>
          <DialogDescription>
            {cert.certificateNumber} · {TEMPLATE_LABELS[cert.template] ?? cert.template} template
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto rounded-lg bg-slate-100 p-2 dark:bg-slate-900">
          <CertificateRenderer
            template={cert.template}
            recipientName={cert.recipientName}
            eventName={cert.event?.title ?? "Untitled event"}
            orgName={cert.event?.certOrgName ?? null}
            signeeName={cert.event?.certSigneeName ?? null}
            signeeTitle={cert.event?.certSigneeTitle ?? null}
            signeeImage={cert.event?.certSigneeImage ?? null}
            logo={cert.event?.certLogo ?? null}
            certificateNumber={cert.certificateNumber}
            issuedAt={cert.issuedAt}
            verificationUrl={
              typeof window !== "undefined"
                ? `${window.location.origin}/?verify=${cert.verificationToken}`
                : `/?verify=${cert.verificationToken}`
            }
            onRendered={setRenderedDataUrl}
          />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-2">
          <Button
            variant="outline"
            onClick={() => window.open(`/?verify=${cert.verificationToken}`, "_blank")}
          >
            <Eye className="size-4" /> Public verify page
          </Button>
          <Button
            disabled={!renderedDataUrl}
            onClick={() =>
              renderedDataUrl &&
              downloadCertificatePng(renderedDataUrl, cert.certificateNumber)
            }
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Download className="size-4" /> Download PNG
          </Button>
          {cert.status === "VALID" && (
            <ShareAchievementButton
              achievementInput={{
                type: "CERTIFICATE_EARNED",
                eventId: cert.eventId,
                title: cert.event?.title
                  ? `${cert.event.title} · Certificate`
                  : "Certificate Earned",
                subtitle: cert.event?.title ?? undefined,
                achievementData: {
                  eventTitle: cert.event?.title,
                  certificateNumber: cert.certificateNumber,
                  certificateVerifyUrl:
                    typeof window !== "undefined"
                      ? `${window.location.origin}/?verify=${cert.verificationToken}`
                      : `/?verify=${cert.verificationToken}`,
                },
                templateId: "professional",
                visibility: "PUBLIC",
              }}
              label="Share Certificate"
              size="sm"
            />
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// Helpers / subcomponents
// ----------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  if (status === "VALID") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        <CheckCircle2 className="size-3" /> Valid
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
    >
      <XCircle className="size-3" /> Revoked
    </Badge>
  );
}

function EmptyState({
  certificatesExist,
  hasFilters,
}: {
  certificatesExist: boolean;
  hasFilters: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Inbox className="size-6" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-foreground">
        {hasFilters
          ? "No certificates match your filters"
          : certificatesExist
            ? "All caught up"
            : "No certificates issued yet"}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasFilters
          ? "Try clearing the search or status filter."
          : certificatesExist
            ? "There's nothing else to review right now."
            : "Generate certificates for eligible participants above."}
      </p>
    </div>
  );
}

function truncateSafe(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
