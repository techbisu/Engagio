/**
 * Storage abstraction — provides a uniform interface for uploading, fetching,
 * and deleting files. Initially backed by Cloudinary with a base64/local
 * fallback when Cloudinary credentials are not configured.
 *
 * To migrate to Cloudflare R2/S3 later, implement the same interface
 * (upload/delete/getUrl) with the new provider. Application-level code
 * uses `uploadFile()` / `deleteFile()` / `resolveFileUrl()` and never
 * touches provider-specific APIs directly.
 *
 * Env vars (optional — if absent, falls back to base64 data URLs):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

import { v2 as cloudinary } from "cloudinary"

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
const API_KEY = process.env.CLOUDINARY_API_KEY
const API_SECRET = process.env.CLOUDINARY_API_SECRET

export const cloudinaryConfigured = !!(CLOUD_NAME && API_KEY && API_SECRET)

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true,
  })
}

export interface UploadResult {
  /** The publicly-accessible URL of the stored file (Cloudinary URL or base64 data URL). */
  url: string
  /** Provider-specific public_id for later deletion/migration. null for base64 fallback. */
  publicId: string | null
  /** Size in bytes of the original data. */
  bytes: number
  /** MIME type of the file. */
  mimeType: string
  /** Which provider handled the upload. */
  provider: "cloudinary" | "base64"
}

export interface UploadOptions {
  /**
   * Logical folder path in the storage provider, e.g. "questions", "payments",
   * "certificates", "events". Used to organize assets + generate unique public_ids.
   */
  folder: string
  /**
   * Optional filename (without extension). If omitted, a random id is generated.
   */
  filename?: string
  /**
   * Optional list of Cloudinary transformation strings applied on upload,
   * e.g. ["w_800","h_600","c_fit","q_auto","f_auto"]. Ignored by base64 fallback.
   */
  transformations?: string[]
}

/**
 * Upload a file to storage. Accepts a base64 data URL (from client-side canvas
 * compression) or a raw Buffer + mime type (from server-side generation).
 *
 * - If Cloudinary is configured: uploads to Cloudinary with the given folder +
 *   transformations, returns the secure URL + public_id.
 * - If Cloudinary is NOT configured: returns the base64 data URL as-is (or
 *   converts a Buffer to a base64 data URL), with publicId=null.
 */
export async function uploadFile(
  data: string | Buffer,
  mimeType: string,
  options: UploadOptions
): Promise<UploadResult> {
  // Normalize input to a base64 string (without the data: prefix)
  let base64Data: string
  let bytes: number

  if (Buffer.isBuffer(data)) {
    base64Data = data.toString("base64")
    bytes = data.length
  } else if (typeof data === "string") {
    if (data.startsWith("data:")) {
      // Already a data URL — strip the prefix
      const match = data.match(/^data:([^;]+);base64,(.*)$/)
      if (match) {
        base64Data = match[2]
        mimeType = match[1] || mimeType
        bytes = Math.floor((base64Data.length * 3) / 4)
      } else {
        base64Data = data
        bytes = data.length
      }
    } else {
      base64Data = data
      bytes = data.length
    }
  } else {
    throw new Error("uploadFile: data must be a string or Buffer")
  }

  // --- Cloudinary path ---
  if (cloudinaryConfigured) {
    try {
      const publicId = options.filename
        ? `${options.folder}/${options.filename}`
        : `${options.folder}/${generateId()}`

      const transformation = (options.transformations || []).join(",")

      const result = await cloudinary.uploader.upload(
        `data:${mimeType};base64,${base64Data}`,
        {
          public_id: publicId,
          resource_type: "auto",
          // Apply transformations inline so the stored asset is already optimized
          ...(transformation ? { transformation } : {}),
          // Overwrite if same public_id (for regeneration)
          overwrite: true,
        }
      )

      return {
        url: result.secure_url,
        publicId: result.public_id,
        bytes: result.bytes,
        mimeType,
        provider: "cloudinary",
      }
    } catch (e) {
      console.error("[storage] Cloudinary upload failed, falling back to base64:", e)
      // Fall through to base64
    }
  }

  // --- Base64 fallback ---
  return {
    url: `data:${mimeType};base64,${base64Data}`,
    publicId: null,
    bytes,
    mimeType,
    provider: "base64",
  }
}

