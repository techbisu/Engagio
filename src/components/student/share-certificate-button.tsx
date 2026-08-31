"use client"

import * as React from "react"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Award,
  Download,
  ExternalLink,
  Facebook,
  Link2,
  Linkedin,
  Loader2,
  MessageCircle,
  Twitter,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CertificateRenderer,
  downloadCertificatePng,
} from "@/components/cert/certificate-renderer"
import type { CertTemplate } from "@/types"
import { api } from "@/components/student/api"
import type { AttemptReviewPayload } from "@/components/student/api"

export interface ShareCertificateButtonProps {
  attemptId: string
  eventName?: string
  /** Button label (defaults to "Share") */
  label?: string
  size?: "sm" | "default" | "lg" | "icon"
  variant?: "outline" | "default" | "ghost" | "secondary" | "destructive" | "link"
  className?: string
}

/**
 * Share Certificate button — used in the "My Recent Attempts" list.
 *
 * On click:
 *   1. Fetches the attempt review payload (to get cert + org info).
 *   2. If no cert exists but the event has certs enabled, calls the
 *      generate-cert endpoint to create it on demand.
 *   3. Opens a dialog with the certificate image (rendered on canvas) +
 *      Download PNG + social share buttons (LinkedIn, WhatsApp, Facebook,
 *      X, Copy Link, Verify).
 *
 * This replaces the old ShareAchievementButton which shared a score-based
 * achievement card. The new button shares a participation certificate
 * (no score) — matching the "everyone who submits gets a certificate"
 * flow when the event's cert condition is PARTICIPATION or COMPLETED or
 * PASSED with passThreshold=0.
 */
