"use client"

/**
 * Client-side image upload helper.
 *
 * Wraps the /api/upload endpoint. Returns the hosted URL (Cloudinary or
 * base64 fallback). Used by all admin + student image upload UIs.
 */
export interface UploadResponse {
  url: string
  publicId: string | null
  isLocal: boolean
  bytes?: number
  cloudinaryConfigured: boolean
}

/**
 * Upload a File to the backend (which forwards to Cloudinary or falls back to base64).
 * Returns the hosted URL + public ID.
 *
 * Automatically compresses the image client-side BEFORE uploading:
 * - Resizes to max 1200x900 (maintains aspect ratio)
 * - Re-encodes as JPEG quality 0.85
 * - This reduces bandwidth + Cloudinary storage cost
 */
export async function uploadImage(
  file: File,
  folder: string = "general"
): Promise<UploadResponse> {
  // Compress client-side first
  const compressed = await compressImage(file)

  const formData = new FormData()
  formData.append("file", compressed)
  formData.append("folder", folder)

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error((e as { error?: string }).error || `Upload failed: ${res.status}`)
  }

  return res.json()
}

/**
 * Check if Cloudinary is configured on the server.
 * Used to show a "Cloudinary not configured — using local storage" warning.
 */
export async function isCloudinaryConfigured(): Promise<boolean> {
  try {
    const res = await fetch("/api/upload")
    if (!res.ok) return false
    const data = await res.json()
    return data.configured === true
  } catch {
    return false
  }
}

/**
 * Compress an image File client-side before upload.
 * - Resizes to maxW x maxH (maintains aspect ratio)
 * - Re-encodes as JPEG quality 0.85
 * - Returns a File (or the original if compression fails)
 */
async function compressImage(
  file: File,
  maxW = 1200,
  maxH = 900,
  quality = 0.85
): Promise<File> {
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
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file)
              return
            }
            const compressed = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
            resolve(compressed)
          },
          "image/jpeg",
          quality
        )
      }
      img.onerror = () => resolve(file)
      img.src = e.target?.result as string
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}
