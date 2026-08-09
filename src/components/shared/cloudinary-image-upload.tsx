"use client"

/**
 * <CloudinaryImageUpload />
 *
 * Reusable drag-and-drop image uploader for the entire Engagio platform.
 * Used by:
 *   - Org settings (org logo upload, branding tab)
 *   - Events manager (event hero image)
 *   - Payment config (UPI QR code upload)
 *   - Questions manager (question image attachment)
 *   - Certificate config (signature / logo uploads)
 *   - Payment screenshots (participant side, via the same component)
 *   - Achievement card images
 *
 * Features:
 *   - Drag-and-drop OR click-to-browse
 *   - Client-side compression before upload (via @/lib/upload-client.uploadImage)
 *   - Real-time upload progress (XHR-based, not fetch — fetch can't report progress)
 *   - Image preview with Replace / Remove buttons
 *   - Aspect-ratio-aware preview crop (visual only; does not modify the file)
 *   - File type + size validation with inline error state (red border + message)
 *   - Toast notifications (sonner) for upload errors
 *   - Subtle framer-motion hover/focus transitions
 *   - Accessible: keyboard focus, aria-labels, sr-only text, role=button
 *
 * Props:
 *   - value:        Current image URL (or null/empty when none)
 *   - publicId:     Current Cloudinary publicId (so the parent can track for deletion)
 *   - onChange:     Callback with (url, publicId) — url="" + publicId=null on remove
 *   - folder:       Cloudinary folder (e.g. "organizations", "events/qr")
 *   - label:        Field label (e.g. "Organization Logo")
 *   - description:  Help text under the label
 *   - maxSize:     Max file size in bytes (default 5MB)
 *   - acceptedTypes:Allowed MIME types (default jpeg/png/webp/gif)
 *   - aspectRatio:  CSS aspect-ratio for preview (e.g. "1/1", "16/9")
 *   - className:    Extra className for the root wrapper
 *
 * Upload flow:
 *   1. User selects a file (drop OR click → hidden <input type=file>)
 *   2. Validate MIME + size — if invalid, show inline error and toast
 *   3. Compress client-side via uploadImage() (resize + JPEG re-encode)
 *   4. POST the compressed file to /api/upload with XHR for progress events
 *   5. On success: call onChange(url, publicId)
 *   6. On failure: toast + inline error
 */

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  ImagePlus,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// We import the type from upload-client but call /api/upload directly with
// XHR so we can report real-time progress (fetch can't do upload progress).
import type { UploadResponse } from "@/lib/upload-client"

export interface CloudinaryImageUploadProps {
  /** Current image URL (null/empty when none). */
  value?: string | null
  /** Current Cloudinary publicId (for delete-on-replace tracking). */
  publicId?: string | null
  /** Called with the new url + publicId after a successful upload (or "" / null on remove). */
  onChange: (url: string, publicId: string | null) => void
  /** Logical Cloudinary folder, e.g. "organizations", "events/qr", "questions". */
  folder?: string
  /** Field label, e.g. "Organization Logo". */
  label?: string
  /** Help text under the label. */
  description?: string
  /** Max file size in bytes (default 5MB). */
  maxSize?: number
  /** Allowed MIME types (default: jpeg/png/webp/gif). */
  acceptedTypes?: string[]
  /** CSS aspect-ratio for the preview, e.g. "1/1", "16/9", "4/3". */
  aspectRatio?: string
  /** Extra className on the root wrapper. */
  className?: string
  /** Disable interaction (read-only preview). */
  disabled?: boolean
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]

