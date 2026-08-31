"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  Facebook,
  Link2,
  Linkedin,
  Loader2,
  Lock,
  MessageCircle,
  Twitter,
  Unlink,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api, type PublicAchievementDto } from "./api"
import {
  CertificateRenderer,
  downloadCertificatePng,
} from "@/components/cert/certificate-renderer"
import type { CertTemplate } from "@/types"

export interface PublicSharePageProps {
  token: string
  onExit?: () => void
}

type FetchState =
  | { kind: "loading" }
  | { kind: "error"; status: number; message: string }
  | { kind: "private" }
  | { kind: "revoked" }
  | { kind: "ready"; data: PublicAchievementDto }

export function PublicSharePage({ token, onExit }: PublicSharePageProps) {
  const query = useQuery<PublicAchievementDto>({
    queryKey: ["share", "public", token],
    queryFn: () => api<PublicAchievementDto>(`/api/share/${token}`, {}),
    enabled: !!token,
    retry: false,
    staleTime: 60_000,
  })

  const state: FetchState = React.useMemo(() => {
    if (query.isLoading) return { kind: "loading" }
    if (query.isError) {
      const msg = query.error instanceof Error ? query.error.message : ""
      if (/private|403|forbidden/i.test(msg)) return { kind: "private" }
      if (/revok|no longer|404|not found/i.test(msg)) return { kind: "revoked" }
      return { kind: "error", status: 0, message: msg || "Couldn't load." }
    }
    const data = query.data
    if (!data) return { kind: "loading" }
    if (data.visibility === "PRIVATE") return { kind: "private" }
    return { kind: "ready", data }
  }, [query])

  React.useEffect(() => {
    if (state.kind === "ready") {
      const { data } = state
      document.title = `${data.participantName}'s Certificate · Engagio`
      setMetaProperty("og:title", `${data.participantName} earned a Participation Certificate`)
      setMetaProperty("og:description", `${data.participantName} completed ${data.achievementData?.eventTitle ?? data.title}.`)
    } else {
      document.title = "Shared Certificate · Engagio"
    }
  }, [state])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20">
      <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => onExit?.()}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Back</span>
            <span className="sm:hidden">Back</span>
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full">
          {state.kind === "loading" ? <LoadingState /> : null}
          {state.kind === "error" ? <ErrorState message={state.message} onExit={onExit} /> : null}
          {state.kind === "private" ? <PrivateState onExit={onExit} /> : null}
          {state.kind === "revoked" ? <RevokedState onExit={onExit} /> : null}
          {state.kind === "ready" ? <CertificateView data={state.data} onExit={onExit} /> : null}
        </div>
      </main>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <Loader2 className="size-10 animate-spin text-emerald-600" />
      <p className="text-sm text-muted-foreground">Loading certificate…</p>
    </div>
  )
}

function ErrorState({ message, onExit }: { message: string; onExit?: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border bg-white p-8 text-center shadow-sm dark:bg-slate-900">
      <Unlink className="size-8 text-rose-500" />
      <h1 className="text-lg font-semibold">Couldn&apos;t load this certificate</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button onClick={() => onExit?.()} variant="outline">Back</Button>
    </div>
  )
}

function PrivateState({ onExit }: { onExit?: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border bg-white p-8 text-center shadow-sm dark:bg-slate-900">
      <Lock className="size-8 text-slate-500" />
      <h1 className="text-lg font-semibold">This certificate is private</h1>
      <Button onClick={() => onExit?.()} variant="outline">Back</Button>
    </div>
  )
}

function RevokedState({ onExit }: { onExit?: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border bg-white p-8 text-center shadow-sm dark:bg-slate-900">
      <Unlink className="size-8 text-amber-500" />
      <h1 className="text-lg font-semibold">This link is no longer available</h1>
      <Button onClick={() => onExit?.()} variant="outline">Back</Button>
    </div>
  )
}

