"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Award,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  XCircle,
} from "lucide-react";

import { api } from "./api";
import type { CertificateDto } from "@/types";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  CertificateRenderer,
  downloadCertificatePng,
} from "@/components/cert/certificate-renderer";

interface MyCertsResponse {
  certificates: CertificateDto[];
  total: number;
}

const TEMPLATE_LABELS: Record<string, string> = {
  classic: "Classic",
  modern: "Modern",
  elegant: "Elegant",
  bold: "Bold",
  minimal: "Minimal",
};

const TEMPLATE_ACCENT: Record<string, string> = {
  classic: "from-emerald-500 to-teal-600",
  modern: "from-teal-500 to-emerald-600",
  elegant: "from-amber-500 to-yellow-600",
  bold: "from-slate-700 to-slate-900",
  minimal: "from-slate-300 to-slate-400",
};

export function MyCertificates() {
  const { data, isLoading, isError, error } = useQuery<MyCertsResponse>({
    queryKey: ["my-certificates"],
    queryFn: () => api<MyCertsResponse>("/api/certificates"),
  });

  const certificates = data?.certificates ?? [];

  // Single "view" dialog state
  const [viewing, setViewing] = React.useState<CertificateDto | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            My Certificates
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your earned certificates — view, download, and verify.
          </p>
        </div>
        {certificates.length > 0 && (
          <Badge
            variant="outline"
            className="self-start border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 sm:self-auto"
          >
            <Award className="size-3" />
            {certificates.length} earned
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              Failed to load certificates:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          </CardContent>
        </Card>
      ) : certificates.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {certificates.map((c) => (
            <CertificateCard
              key={c.id}
              cert={c}
              onView={() => setViewing(c)}
            />
          ))}
        </div>
      )}

      <ViewCertificateDialog
        cert={viewing}
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Certificate card
// ----------------------------------------------------------------------------
function CertificateCard({
  cert,
  onView,
}: {
  cert: CertificateDto;
  onView: () => void;
}) {
  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?verify=${cert.verificationToken}`
      : `/?verify=${cert.verificationToken}`;

  return (
    <Card className="overflow-hidden">
      {/* Template preview banner */}
      <div
        className={`relative h-24 bg-gradient-to-br ${
          TEMPLATE_ACCENT[cert.template] ?? TEMPLATE_ACCENT.modern
        }`}
      >
        <div className="absolute inset-0 flex items-center justify-between px-4">
          <div className="flex items-center gap-2 text-white">
            <Award className="size-5 drop-shadow-sm" />
            <span className="text-sm font-semibold uppercase tracking-wider drop-shadow-sm">
              {TEMPLATE_LABELS[cert.template] ?? cert.template}
            </span>
          </div>
          <StatusBadge status={cert.status} />
        </div>
        {/* Decorative pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 25%, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
      </div>

      <CardHeader className="pb-3">
        <CardTitle className="text-base line-clamp-2">
          {cert.event?.title ?? "Untitled event"}
        </CardTitle>
        <CardDescription className="flex items-center gap-1.5 text-xs">
          <Calendar className="size-3" />
          Issued {format(new Date(cert.issuedAt), "MMM d, yyyy")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="rounded-md bg-muted/40 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Certificate No.
          </p>
          <p className="font-mono text-xs text-foreground">
            {cert.certificateNumber}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={onView}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Eye className="size-4" /> View
          </Button>
          <DownloadButton cert={cert} verifyUrl={verifyUrl} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(verifyUrl, "_blank")}
          >
            Verify
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DownloadButton({
  cert,
  verifyUrl,
}: {
  cert: CertificateDto;
  verifyUrl: string;
}) {
  const [pending, setPending] = React.useState(false);
  const [renderTrigger, setRenderTrigger] = React.useState(0);
  const handleRendered = React.useCallback(
    (dataUrl: string) => {
      downloadCertificatePng(dataUrl, cert.certificateNumber);
      setPending(false);
    },
    [cert.certificateNumber],
  );

  const handleDownload = () => {
    setPending(true);
    setRenderTrigger((n) => n + 1);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleDownload}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        PNG
      </Button>
      {pending && (
        <div
          aria-hidden
          className="absolute -left-[9999px] top-0 size-0 overflow-hidden"
        >
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
            verificationUrl={verifyUrl}
            onRendered={handleRendered}
            className="h-0 w-0"
          />
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------
// View dialog
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

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?verify=${cert.verificationToken}`
      : `/?verify=${cert.verificationToken}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="size-5 text-emerald-600" />
            {cert.event?.title ?? "Certificate"}
          </DialogTitle>
          <DialogDescription>
            {cert.certificateNumber} · {TEMPLATE_LABELS[cert.template] ?? cert.template}
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
            verificationUrl={verifyUrl}
            onRendered={setRenderedDataUrl}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => window.open(verifyUrl, "_blank")}
          >
            <Eye className="size-4" /> Verify
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  if (status === "VALID") {
    return (
      <Badge
        variant="outline"
        className="border-white/40 bg-white/20 text-white backdrop-blur"
      >
        <CheckCircle2 className="size-3" /> Valid
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-white/40 bg-white/20 text-white backdrop-blur"
    >
      <XCircle className="size-3" /> Revoked
    </Badge>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Award className="size-7" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-foreground">
          No certificates yet
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          You haven&apos;t earned any certificates yet. Complete a quiz to earn
          your first certificate!
        </p>
      </CardContent>
    </Card>
  );
}
