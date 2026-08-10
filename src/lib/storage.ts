/**
 * Storage abstraction layer.
 *
 * All file uploads go through this module so the underlying provider can be
 * swapped (Cloudinary → Cloudflare R2 → S3) without changing application code.
 *
 * Current provider: Cloudinary (unsigned upload via upload preset, or signed
 * upload via the API directly).
 *
 * Env vars (all optional — falls back to local base64 storage if missing):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *   CLOUDINARY_UPLOAD_PRESET (for unsigned uploads — browser-side)
 *
 * When CLOUDINARY_CLOUD_NAME is not set, `uploadImage` falls back to returning
 * a base64 data URL so the app keeps working in dev without external services.
 */

export interface UploadOptions {
  /** Logical folder, e.g. "questions", "events", "payments", "certificates". */
  folder?: string
  /** Public ID prefix — Cloudinary will append a unique suffix. */
  publicIdPrefix?: string
  /** Transformation to apply on upload, e.g. "w_800,h_600,c_fill,q_auto". */
  transformation?: string
  /** Tags for organization. */
  tags?: string[]
}

export interface UploadResult {
  url: string
  publicId?: string
  /** True if the result is a base64 data URL (fallback mode). */
  isLocal: boolean
  /** Original byte size of the input. */
  bytes?: number
  /** MIME type of the uploaded file. */
  format?: string
}

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME?.trim()
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY?.trim()
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET?.trim()

export function isCloudinaryConfigured(): boolean {
  return !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET)
}

/**
 * Upload an image buffer to Cloudinary using signed upload.
 * Server-side only (uses the API secret).
 *
 * If Cloudinary is not configured, falls back to returning a base64 data URL
 * so the app keeps working in dev without external services.
 */
export async function uploadImage(
  buffer: Buffer,
  mimeType: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    // Fallback: base64 data URL — no external storage
    const base64 = buffer.toString("base64")
    return {
      url: `data:${mimeType};base64,${base64}`,
      isLocal: true,
      bytes: buffer.length,
      format: mimeType.split("/")[1] || "bin",
    }
  }

  const folder = options.folder || "engagio"
  const timestamp = Math.floor(Date.now() / 1000)

  // Build the upload params that need to be signed.
  // Cloudinary signing: only these params go into the signature string
  // (sorted alphabetically, joined as key=value&key=value, then append API secret).
  // Do NOT include: api_key, file, signature, resource_type in the signature.
  const signParams: Record<string, string> = {
    folder,
    timestamp: String(timestamp),
  }
  if (options.publicIdPrefix) signParams.public_id = `${options.publicIdPrefix}-${timestamp}`
  if (options.transformation) signParams.transformation = options.transformation
  if (options.tags?.length) signParams.tags = options.tags.join(",")

  // Sign the params
  const signature = signCloudinaryParams(signParams)

  // Build the full FormData (includes signed params + api_key + file + resource_type)
  const formData = new FormData()
  for (const [k, v] of Object.entries(signParams)) formData.append(k, v)
  formData.append("signature", signature)
  formData.append("api_key", CLOUDINARY_API_KEY!)
  formData.append("resource_type", "image")
  formData.append("file", new Blob([buffer], { type: mimeType }))

  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`
  const res = await fetch(uploadUrl, { method: "POST", body: formData })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Cloudinary upload failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as {
    secure_url: string
    public_id: string
    bytes: number
    format: string
  }

  // Return an optimized URL with auto-format + auto-quality + width constraint
  // by inserting transformation segments into the URL path.
  const optimizedUrl = optimizeCloudinaryUrl(data.secure_url, options.transformation)

  return {
    url: optimizedUrl,
    publicId: data.public_id,
    isLocal: false,
    bytes: data.bytes,
    format: data.format,
  }
}

/**
 * Sign Cloudinary upload params using SHA-1 + the API secret.
 *
 * Cloudinary's algorithm:
 * 1. Sort params alphabetically (excluding api_key, file, signature, resource_type)
 * 2. Join as: key=value&key=value
 * 3. Append API secret directly (no & before it): key=value&key=valueAPI_SECRET
 * 4. SHA-1 hash → hex string
 */
import { createHash } from "crypto"

function signCloudinaryParams(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== "api_key" && k !== "file" && k !== "signature" && k !== "resource_type")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&")
  const toSign = `${sorted}${CLOUDINARY_API_SECRET}`
  return createHash("sha1").update(toSign).digest("hex")
}

/**
 * Insert transformation params into a Cloudinary URL to get an optimized
 * derivative (auto-format + auto-quality).
 *
 * Input:  https://res.cloudinary.com/demo/image/upload/v123/sample.jpg
 * Output: https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800/v123/sample.jpg
 *
 * If the URL doesn't look like a Cloudinary URL, returns it unchanged.
 */
export function optimizeCloudinaryUrl(
  url: string,
  transformation?: string
): string {
  if (!url.includes("res.cloudinary.com")) return url
  const t = transformation || "f_auto,q_auto"
  return url.replace(
    "/image/upload/",
    `/image/upload/${t}/`
  )
}

/**
 * Delete an asset from Cloudinary by its public ID.
 * Server-side only.
 * No-op (returns success) if Cloudinary is not configured or publicId is empty.
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  if (!publicId || !isCloudinaryConfigured()) return false

  const timestamp = Math.floor(Date.now() / 1000)
  const params: Record<string, string> = {
    public_id: publicId,
    timestamp: String(timestamp),
  }
  const signature = signCloudinaryParams(params)

  const formData = new FormData()
  formData.append("public_id", params.public_id)
  formData.append("timestamp", params.timestamp)
  formData.append("signature", signature)
  formData.append("api_key", CLOUDINARY_API_KEY!)

  const deleteUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/image/destroy`
  const res = await fetch(deleteUrl, { method: "POST", body: formData })
  return res.ok
}

