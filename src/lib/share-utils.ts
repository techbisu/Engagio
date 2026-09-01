"use client"

import { toast } from "sonner"

/**
 * Web Share API helpers for sharing the certificate image + caption text
 * to social platforms.
 *
 * The native Web Share API (`navigator.share`) on mobile browsers supports
 * sharing FILES (images) + text + URL together — opening the OS share sheet
 * so the user can pick WhatsApp / Facebook / X / LinkedIn / etc. This is the
 * ONLY reliable way to attach an image to a WhatsApp share (the `wa.me/?text=`
 * URL scheme does NOT support image attachments).
 *
 * On desktop browsers that don't support `navigator.share` with files, we
 * fall back to:
 *   1. Auto-downloading the PNG to the user's device (so they can attach it
 *      manually).
 *   2. Opening the platform-specific share URL with the caption text + URL.
 *   3. Showing a toast: "Image downloaded! Attach it to your message."
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
 * Trigger a browser download of the PNG (fallback for desktop browsers
 * that don't support `navigator.share` with files).
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
 * Check whether the current browser supports `navigator.share` with files.
 * Mobile browsers (Chrome Android, Safari iOS) support this. Most desktop
 * browsers do NOT.
 */
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined") return false
  if (!("share" in navigator) || !("canShare" in navigator)) return false
  try {
    // canShare with a dummy PNG file to check support
    const dummy = new File(["test"], "test.png", { type: "image/png" })
    return navigator.canShare({ files: [dummy] })
  } catch {
    return false
  }
}

/**
 * Share the certificate image + caption + URL using the native Web Share
 * API. On success, opens the OS share sheet (WhatsApp / Facebook / X /
 * LinkedIn / etc. — user picks). Returns true if shared, false if the user
 * cancelled or the API isn't available.
 */
export async function shareViaWebApi(params: ShareImageParams): Promise<boolean> {
  try {
    const file = await dataUrlToFile(params.imageDataUrl, params.fileName)
    await navigator.share({
      files: [file],
      text: params.caption,
      url: params.url,
      title: "Certificate of Participation",
    })
    return true
  } catch (e: any) {
    // AbortError = user cancelled — don't show an error.
    if (e?.name === "AbortError") return false
    throw e
  }
}

/**
 * Open a platform-specific share URL in a new window. Used as a fallback
 * when `navigator.share` with files isn't available.
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
 * Tries the native Web Share API first (best UX — attaches the image to
 * WhatsApp / Facebook / etc. on mobile). Falls back to downloading the
 * image + opening the platform-specific share URL (desktop browsers).
 *
 * @param platform "whatsapp" | "linkedin" | "facebook" | "x" | "native"
 *                  ("native" = just open the OS share sheet, let the user
 *                  pick the platform)
 */
export async function shareCertificate(
  params: ShareImageParams,
  platform: string = "native"
): Promise<void> {
  // ── Path 1: Web Share API with file support (mobile browsers) ────────
  // This is the ONLY way to attach the image to a WhatsApp share. It opens
  // the native OS share sheet where the user picks WhatsApp / Facebook /
  // X / LinkedIn / etc.
  if (canShareFiles()) {
    try {
      const shared = await shareViaWebApi(params)
      if (shared) {
        toast.success("Shared successfully!")
        return
      }
      // User cancelled (AbortError) — don't fall through to the fallback.
      return
    } catch (e) {
      // The Web Share API with files failed (e.g. the image fetch failed,
      // File creation failed, or the browser silently rejected). Fall
      // through to the URL-based fallback below so the user still gets
      // a working share button instead of "nothing happens".
      console.error("[share-utils] Web Share API with files failed, falling back:", e)
    }
  }

  // ── Path 2: Fallback for desktop browsers OR when Web Share with files failed ─
  // 1. Download the PNG so the user can manually attach it.
  // 2. Open the platform-specific share URL with caption + URL.
  // 3. Show a toast telling the user to attach the downloaded image.
  try {
    downloadImage(params.imageDataUrl, params.fileName)
  } catch (e) {
    console.error("[share-utils] downloadImage failed:", e)
  }

  if (platform === "native") {
    // No native share sheet on desktop — just download + copy caption.
    try {
      await navigator.clipboard.writeText(`${params.caption} ${params.url}`)
      toast.success("Image downloaded + caption copied to clipboard!", {
        description: "Attach the image to your post and paste the caption.",
      })
    } catch {
      toast.success("Image downloaded!", {
        description: "Attach it to your post. Caption text copied separately.",
      })
    }
    return
  }

  // Open the platform-specific share URL
  openShareUrl(platform, params.caption, params.url)
  toast.success("Image downloaded + share window opened!", {
    description: `Attach the downloaded image to your ${platform} post/message.`,
  })
}