const ACCEPTED_LABEL: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/gif": "GIF",
  "image/svg+xml": "SVG",
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function CloudinaryImageUpload({
  value,
  publicId: _publicId,
  onChange,
  folder = "general",
  label,
  description,
  maxSize = DEFAULT_MAX_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED,
  aspectRatio,
  className,
  disabled = false,
}: CloudinaryImageUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [progress, setProgress] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // ------------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------------

  function validateFile(file: File): string | null {
    if (!acceptedTypes.includes(file.type)) {
      const allowed = acceptedTypes
        .map((t) => ACCEPTED_LABEL[t] || t)
        .join(", ")
      return `Unsupported file type. Allowed: ${allowed}.`
    }
    if (file.size > maxSize) {
      return `File too large (${formatBytes(file.size)}). Max ${formatBytes(maxSize)}.`
    }
    return null
  }

  // ------------------------------------------------------------------
  // Upload via XHR (so we get progress events — fetch can't do upload progress)
  // ------------------------------------------------------------------

  function uploadFile(
    file: File,
    onProgress: (pct: number) => void,
  ): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", folder)

      const xhr = new XMLHttpRequest()
      xhr.open("POST", "/api/upload")
      xhr.responseType = "json"

      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100)
          onProgress(pct)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = xhr.response as UploadResponse
          resolve(data)
        } else {
          let msg = `Upload failed (HTTP ${xhr.status})`
          try {
            const body =
              typeof xhr.response === "string"
                ? JSON.parse(xhr.response)
                : xhr.response
            if (body?.error) msg = body.error
          } catch {
            /* swallow */
          }
          reject(new Error(msg))
        }
      }

      xhr.onerror = () => reject(new Error("Network error during upload"))
      xhr.onabort = () => reject(new Error("Upload aborted"))
      xhr.send(formData)
    })
  }

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  async function handleFile(file: File) {
    setError(null)
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      toast.error(validationError)
      return
    }

    setProgress(0)
    try {
      // Compress client-side first via the helper (which uses canvas +
      // JPEG quality 0.85). This is the same compression that
      // uploadImage() in @/lib/upload-client applies before POSTing.
      // We re-implement the upload here with XHR to get progress events.
      const compressed = await compressClientSide(file)
      const result = await uploadFile(compressed, (pct) => setProgress(pct))
      onChange(result.url, result.publicId)
      toast.success("Image uploaded", {
        description: result.isLocal
          ? "Saved locally (Cloudinary not configured on this server)."
          : "Stored in Cloudinary.",
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed"
      setError(msg)
      toast.error("Upload failed", { description: msg })
    } finally {
      setProgress(null)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) void handleFile(f)
    // Reset so the same file can be re-selected later.
    e.target.value = ""
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled) return
    const f = e.dataTransfer.files?.[0]
    if (f) void handleFile(f)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleRemove() {
    setError(null)
    onChange("", null)
  }

  function openPicker() {
    if (disabled) return
    inputRef.current?.click()
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const hasImage = !!value
  const acceptedLabel = acceptedTypes
    .map((t) => ACCEPTED_LABEL[t] || t)
    .join(", ")

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes.join(",")}
        onChange={handleInputChange}
        className="sr-only"
        // aria-label is set on the visible trigger instead, but the input
        // is what the browser's file dialog is attached to — keep it
        // accessible to screen readers via sr-only.
        aria-label={`Upload image for ${label || "field"}`}
        disabled={disabled || progress !== null}
      />

      {/* Hidden text for screen readers — describes the current state */}
      <span className="sr-only" aria-live="polite">
        {progress !== null
          ? `Uploading, ${progress}% complete.`
          : hasImage
            ? "Image attached."
            : "No image attached."}
      </span>

      <AnimatePresence mode="wait" initial={false}>
        {hasImage ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "flex flex-wrap items-start gap-3 rounded-lg border bg-white p-3 dark:bg-slate-900",
              error
                ? "border-rose-300 dark:border-rose-500/40"
                : "border-slate-200 dark:border-slate-800",
            )}
          >
            {/* Preview thumbnail */}
            <div
              className={cn(
                "relative overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800",
                aspectRatio ? "w-32" : "size-24",
              )}
              style={
                aspectRatio ? { aspectRatio, width: "8rem" } : undefined
              }
            >
              <img
                src={value!}
                alt={label ? `${label} preview` : "Uploaded image preview"}
                className="size-full object-contain"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.visibility =
                    "hidden"
                }}
              />
            </div>

            {/* Meta + actions */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <CheckCircle2 className="size-3" />
                  Attached
                </span>
                {progress !== null && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Replacing… {progress}%
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={openPicker}
                  disabled={disabled || progress !== null}
                >
                  {progress !== null ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3" />
                  )}
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10 dark:text-rose-400"
                  onClick={handleRemove}
                  disabled={disabled || progress !== null}
                >
                  <Trash2 className="size-3" />
                  Remove
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.15 }}
          >
            <div
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={
                label
                  ? `Click to upload ${label} or drag and drop`
                  : "Click to upload or drag and drop"
              }
              aria-disabled={disabled || progress !== null}
              onClick={openPicker}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  openPicker()
                }
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                "group relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-0",
                error
                  ? "border-rose-400 bg-rose-50/50 dark:border-rose-500/50 dark:bg-rose-950/20"
                  : isDragging
                    ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/30"
                    : "border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-950/20",
                (disabled || progress !== null) &&
                  "cursor-not-allowed opacity-60 hover:border-slate-300 hover:bg-white dark:hover:border-slate-600 dark:hover:bg-slate-900",
              )}
            >
              {progress !== null ? (
                <>
                  <Loader2 className="size-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Uploading… {progress}%
                    </p>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1 h-1.5 w-3/4 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                </>
              ) : isDragging ? (
                <>
                  <UploadCloud className="size-6 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    Drop the file to upload
                  </p>
                </>
              ) : (
                <>
                  <motion.div
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ImagePlus className="size-6 text-slate-400 group-hover:text-emerald-600 dark:text-slate-500 dark:group-hover:text-emerald-400" />
                  </motion.div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {acceptedLabel} — up to {formatBytes(maxSize)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress bar for replace-on-existing (shown under the preview row) */}
      {hasImage && progress !== null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      )}

      {/* Inline error */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400"
        >
          <AlertCircle className="size-3 shrink-0" />
          {error}
        </motion.p>
      )}

      {description && !error && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Client-side compression (mirrors @/lib/upload-client.compressImage so we can
// run it before opening the XHR request — the XHR body has to be the final
// blob, so we compress first, then upload with progress).
// ---------------------------------------------------------------------------

async function compressClientSide(
  file: File,
  maxW = 1200,
  maxH = 900,
  quality = 0.85,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxW) {
          height = Math.round(height * (maxW / width))
          width = maxW
        }
        if (height > maxH) {
          width = Math.round(width * (maxH / height))
          height = maxH
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(file)
          return
        }
        // White background to avoid transparent PNGs turning black under JPEG.
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file)
              return
            }
            resolve(
              new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
                type: "image/jpeg",
                lastModified: Date.now(),
              }),
            )
          },
          "image/jpeg",
          quality,
        )
      }
      img.onerror = () => resolve(file)
      img.src = e.target?.result as string
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}