/**
 * Delete a file from storage. Uses the publicId if available (Cloudinary);
 * for base64 fallback, deletion is a no-op (the data URL is stored inline
 * in the DB and will be removed when the row is deleted).
 */
export async function deleteFile(
  publicId: string | null | undefined
): Promise<boolean> {
  if (!publicId) return true // base64 — nothing to delete
  if (!cloudinaryConfigured) return true

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "auto" })
    return true
  } catch (e) {
    console.error("[storage] Cloudinary delete failed:", e)
    return false
  }
}

/**
 * Resolve a stored file's URL for display. For base64 data URLs, returns as-is.
 * For Cloudinary URLs, optionally applies a transformation (e.g. thumbnail).
 */
export function resolveFileUrl(
  url: string | null | undefined,
  transformation?: string
): string | null {
  if (!url) return null
  if (url.startsWith("data:") || url.startsWith("http")) {
    // For Cloudinary URLs, insert the transformation if requested
    if (transformation && cloudinaryConfigured && url.includes("res.cloudinary.com")) {
      // Insert transformation before the upload part of the URL
      // Format: https://res.cloudinary.com/{cloud}/image/upload/v{ver}/{public_id}
      return url.replace(
        /\/image\/upload\//,
        `/image/upload/${transformation}/`
      )
    }
    return url
  }
  return url
}

/**
 * Generate a URL for an asset given its publicId (Cloudinary only).
 * Returns null if Cloudinary is not configured or publicId is null.
 */
export function getUrlByPublicId(
  publicId: string | null | undefined,
  transformation?: string
): string | null {
  if (!publicId || !cloudinaryConfigured) return null
  return cloudinary.url(publicId, {
    transformation: transformation ? transformation.split(",") : undefined,
    secure: true,
  })
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

/**
 * Get the status of the storage provider for admin display.
 */
export function getStorageStatus(): {
  configured: boolean
  provider: "cloudinary" | "base64"
  cloudName?: string
} {
  return {
    configured: cloudinaryConfigured,
    provider: cloudinaryConfigured ? "cloudinary" : "base64",
    cloudName: CLOUD_NAME,
  }
}

/**
 * Resolve an image field sent by a client (e.g. in an event PATCH/POST) into
 * the URL + publicId that should be persisted. Handles three cases:
 *
 *   1. `bodyValue === undefined`             -> no change. Returns `null` so the
 *                                               caller can skip the update.
 *   2. `bodyValue` is null/empty/""           -> cleared. The previous Cloudinary
 *                                               asset (if any) is deleted; both
 *                                               url + publicId return null.
 *   3. `bodyValue` is a base64 data URL       -> new upload. Deletes the previous
 *                                               asset (if any), uploads the new
 *                                               one, returns its url + publicId.
 *   4. `bodyValue` is any other string        -> external URL passthrough. Persists
 *                                               the URL as-is with publicId=null
 *                                               (we don't know its mapping).
 *
 * `oldPublicId` is the previously-stored publicId for this field (used to
 * clean up the old Cloudinary asset before replacing it).
 */
export async function resolveImageField(
  bodyValue: unknown,
  oldPublicId: string | null | undefined,
  options: UploadOptions,
  mimeType = "image/jpeg"
): Promise<{ url: string | null; publicId: string | null } | null> {
  if (bodyValue === undefined) return null // No change — caller should skip.

  if (typeof bodyValue !== "string") {
    // null / undefined / non-string -> cleared.
    await deleteFile(oldPublicId)
    return { url: null, publicId: null }
  }

  const trimmed = bodyValue.trim()
  if (!trimmed) {
    await deleteFile(oldPublicId)
    return { url: null, publicId: null }
  }

  if (trimmed.startsWith("data:image/")) {
    await deleteFile(oldPublicId)
    const uploaded = await uploadFile(trimmed, mimeType, options)
    return { url: uploaded.url, publicId: uploaded.publicId }
  }

  // External URL passthrough — no Cloudinary asset to track.
  return { url: trimmed, publicId: null }
}
