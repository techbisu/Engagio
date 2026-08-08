"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  Building2,
  Hash,
  ShieldAlert,
  Fingerprint,
} from "lucide-react";
import { format } from "date-fns";

import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface VerifyResponse {
  verified: boolean;
  revoked?: boolean;
  certificate?: {
    certificateNumber: string;
    recipientName: string;
    template: string;
    issuedAt: string;
    status: string;
    eventName: string;
    orgName?: string | null;
  };
}

interface VerifyError {
  error?: string;
}

async function fetchVerification(token: string): Promise<VerifyResponse> {
  const res = await fetch(`/api/verify/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (res.status === 404) {
    const e: VerifyError = await res.json().catch(() => ({}));
    throw new Error(e.error || "Not found");
  }
  if (!res.ok) {
    const e: VerifyError = await res.json().catch(() => ({}));
    throw new Error(e.error || `Request failed: ${res.status}`);
  }
  return (await res.json()) as VerifyResponse;
}

export interface VerifyCertificateProps {
  token: string;
  /** Optional callback to exit the verify view (e.g. "Back to home"). */
  onExit?: () => void;
}

export function VerifyCertificate({ token, onExit }: VerifyCertificateProps) {
  const { data, isLoading, isError, error } = useQuery<VerifyResponse>({
    queryKey: ["verify", token],
    queryFn: () => fetchVerification(token),
    retry: false,
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Minimal public header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" />
            <span className="text-sm font-semibold text-slate-900">
              QuizMaster Pro
            </span>
            <span className="hidden text-xs uppercase tracking-wider text-emerald-600 sm:inline">
              · Certificate Verification
            </span>
          </div>
          {onExit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExit}
              className="text-slate-600 hover:text-slate-900"
            >
              Back to site
            </Button>
          )}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:py-20">
        <div className="w-full max-w-lg">
          {isLoading ? (
            <VerifyLoading />
          ) : isError ? (
            <VerifyNotFound error={error} />
          ) : data?.verified ? (
            <VerifiedCard data={data} />
          ) : data?.revoked ? (
            <RevokedCard data={data} />
          ) : (
            <VerifyNotFound />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p>
            © {new Date().getFullYear()} QuizMaster Pro. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
            Powered by QuizMaster Pro
          </p>
        </div>
      </footer>
    </div>
  );
}

// ----------------------------------------------------------------------------
function VerifyLoading() {
  return (
    <div className="mx-auto flex flex-col items-center text-center">
      <Skeleton className="size-20 rounded-full" />
      <Skeleton className="mt-6 h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-8 w-full space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

function VerifiedCard({ data }: { data: VerifyResponse }) {
  const cert = data.certificate;
  if (!cert) return <VerifyNotFound />;
  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 px-6 py-8 text-center dark:from-emerald-950/40 dark:to-teal-950/40">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-4 ring-emerald-100/60 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/10">
          <CheckCircle2 className="size-12" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300 sm:text-3xl">
          Certificate Verified
        </h1>
        <p className="mt-2 text-sm text-emerald-700/80 dark:text-emerald-200/80">
          This is a valid certificate issued by QuizMaster Pro.
        </p>
      </div>

      <div className="space-y-4 px-6 py-6">
        <DetailRow icon={User} label="Recipient" value={cert.recipientName} />
        <DetailRow icon={Fingerprint} label="Event" value={cert.eventName} />
        <DetailRow
          icon={Calendar}
          label="Issued on"
          value={format(new Date(cert.issuedAt), "MMMM d, yyyy")}
        />
        <DetailRow icon={Hash} label="Certificate No." value={cert.certificateNumber} />
        {cert.orgName && (
          <DetailRow
            icon={Building2}
            label="Organization"
            value={cert.orgName}
          />
        )}
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <ShieldAlert className="size-4 shrink-0" />
          <span>
            Verified on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
      </div>
    </div>
  );
}

function RevokedCard({ data }: { data: VerifyResponse }) {
  const cert = data.certificate;
  if (!cert) return <VerifyNotFound />;
  return (
    <div className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-rose-50 to-red-50 px-6 py-8 text-center dark:from-rose-950/40 dark:to-red-950/40">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-rose-100 text-rose-600 ring-4 ring-rose-100/60 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/10">
          <XCircle className="size-12" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-rose-700 dark:text-rose-300 sm:text-3xl">
          Certificate Revoked
        </h1>
        <p className="mt-2 text-sm text-rose-700/80 dark:text-rose-200/80">
          This certificate has been revoked and is no longer valid.
        </p>
      </div>

      <div className="space-y-4 px-6 py-6">
        <DetailRow icon={User} label="Recipient" value={cert.recipientName} />
        <DetailRow icon={Fingerprint} label="Event" value={cert.eventName} />
        <DetailRow
          icon={Calendar}
          label="Issued on"
          value={format(new Date(cert.issuedAt), "MMMM d, yyyy")}
        />
        <DetailRow icon={Hash} label="Certificate No." value={cert.certificateNumber} />
        {cert.orgName && (
          <DetailRow
            icon={Building2}
            label="Organization"
            value={cert.orgName}
          />
        )}
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <ShieldAlert className="size-4 shrink-0" />
          <span>
            Verification performed on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
      </div>
    </div>
  );
}

function VerifyNotFound({ error }: { error?: unknown }) {
  const message =
    error instanceof Error ? error.message : "The certificate you're looking for doesn't exist or the link is invalid.";
  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <ShieldAlert className="size-10" />
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Certificate Not Found
      </h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{message}</p>
      <p className="mt-2 text-xs text-slate-400">
        Double-check the verification link, or contact the issuing organization.
      </p>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0 dark:border-slate-800">
      <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Icon className="size-4 shrink-0 text-slate-400" />
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-slate-900 dark:text-slate-50">
        {value}
      </span>
    </div>
  );
}
