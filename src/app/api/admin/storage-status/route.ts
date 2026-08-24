import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/tenant";
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
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "organization.view");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    return NextResponse.json({
      storage: getStorageStatus(),
      email: getEmailStatus(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