function CertificateView({ data, onExit }: { data: PublicAchievementDto; onExit?: () => void }) {
  const eventName = data.achievementData?.eventTitle ?? data.title ?? "the assessment"
  const orgName = data.achievementData?.orgName ?? data.subtitle ?? undefined
  const verifyUrl = data.achievementData?.verifyUrl ?? ""
  const certNumber = data.achievementData?.certificateNumber ?? ""
  const linkedCert = data.certificate ?? null

  const [certDataUrl, setCertDataUrl] = React.useState<string | null>(null)
  const [isDownloading, setIsDownloading] = React.useState(false)

  const shareText = `I successfully completed ${eventName}${orgName ? ` organized by ${orgName}` : ""} and earned a Participation Certificate! 🎓✨`

  const shareToSocial = (platform: string) => {
    const text = encodeURIComponent(shareText)
    const url = encodeURIComponent(verifyUrl || (typeof window !== "undefined" ? window.location.href : ""))
    const links: Record<string, string> = {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`,
      x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    }
    window.open(links[platform], "_blank", "noopener,noreferrer")
  }

  const copyLink = () => {
    const url = verifyUrl || (typeof window !== "undefined" ? window.location.href : "")
    navigator.clipboard.writeText(`${shareText} ${url}`).then(() => toast.success("Copied to clipboard!"))
  }

  const handleDownload = () => {
    if (!certDataUrl) {
      toast.error("Certificate is still rendering — please wait a moment.")
      return
    }
    setIsDownloading(true)
    try {
      downloadCertificatePng(certDataUrl, linkedCert?.certificateNumber ?? certNumber ?? "certificate")
      toast.success("Certificate downloaded.")
    } catch {
      toast.error("Failed to download certificate.")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Certificate header */}
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
          <CheckCircle2 className="size-7 text-emerald-600" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Participation Certificate</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{data.participantName}</span> successfully completed{" "}
          <span className="font-semibold text-foreground">{eventName}</span>
        </p>
      </div>

      {/* Certificate image — rendered on canvas when linked cert is available */}
      {linkedCert && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CertificateRenderer
            template={linkedCert.template as CertTemplate}
            recipientName={linkedCert.recipientName}
            eventName={linkedCert.eventName}
            orgName={linkedCert.orgName ?? undefined}
            certificateNumber={linkedCert.certificateNumber}
            issuedAt={linkedCert.issuedAt}
            verificationUrl={
              typeof window !== "undefined"
                ? `${window.location.origin}/verify/${linkedCert.verificationToken}`
                : `/verify/${linkedCert.verificationToken}`
            }
            logo={linkedCert.orgLogoUrl ?? null}
            onRendered={setCertDataUrl}
            className="w-full"
          />
        </div>
      )}

      {/* Certificate details — NO score */}
      <div className="mx-auto max-w-md space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        {(linkedCert?.certificateNumber ?? certNumber) && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Certificate #</span>
            <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
              {linkedCert?.certificateNumber ?? certNumber}
            </span>
          </div>
        )}
        {(linkedCert?.orgName ?? orgName) && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Organization</span>
            <span className="font-medium">{linkedCert?.orgName ?? orgName}</span>
          </div>
        )}
        {linkedCert && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">
              {format(new Date(linkedCert.issuedAt), "MMM d, yyyy")}
            </span>
          </div>
        )}
        {!linkedCert && data.createdAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">{format(new Date(data.createdAt), "MMM d, yyyy")}</span>
          </div>
        )}
      </div>

      {/* Download button — only when linked cert image is available */}
      {linkedCert && (
        <div className="mx-auto max-w-md">
          <Button
            onClick={handleDownload}
            disabled={isDownloading || !certDataUrl}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Download className="size-4" />
            {isDownloading ? "Preparing…" : "Download PNG"}
          </Button>
        </div>
      )}

      {/* Social share buttons */}
      <div className="mx-auto max-w-md space-y-3">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Share this certificate
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Button variant="outline" className="gap-2" onClick={() => shareToSocial("linkedin")}>
            <Linkedin className="size-4 text-[#0A66C2]" />
            <span className="text-sm">LinkedIn</span>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => shareToSocial("whatsapp")}>
            <MessageCircle className="size-4 text-[#25D366]" />
            <span className="text-sm">WhatsApp</span>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => shareToSocial("facebook")}>
            <Facebook className="size-4 text-[#1877F2]" />
            <span className="text-sm">Facebook</span>
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => shareToSocial("x")}>
            <Twitter className="size-4 text-slate-600 dark:text-slate-300" />
            <span className="text-sm">X</span>
          </Button>
          <Button variant="outline" className="gap-2" onClick={copyLink}>
            <Link2 className="size-4 text-emerald-600" />
            <span className="text-sm">Copy Link</span>
          </Button>
          {verifyUrl && (
            <Button variant="outline" className="gap-2" onClick={() => window.open(verifyUrl, "_blank", "noopener,noreferrer")}>
              <ExternalLink className="size-4 text-emerald-600" />
              <span className="text-sm">Verify</span>
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-md text-center">
        <Button onClick={() => onExit?.()} variant="outline" className="w-full">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </div>
    </div>
  )
}

// ---- Meta tag helpers ----
function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute("property", property)
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}