export function ShareCertificateButton({
  attemptId,
  eventName,
  label = "Share",
  size = "sm",
  variant = "outline",
  className,
}: ShareCertificateButtonProps) {
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [generatedCert, setGeneratedCert] = useState<{
    id: string
    certificateNumber: string
    verificationToken: string
    template: string
    recipientName: string
    issuedAt: string
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  // Fetch the attempt review payload (with cert + org info) when the dialog opens.
  const { data, isLoading } = useQuery<AttemptReviewPayload>({
    queryKey: ["attempt", attemptId, "share"],
    queryFn: () => api<AttemptReviewPayload>(`/api/attempts/${attemptId}`),
    enabled: open, // only fetch when dialog is open
  })

  // Reset state when the dialog closes.
  React.useEffect(() => {
    if (!open) {
      setGeneratedCert(null)
      setGenError(null)
      setIsGenerating(false)
    }
  }, [open])

  const cert = generatedCert ?? data?.certificate ?? null
  const orgName = data?.organization?.name ?? null
  const orgLogo = data?.organization?.logoUrl ?? null
  const resolvedEventName = eventName ?? data?.event?.title ?? "Assessment"

  // If no cert exists but the event has certs enabled, generate it on demand.
  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenError(null)
    try {
      const res = await api<{ certificate: typeof generatedCert | null; reason?: string }>(
        `/api/attempts/${attemptId}/generate-cert`,
        { method: "POST" }
      )
      if (res.certificate) {
        setGeneratedCert(res.certificate)
        toast.success("Certificate generated!")
        // Invalidate the attempt query so the dashboard re-fetches with the cert.
        qc.invalidateQueries({ queryKey: ["attempt", attemptId] })
      } else {
        setGenError(res.reason || "Certificate could not be generated.")
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Failed to generate certificate.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setOpen(true)
        }}
        aria-label="Share certificate"
      >
        <Award className="size-3.5" />
        {label && <span>{label}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="size-4 text-emerald-600" />
              Share Certificate
            </DialogTitle>
            <DialogDescription>
              {resolvedEventName}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-emerald-600" />
            </div>
          ) : cert ? (
            <CertificateShareContent
              cert={{
                ...cert,
                template: cert.template as CertTemplate,
              }}
              eventName={resolvedEventName}
              orgName={orgName}
              orgLogo={orgLogo}
            />
          ) : data?.event?.certEnabled ? (
            // Event has certs enabled but no cert yet — generate on demand.
            <div className="space-y-3 text-center">
              <Award className="mx-auto size-8 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Generate your certificate
              </p>
              <p className="text-xs text-muted-foreground">
                You&apos;ve completed the assessment. Generate your participation certificate and share it on social media.
              </p>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Award className="size-4" /> Generate Certificate
                  </>
                )}
              </Button>
              {genError && (
                <p className="text-xs text-amber-700 dark:text-amber-400">{genError}</p>
              )}
            </div>
          ) : (
            // Certs not enabled.
            <div className="text-center text-sm text-muted-foreground py-6">
              Certificates are not enabled for this event.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Certificate share content (image + download + share buttons) ──────────

function CertificateShareContent({
  cert,
  eventName,
  orgName,
  orgLogo,
}: {
  cert: {
    id: string
    certificateNumber: string
    verificationToken: string
    template: CertTemplate
    recipientName: string
    issuedAt: string
  }
  eventName: string
  orgName: string | null
  orgLogo: string | null
}) {
  const [certDataUrl, setCertDataUrl] = React.useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${cert.verificationToken}`
      : `/verify/${cert.verificationToken}`

  const shareText = `I successfully completed ${eventName}${orgName ? ` organized by ${orgName}` : ""} and earned a Participation Certificate! 🎓✨`

  const shareToSocial = (platform: string) => {
    const text = encodeURIComponent(shareText)
    const url = encodeURIComponent(verifyUrl)
    const links: Record<string, string> = {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`,
      x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    }
    window.open(links[platform], "_blank", "noopener,noreferrer")
  }

  const copyLink = () => {
    navigator.clipboard
      .writeText(`${shareText} ${verifyUrl}`)
      .then(() => toast.success("Copied to clipboard!"))
      .catch(() => toast.error("Failed to copy"))
  }

  const handleDownload = () => {
    if (!certDataUrl) {
      toast.error("Certificate is still rendering — please wait a moment.")
      return
    }
    setIsDownloading(true)
    try {
      downloadCertificatePng(certDataUrl, cert.certificateNumber)
      toast.success("Certificate downloaded.")
    } catch {
      toast.error("Failed to download certificate.")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Certificate image — rendered on canvas */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CertificateRenderer
          template={cert.template}
          recipientName={cert.recipientName}
          eventName={eventName}
          orgName={orgName ?? undefined}
          certificateNumber={cert.certificateNumber}
          issuedAt={cert.issuedAt}
          verificationUrl={verifyUrl}
          logo={orgLogo}
          onRendered={setCertDataUrl}
          className="w-full"
        />
      </div>

      {/* Download button */}
      <Button
        onClick={handleDownload}
        disabled={isDownloading || !certDataUrl}
        className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
      >
        <Download className="size-4" />
        {isDownloading ? "Preparing…" : "Download PNG"}
      </Button>

      {/* Social share buttons */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => shareToSocial("linkedin")}>
          <Linkedin className="size-4 text-[#0A66C2]" /> LinkedIn
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => shareToSocial("whatsapp")}>
          <MessageCircle className="size-4 text-[#25D366]" /> WhatsApp
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => shareToSocial("facebook")}>
          <Facebook className="size-4 text-[#1877F2]" /> Facebook
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => shareToSocial("x")}>
          <Twitter className="size-4 text-slate-600 dark:text-slate-300" /> X
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
          <Link2 className="size-4 text-emerald-600" /> Copy Link
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => window.open(verifyUrl, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="size-4 text-emerald-600" /> Verify
        </Button>
      </div>

      {/* Share text preview */}
      <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900">
        <span className="font-medium text-foreground">Share text:</span> {shareText}
      </div>
    </div>
  )
}
