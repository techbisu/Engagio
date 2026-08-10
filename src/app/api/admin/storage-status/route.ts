import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { getStorageStatus } from "@/lib/storage";
import { getEmailStatus } from "@/lib/email";

/**
 * GET /api/admin/storage-status — admin only.
 *
 * Returns the configuration status of the storage (Cloudinary) and email
 * (Resend) abstractions so the admin UI can show a banner when either
 * provider isn't configured (e.g. "Images are stored as base64 in the DB.
 * Configure Cloudinary for production.").
 *
 * Response shape:
 *   {
 *     storage: { configured: boolean, provider: "cloudinary" | "base64", cloudName?: string },
 *     email:   { configured: boolean, provider: "resend" | "disabled", from?: string }
 *   }
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as
      | { id?: string; name?: string | null; email?: string | null; role?: string }
      | undefined;
    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      storage: getStorageStatus(),
      email: getEmailStatus(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 },
    );
  }
}
