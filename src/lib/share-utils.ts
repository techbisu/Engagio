"use client"

import { toast } from "sonner"

/**
 * Web Share API helpers for sharing the certificate image + caption text
 * to social platforms.
 *
 * STRATEGY (in order of preference):
 * 1. navigator.share({ files, text, url }) — opens the OS share sheet with
 *    the cert image attached + caption text + URL. Best UX. Mobile only.
 * 2. navigator.share({ text, url }) — opens the OS share sheet WITHOUT the
 *    image but WITH the caption text + URL. The share URL has og:image so
 *    the platform's preview card shows the cert image. Mobile + some desktop.
 * 3. Platform-specific share URL (LinkedIn/WhatsApp/Facebook/X) — opens the
 *    platform's share intent with caption + URL. The URL's og:image shows
 *    the cert image in the preview card. Desktop fallback.
 * 4. Last resort: download the image + copy caption to clipboard.
 */

export interface ShareImageParams {
  /** The certificate PNG as a base64 data URL (from canvas.toDataURL). */
  imageDataUrl: string
  /** Filename for the downloaded image (e.g. "certificate-EVT-2026-A8F42K.png"). */
  fileName: string
  /** Caption text to include in the share (e.g. "I'm proud to share..."). */
  caption: string
  /** The URL to share (e.g. https://example.com/verify/TOKEN). */
  url: string
}

/**
 * Convert a base64 data URL to a File object (for the Web Share API).
 */
async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], fileName, { type: "image/png" })
}

/**
 * Trigger a browser download of the PNG.
 */
export function downloadImage(dataUrl: string, fileName: string): void {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Check whether the current browser supports navigator.share.
 */
function hasNavigatorShare(): boolean {
  return typeof navigator !== "undefined" && "share" in navigator
}

/**
 * Check whether the current browser supports navigator.share with files.
 */
function canShareFiles(): boolean {
  if (typeof navigator === "undefined") return false
  if (!("share" in navigator) || !("canShare" in navigator)) return false
  try {
    const dummy = new File(["test"], "test.png", { type: "image/png" })
    return navigator.canShare({ files: [dummy] })
  } catch {
    return false
  }
}

/**
 * Open a platform-specific share URL in a new window.
 */
export function openShareUrl(
  platform: string,
  caption: string,
  url: string
): void {
  const text = encodeURIComponent(caption)
  const encodedUrl = encodeURIComponent(url)
  const links: Record<string, string> = {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${text}%20${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${text}`,
    x: `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`,
  }
  const shareUrl = links[platform]
  if (shareUrl) {
    window.open(shareUrl, "_blank", "noopener,noreferrer")
  }
}

/**
 * Share the certificate image + caption + URL.
 *
 * Tries multiple strategies in order:
 * 1. Web Share API with files (mobile — image attached to OS share sheet)
 * 2. Web Share API with text+url only (mobile — caption + URL, no image but
 *    the og:image preview card shows when the link is shared)
 * 3. Platform-specific share URL (desktop — opens LinkedIn/WhatsApp/etc.
 *    share intent with caption + URL, og:image preview card shows)
 * 4. Last resort: download image + copy caption to clipboard
 *
 * @param platform "whatsapp" | "linkedin" | "facebook" | "x" | "native"
 */
export async function shareCertificate(
  params: ShareImageParams,
  platform: string = "native"
): Promise<void> {
  // ── Path 1: Web Share API with file support (mobile, best UX) ─────────
  if (canShareFiles() && params.imageDataUrl) {
    try {
      const file = await dataUrlToFile(params.imageDataUrl, params.fileName)
      await navigator.share({
        files: [file],
        text: params.caption,
        url: params.url,
        title: "Certificate of Participation",
      })
      toast.success("Shared successfully!")
      return
    } catch (e: any) {
      if (e?.name === "AbortError") return // user cancelled
      // File share failed — fall through to Path 2/3
      console.error("[share-utils] share with files failed, trying text-only:", e)
    }
  }

  // ── Path 2: Web Share API with text + URL only (mobile, no image file) ─
  // The og:image on the verify page will show the cert image in the preview
  // card when the link is shared on the platform.
  if (hasNavigatorShare()) {
    try {
      await navigator.share({
        text: params.caption,
        url: params.url,
        title: "Certificate of Participation",
      })
      toast.success("Shared successfully!")
      return
    } catch (e: any) {
      if (e?.name === "AbortError") return // user cancelled
      console.error("[share-utils] share with text only failed:", e)
    }
  }

  // ── Path 3: Platform-specific share URL (desktop fallback) ────────────
  // Opens the platform's share intent with caption + URL. The og:image
  // preview card shows when the link is shared.
  if (platform !== "native") {
    openShareUrl(platform, params.caption, params.url)
    toast.success("Share window opened!", {
      description: `The certificate image will appear in the preview when you paste the link.`,
    })
    return
  }

  // ── Path 4: Last resort — download image + copy caption ───────────────
  if (params.imageDataUrl) {
    try {
      downloadImage(params.imageDataUrl, params.fileName)
    } catch (e) {
      console.error("[share-utils] downloadImage failed:", e)
    }
  }

  try {
    await navigator.clipboard.writeText(`${params.caption} ${params.url}`)
    toast.success("Caption + link copied to clipboard!", {
      description: "Paste it into your post. The certificate image will show in the preview.",
    })
  } catch {
    toast.success("Link copied!", {
      description: "Paste it into your post. The certificate image will show in the preview.",
    })
  }
}
