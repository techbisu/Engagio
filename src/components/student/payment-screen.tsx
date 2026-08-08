"use client"

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  ImageUp,
  Loader2,
  ReceiptIndianRupee,
  Smartphone,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { fileToCompressedDataUrl, dataUrlSizeKb } from "@/lib/image-client"

import { api } from "./api"

// ----------------------------------------------------------------------------
// Types

interface PaymentSubmitResponse {
  registration: any
  paymentStatus: "PENDING_VERIFICATION" | "COMPLETED" | "REJECTED" | "NONE"
}

interface PaymentStatusResponse {
  registration: any
  paymentStatus: "PENDING_VERIFICATION" | "COMPLETED" | "REJECTED" | "NONE"
}

export interface PaymentScreenProps {
  eventId: string
  eventTitle: string
  paymentAmount: number // paise
  paymentCurrency: string
  paymentInstructions?: string | null
  upiId?: string | null
  upiLink?: string | null
  qrCodeUrl?: string | null
  requireTransactionRef: boolean
  requireScreenshot: boolean
  /** Called once the admin verifies the payment (COMPLETED). */
  onPaid: () => void
  /** Go back to the previous screen. */
  onBack: () => void
}

// ----------------------------------------------------------------------------
// Helpers

function formatAmount(paise: number, currency: string): string {
  const r = (paise ?? 0) / 100
  const amountStr = Number.isInteger(r) ? String(r) : r.toFixed(2)
  // Strip trailing .00 when integer.
  if (currency === "INR") return `₹${amountStr}`
  return `${amountStr} ${currency}`
}

// ----------------------------------------------------------------------------
// Component

type Phase = "form" | "pending" | "completed" | "rejected"

