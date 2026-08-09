"use client"

/**
 * Client-side image utilities:
 *   - readFileAsDataURL: read a File/Blob as a base64 data URL via FileReader.
 *   - compressImage: downscale + re-encode an image File via canvas.
 *   - fileToCompressedDataUrl: combined helper (resize to max dimensions and
 *     re-encode as JPEG to keep base64 payload small).
 *
 * Used by the Manual UPI Payment flow (QR code uploads + screenshot uploads).
 * Storing base64 data URLs directly in the DB avoids any external storage
 * (Cloudinary/S3) dependency.
 */

/** Read a File as a base64 data URL (FileReader.readAsDataURL). */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string") resolve(result)
      else reject(new Error("Failed to read file as data URL"))
    }
    reader.onerror = () => reject(reader.error || new Error("FileReader error"))
    reader.readAsDataURL(file)
  })
}

/**
 * Compress an image File via canvas. Returns a JPEG data URL.
 *
 * @param file        The image File to compress.
 * @param maxDim      The max width/height to downscale to (preserves aspect ratio).
 * @param quality     JPEG quality 0..1 (default 0.82).
 */
export function compressImage(
  file: File,
  maxDim: number,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        let { width, height } = img
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
        // Guard against zero-dimension images.
        width = Math.max(1, width)
        height = Math.max(1, height)

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error("Canvas 2D context unavailable"))
          return
        }
        // White background so transparent PNGs don't turn black under JPEG.
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        const dataUrl = canvas.toDataURL("image/jpeg", quality)
        resolve(dataUrl)
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to load image"))
    }
    img.src = url
  })
}

/**
 * Convenience: read a File as a compressed data URL.
 * Falls back to the raw data URL if compression fails (e.g. SVG / non-image).
 *
 * @param file      The File selected by the user.
 * @param maxDim    Max width/height (square-ish). Default 800.
 * @param quality   JPEG quality. Default 0.82.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxDim = 800,
  quality = 0.82,
): Promise<string> {
  try {
    // Only attempt canvas compression for actual image MIME types.
    if (!file.type.startsWith("image/")) {
      return await readFileAsDataURL(file)
    }
    return await compressImage(file, maxDim, quality)
  } catch {
    // Last-resort fallback: raw data URL (works for any file).
    return await readFileAsDataURL(file)
  }
}

/**
 * Approximate size (in KB) of a base64 data URL payload.
 * Useful for showing the user how big their upload will be.
 */
export function dataUrlSizeKb(dataUrl: string): number {
  const comma = dataUrl.indexOf(",")
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  // Base64 represents 6 bits per char → 4 chars per 3 bytes.
  const bytes = Math.floor((b64.length * 3) / 4)
  return Math.round(bytes / 1024)
}
