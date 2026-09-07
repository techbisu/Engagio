"use client"

import * as React from "react"
import { api } from "@/components/student/api"

/**
 * Hook to upload a certificate PNG to Cloudinary after the canvas renders it.
 *
 * FOT FIX: This hook now has an "already uploaded" guard — once a cert has
 * been uploaded successfully, it will NOT re-upload the same cert again.
 * This prevents the infinite re-upload loop that consumed 11+ GB of Vercel
 * Fast Origin Transfer bandwidth.
 *
 * The guard is a ref (uploadedRef) that persists across re-renders. Once
 * set to true, subsequent calls to uploadCert() are silently ignored.
 * The ref resets when the certId changes (different certificate).
 */
export function useCertUpload(certId: string | null | undefined) {
  const [isUploading, setIsUploading] = React.useState(false)
  const [certUrl, setCertUrl] = React.useState<string | null>(null)
  const [uploadError, setUploadError] = React.useState<string | null>(null)

  // ─── FOT FIX: Track whether we've already uploaded this cert ──────────
  // Once uploaded, don't re-upload — prevents infinite loop.
  const uploadedRef = React.useRef(false)
  const lastCertIdRef = React.useRef<string | null>(null)

  // Reset the guard when certId changes
  React.useEffect(() => {
    if (certId !== lastCertIdRef.current) {
      uploadedRef.current = false
      lastCertIdRef.current = certId ?? null
    }
  }, [certId])

  const uploadCert = React.useCallback(
    async (pngDataUrl: string) => {
      if (!certId || isUploading) return
      // FOT FIX: Don't re-upload if we've already uploaded this cert
      if (uploadedRef.current) return

      uploadedRef.current = true
      setIsUploading(true)
      setUploadError(null)
      try {
        await api<{ uploaded: boolean; cloudinaryConfigured: boolean }>(
          `/api/certificates/${certId}/upload-png`,
          {
            method: "POST",
            body: JSON.stringify({ pngDataUrl }),
          }
        )
        // FOT FIX: Don't store the response URL — it may be a multi-MB base64
        // string. We don't need it client-side (the canvas already has the image).
      } catch (e) {
        // Reset the guard on failure so the user can retry
        uploadedRef.current = false
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