export function PaymentScreen({
  eventId,
  eventTitle,
  paymentAmount,
  paymentCurrency,
  paymentInstructions,
  upiId,
  upiLink,
  qrCodeUrl,
  requireTransactionRef,
  requireScreenshot,
  onPaid,
  onBack,
}: PaymentScreenProps) {
  const [transactionRef, setTransactionRef] = React.useState("")
  const [screenshot, setScreenshot] = React.useState<string | null>(null)
  const [ssBusy, setSsBusy] = React.useState(false)
  const [ssError, setSsError] = React.useState<string | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = React.useState<string | null>(null)

  const [phase, setPhase] = React.useState<Phase>("form")

  // ---- Submit mutation ----------------------------------------------------
  const submitMutation = useMutation({
    mutationFn: () =>
      api<PaymentSubmitResponse>("/api/registrations/payment", {
        method: "POST",
        body: JSON.stringify({
          eventId,
          transactionReference: transactionRef.trim() || undefined,
          screenshotUrl: screenshot || undefined,
        }),
      }),
    onSuccess: (data) => {
      setFormError(null)
      if (data.paymentStatus === "PENDING_VERIFICATION") {
        setPhase("pending")
      } else if (data.paymentStatus === "COMPLETED") {
        setPhase("completed")
        // Brief delay so the user sees the success card before onPaid().
        setTimeout(() => onPaid(), 1200)
      } else if (data.paymentStatus === "REJECTED") {
        setPhase("rejected")
        setRejectionReason(
          data.registration?.rejectionReason ||
            "Your payment was rejected. Please resubmit.",
        )
      } else {
        setPhase("pending")
      }
    },
    onError: (e: Error) => {
      setFormError(e.message || "Failed to submit payment proof.")
      toast.error(e.message || "Failed to submit payment proof.")
    },
  })

  // ---- Polling for verification result -----------------------------------
  React.useEffect(() => {
    if (phase !== "pending") return
    let active = true
    const poll = async () => {
      try {
        const data = await api<PaymentStatusResponse>(
          `/api/registrations/payment?eventId=${encodeURIComponent(eventId)}`,
        )
        if (!active) return
        if (data.paymentStatus === "COMPLETED") {
          setPhase("completed")
          toast.success("Payment verified!")
          setTimeout(() => onPaid(), 1200)
        } else if (data.paymentStatus === "REJECTED") {
          setPhase("rejected")
          setRejectionReason(
            data.registration?.rejectionReason ||
              "Your payment was rejected. Please resubmit.",
          )
          toast.error("Payment was rejected. Please resubmit.")
        }
        // PENDING_VERIFICATION → keep polling.
      } catch {
        // Silently retry on next interval.
      }
    }
    // First poll immediately, then every 5 seconds.
    poll()
    const id = setInterval(poll, 5000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [phase, eventId, onPaid])

  // ---- Handlers ----------------------------------------------------------
  const handleScreenshotUpload = async (file: File | null) => {
    if (!file) return
    setSsBusy(true)
    setSsError(null)
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 800, 0.8)
      setScreenshot(dataUrl)
    } catch {
      setSsError("Failed to process the image. Try a different file.")
    } finally {
      setSsBusy(false)
    }
  }

  const handleScreenshotRemove = () => {
    setScreenshot(null)
    setSsError(null)
  }

  const handleCopyUpi = async () => {
    if (!upiId) return
    try {
      await navigator.clipboard.writeText(upiId)
      toast.success("UPI ID copied to clipboard.")
    } catch {
      toast.error("Couldn't copy. Long-press the UPI ID to copy manually.")
    }
  }

  const handlePayWithUpi = () => {
    if (!upiLink) return
    // On mobile this opens the UPI app chooser; on desktop it usually no-ops.
    window.location.href = upiLink
  }

  const validate = (): string | null => {
    if (requireTransactionRef && !transactionRef.trim()) {
      return "Please enter the transaction / UTR reference."
    }
    if (requireScreenshot && !screenshot) {
      return "Please upload a payment screenshot."
    }
    return null
  }

  const handleSubmit = () => {
    const err = validate()
    if (err) {
      setFormError(err)
      return
    }
    setFormError(null)
    submitMutation.mutate()
  }

  const handleResubmit = () => {
    setPhase("form")
    setRejectionReason(null)
    // Keep previous entries so the student can fix only what's wrong,
    // but clear the screenshot (it's already been used in the rejected submission).
    setScreenshot(null)
  }

  const amountLabel = formatAmount(paymentAmount, paymentCurrency)
  const ssSizeKb = screenshot ? dataUrlSizeKb(screenshot) : 0

  // ---- Render: completed ------------------------------------------------
  if (phase === "completed") {
    return (
      <PaymentCardShell eventTitle={eventTitle} amountLabel={amountLabel}>
        <AnimatePresence mode="wait">
          <motion.div
            key="completed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col items-center py-8 text-center"
          >
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 className="size-9" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-emerald-900 dark:text-emerald-200">
              Payment verified!
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Your payment has been verified by the organizer. Taking you to
              the quiz…
            </p>
          </motion.div>
        </AnimatePresence>
      </PaymentCardShell>
    )
  }

  // ---- Render: pending --------------------------------------------------
  if (phase === "pending") {
    return (
      <PaymentCardShell eventTitle={eventTitle} amountLabel={amountLabel}>
        <AnimatePresence mode="wait">
          <motion.div
            key="pending"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col items-center py-6 text-center"
          >
            <div className="relative">
              <div className="flex size-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                <Clock className="size-9" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-amber-600 dark:text-amber-400" />
              </span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Payment submitted for verification
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              We&apos;re verifying your payment. This usually takes a few
              minutes. You&apos;ll be automatically moved to the quiz once
              approved.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex size-1.5 animate-pulse rounded-full bg-amber-500" />
              <span>Checking for updates every 5 seconds…</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </PaymentCardShell>
    )
  }

  // ---- Render: rejected ------------------------------------------------
  if (phase === "rejected") {
    return (
      <PaymentCardShell eventTitle={eventTitle} amountLabel={amountLabel}>
        <AnimatePresence mode="wait">
          <motion.div
            key="rejected"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4 py-2"
          >
            <div className="flex flex-col items-center text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                <XCircle className="size-9" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Payment was rejected
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                The organizer couldn&apos;t verify your payment. Please check
                the reason below and resubmit.
              </p>
            </div>
            {rejectionReason && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                <p className="font-medium">Reason:</p>
                <p className="mt-1">{rejectionReason}</p>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button
                onClick={handleResubmit}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Upload className="size-4" /> Resubmit Payment
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </PaymentCardShell>
    )
  }

  // ---- Render: form (default) -----------------------------------------
  return (
    <PaymentCardShell eventTitle={eventTitle} amountLabel={amountLabel}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="space-y-5"
      >
        {/* Instructions */}
        {paymentInstructions && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            {paymentInstructions}
          </div>
        )}

        {/* UPI ID row */}
        {upiId && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">UPI ID</Label>
            <div className="flex gap-2">
              <div className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                {upiId}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyUpi}
                className="shrink-0"
              >
                <Copy className="size-4" />
                <span className="hidden sm:inline">Copy</span>
              </Button>
            </div>
          </div>
        )}

        {/* QR + Pay button */}
        <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-center">
          {qrCodeUrl ? (
            <div className="flex justify-center sm:justify-start">
              <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                <img
                  src={qrCodeUrl}
                  alt={`UPI QR code for ${eventTitle}`}
                  className="size-40 rounded object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-muted-foreground dark:border-slate-700">
              No QR code uploaded
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Scan the QR with any UPI app, or use the button below to pay
              directly from this device.
            </p>
            {upiLink && (
              <Button
                type="button"
                onClick={handlePayWithUpi}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
              >
                <Smartphone className="size-4" />
                Pay using UPI
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">
              This will open your UPI app on mobile devices.
            </p>
          </div>
        </div>

        {/* Transaction ref */}
        {requireTransactionRef && (
          <div className="space-y-1.5">
            <Label htmlFor="tx-ref" className="text-sm font-medium">
              Transaction ID / UTR <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="tx-ref"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="e.g. 4025XXXX1234"
              autoComplete="off"
              maxLength={200}
            />
            <p className="text-[11px] text-muted-foreground">
              Find this in your UPI app after a successful payment.
            </p>
          </div>
        )}

        {/* Screenshot upload */}
        {requireScreenshot && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Payment Screenshot <span className="text-rose-500">*</span>
            </Label>
            {screenshot ? (
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <img
                  src={screenshot}
                  alt="Payment screenshot preview"
                  className="h-20 w-32 rounded border border-slate-200 object-cover dark:border-slate-700"
                />
                <div className="flex-1 space-y-2">
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    {ssSizeKb} KB
                  </Badge>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        document.getElementById("ss-upload-input")?.click()
                      }
                    >
                      <Upload className="size-3.5" />
                      Replace
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleScreenshotRemove}
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  document.getElementById("ss-upload-input")?.click()
                }
                disabled={ssBusy}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed",
                  "border-slate-300 bg-white p-6 text-center transition-colors",
                  "hover:border-emerald-400 hover:bg-emerald-50/50",
                  "dark:border-slate-600 dark:bg-slate-900 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-950/20",
                  ssBusy && "opacity-60",
                )}
              >
                {ssBusy ? (
                  <Loader2 className="size-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ImageUp className="size-5 text-slate-400" />
                )}
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {ssBusy ? "Processing…" : "Upload payment screenshot"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  PNG / JPG — auto-compressed to 800×600.
                </span>
              </button>
            )}
            <input
              id="ss-upload-input"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                handleScreenshotUpload(f)
                e.target.value = ""
              }}
            />
            {ssError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{ssError}</p>
            )}
          </div>
        )}

        {/* Error message */}
        {formError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            {formError}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onBack} className="sm:order-1">
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitMutation.isPending || ssBusy}
            className="bg-emerald-600 text-white hover:bg-emerald-700 sm:order-2"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Submitting…
              </>
            ) : (
              <>
                <ReceiptIndianRupee className="size-4" /> Submit Payment
              </>
            )}
          </Button>
        </div>

        {/* Small-print reminder */}
        <p className="text-[11px] text-muted-foreground">
          Your screenshot is submitted for manual verification — the organizer
          will approve it before your registration is marked complete.
        </p>
      </motion.div>
    </PaymentCardShell>
  )
}

// ----------------------------------------------------------------------------
// Shell

function PaymentCardShell({
  eventTitle,
  amountLabel,
  children,
}: {
  eventTitle: string
  amountLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardDescription className="text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Registration Fee
              </CardDescription>
              <CardTitle className="truncate text-xl">{eventTitle}</CardTitle>
            </div>
            <div className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-right shadow-sm dark:bg-slate-900">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Amount
              </p>
              <p className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {amountLabel}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-6">{children}</CardContent>
      </Card>
    </div>
  )
}
