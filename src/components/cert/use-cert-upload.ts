"use client"

import * as React from "react"
import { toast } from "sonner"
import { api } from "@/components/student/api"

/**
 * Hook to upload a certificate PNG to Cloudinary after the canvas renders it.
 *
 * The CertificateRenderer component calls `onRendered(dataUrl)` with a base64
 * PNG data URL. This hook wraps that callback to automatically upload the PNG
 * to the server (POST /api/certificates/[id]/upload-png), which uploads to
 * Cloudinary and stores the URL on the certificate record.
 *
 * The stored Cloudinary URL is then used as:
 *   - og:image in the /verify/[token] page metadata (social media preview)
 *   - the image URL for social sharing (LinkedIn, Facebook, X, WhatsApp)
 *
 * Usage:
 *   const { uploadCert, isUploading, certUrl } = useCertUpload(certId)
 *   <CertificateRenderer onRendered={(dataUrl) => { uploadCert(dataUrl); setCertDataUrl(dataUrl); }} />
 */
export function useCertUpload(certId: string | null | undefined) {
  const [isUploading, setIsUploading] = React.useState(false)
  const [certUrl, setCertUrl] = React.useState<string | null>(null)
  const [uploadError, setUploadError] = React.useState<string | null>(null)

  const uploadCert = React.useCallback(
    async (pngDataUrl: string) => {
      if (!certId || isUploading) return

      setIsUploading(true)
      setUploadError(null)
      try {
        const res = await api<{
          url: string
          uploaded: boolean
          cloudinaryConfigured: boolean
        }>(`/api/certificates/${certId}/upload-png`, {
          method: "POST",
          body: JSON.stringify({ pngDataUrl }),
        })
        if (res.uploaded) {
          setCertUrl(res.url)
          // Silent success — don't toast on every render, only on manual triggers
        } else if (!res.cloudinaryConfigured) {
          // Cloudinary not configured — the URL is a base64 data URL (works for
          // download but NOT for og:image). Don't show an error since the
          // admin may not have configured Cloudinary yet.
          console.log("[useCertUpload] Cloudinary not configured, stored base64")
        }
      } catch (e) {
        // Don't show a toast on auto-upload failure — it's a background task.
        // The cert image still renders on the page and can be downloaded.
        console.error("[useCertUpload] upload failed:", e)
        setUploadError(e instanceof Error ? e.message : "Upload failed")
      } finally {
        setIsUploading(false)
      }
    },
    [certId, isUploading]
  )

  return { uploadCert, isUploading, certUrl, uploadError }
}