/**
 * Convert a File/Blob (from a browser file input) to a Buffer.
 * Used by the /api/upload route handler to read the incoming file.
 */
export async function fileToBuffer(file: Blob): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ─── Compatibility wrappers for the previous storage API ───────────────────
// The earlier version of this module exposed uploadFile / deleteFile /
// resolveImageField / getStorageStatus. We keep them here so existing route
// handlers continue to work without changes.

export interface StorageStatus {
  provider: "cloudinary" | "local"
  cloudinaryConfigured: boolean
  cloudName?: string
}

export function getStorageStatus(): StorageStatus {
  return {
    provider: isCloudinaryConfigured() ? "cloudinary" : "local",
    cloudinaryConfigured: isCloudinaryConfigured(),
    cloudName: CLOUDINARY_CLOUD_NAME || undefined,
  }
}

/**
 * Upload a file from a multipart FormData field. Used by routes that accept
 * file uploads directly (questions, events, registrations, certificates).
 *
 * `fieldName` is the FormData key; `formData` is the parsed FormData.
 * Returns `{ url, publicId }` — url is a Cloudinary URL or base64 data URL.
 */
export async function uploadFile(
  formData: FormData,
  fieldName: string,
  options: UploadOptions = {}
): Promise<{ url: string; publicId: string | null }> {
  const file = formData.get(fieldName)
  if (!file || !(file instanceof File)) {
    return { url: "", publicId: null }
  }
  const buffer = await fileToBuffer(file)
  const result = await uploadImage(buffer, file.type, options)
  return { url: result.url, publicId: result.publicId || null }
}

/** Alias for deleteImage — kept for compatibility. */
export async function deleteFile(publicId: string): Promise<boolean> {
  return deleteImage(publicId)
}

/**
 * Resolve a form field that may be either a file upload OR a string URL.
 * If the field is a File, upload it and return the URL + publicId.
 * If it's a string, treat it as an existing URL and return as-is.
 *
 * Used by event/question PATCH handlers that accept either a new upload
 * or keep the existing URL.
 */
export async function resolveImageField(
  formData: FormData,
  fieldName: string,
  existingUrl: string | null = null,
  existingPublicId: string | null = null,
  options: UploadOptions = {}
): Promise<{
  url: string | null
  publicId: string | null
  deletedOld: boolean
}> {
  const field = formData.get(fieldName)

  // Case 1: new file upload
  if (field instanceof File && field.size > 0) {
    // Delete the old asset if there was one
    if (existingPublicId) {
      await deleteImage(existingPublicId).catch(() => {})
    }
    const buffer = await fileToBuffer(field)
    const result = await uploadImage(buffer, field.type, options)
    return {
      url: result.url,
      publicId: result.publicId || null,
      deletedOld: !!existingPublicId,
    }
  }

  // Case 2: string value (existing URL or null)
  if (typeof field === "string" && field.trim()) {
    return { url: field, publicId: existingPublicId, deletedOld: false }
  }

  // Case 3: no value — keep existing
  return { url: existingUrl, publicId: existingPublicId, deletedOld: false }
}

/**
 * Resolve an image field that comes from a JSON body (NOT a FormData).
 *
 * Accepts a value that is either:
 *   - a string URL (data URL, Cloudinary URL, or external URL) → passthrough
 *   - a File/Blob object → upload it
 *   - null/"" → clear (delete old asset, return null)
 *   - undefined → no change (return existing)
 *
 * Used by JSON-based PATCH handlers (e.g., events PATCH) that receive
 * image values in the JSON body rather than multipart form data.
 *
 * @param value           The incoming value (string | File | null | undefined)
 * @param existingPublicId The current publicId in the DB (for cleanup)
 * @param options          Upload options (folder, transformation, etc.)
 * @returns `{ url, publicId }` — url is null when cleared, publicId is null
 *          when not a Cloudinary upload.
 */
export async function resolveImageValue(
  value: string | File | Blob | null | undefined,
  existingPublicId: string | null,
  options: UploadOptions = {}
): Promise<{
  url: string | null
  publicId: string | null
}> {
  // Case 1: File/Blob upload — upload to Cloudinary (or local fallback)
  if ((value instanceof File || value instanceof Blob) && value.size > 0) {
    if (existingPublicId) {
      await deleteImage(existingPublicId).catch(() => {})
    }
    const buffer = await fileToBuffer(value)
    const result = await uploadImage(buffer, (value as File).type || "image/png", options)
    return {
      url: result.url,
      publicId: result.publicId || null,
    }
  }

  // Case 2: non-empty string — could be a data URL, Cloudinary URL, or external URL
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim()
    // If it's a data URL → upload it (otherwise the DB would bloat with base64)
    if (trimmed.startsWith("data:image/")) {
      if (existingPublicId) {
        await deleteImage(existingPublicId).catch(() => {})
      }
      const base64Match = trimmed.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
      if (base64Match) {
        const mimeType = `image/${base64Match[1]}`
        const buffer = Buffer.from(base64Match[2], "base64")
        const result = await uploadImage(buffer, mimeType, options)
        return { url: result.url, publicId: result.publicId || null }
      }
    }
    // Otherwise treat as a URL passthrough — optimize Cloudinary URLs if applicable
    return { url: optimizeCloudinaryUrl(trimmed, options.transformation), publicId: existingPublicId }
  }

  // Case 3: null or empty string → clear the field (delete old asset if any)
  if (value === null || (typeof value === "string" && !value.trim())) {
    if (existingPublicId) {
      await deleteImage(existingPublicId).catch(() => {})
    }
    return { url: null, publicId: null }
  }

  // Case 4: undefined → no change
  return { url: null, publicId: existingPublicId }
}
