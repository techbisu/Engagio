import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import type { PaymentStatus, RegistrationDto } from "@/types";

/** Map a Prisma Registration row to a RegistrationDto (omits large `data`). */
function toRegistrationDto(r: any): RegistrationDto {
  let data: Record<string, string | number | boolean> = {};
  try {
    const parsed = JSON.parse(r.data);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, string | number | boolean>;
    }
  } catch {
    data = {};
  }
  return {
    id: r.id,
    eventId: r.eventId,
    userId: r.userId,
    data,
    createdAt: r.createdAt.toISOString(),
    user: r.user
      ? {
          name: r.user.name ?? null,
          email: r.user.email,
          image: r.user.image ?? null,
        }
      : undefined,
    paymentStatus: (r.paymentStatus ?? "NONE") as PaymentStatus,
    paymentMethod: r.paymentMethod ?? null,
    transactionReference: r.transactionReference ?? null,
    screenshotUrl: r.screenshotUrl ?? null,
    verifiedBy: r.verifiedBy ?? null,
    verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
    rejectionReason: r.rejectionReason ?? null,
  };
}

/**
 * GET /api/registrations/payment?eventId=xxx
 * Authenticated. Returns the current user's payment status for the event
 * (used by the participant's PaymentScreen to poll for verification result).
 *
 * Returns:
 *   - 401 if not authenticated.
 *   - 400 if `eventId` is missing.
 *   - 404 if the event or the user's registration does not exist.
 *   - 200 with `{ registration: RegistrationDto, paymentStatus: PaymentStatus }`
 *     if a registration exists.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json(
        { error: "eventId query parameter is required" },
        { status: 400 },
      );
    }

    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true, paymentMethod: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const registration = await db.registration.findUnique({
      where: { eventId_userId: { eventId, userId } },
      include: {
        user: { select: { name: true, email: true, image: true } },
      },
    });

    if (!registration) {
      return NextResponse.json(
        { error: "You are not registered for this event" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      registration: toRegistrationDto(registration),
      paymentStatus: (registration.paymentStatus ?? "NONE") as PaymentStatus,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/registrations/payment
 * Authenticated. Submit (or resubmit) manual payment proof for an event.
 *
 * Body: { eventId, transactionReference?, screenshotUrl? }
 *
 * Validation:
 *   - The user must have an existing registration for the event.
 *   - The event's paymentMethod must be "MANUAL".
 *   - If `event.requireTransactionRef` is true -> `transactionReference` non-empty.
 *   - If `event.requireScreenshot` is true -> `screenshotUrl` non-empty base64 data URL.
 *
 * Sets:
 *   - paymentStatus = "PENDING_VERIFICATION"
 *   - paymentMethod = "MANUAL"
 *   - transactionReference / screenshotUrl from body
 *   - clears rejectionReason / verifiedBy / verifiedAt (fresh submission).
 *
 * NOTE: The screenshot is PROOF SUBMITTED for manual verification, not proof
 * of payment itself. The admin must explicitly approve before the
 * paymentStatus becomes "COMPLETED".
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { eventId, transactionReference, screenshotUrl } = body as any;
    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 },
      );
    }

    const event = await db.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        paymentMethod: true,
        requireTransactionRef: true,
        requireScreenshot: true,
      },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (event.paymentMethod !== "MANUAL") {
      return NextResponse.json(
        { error: "This event does not require manual payment" },
        { status: 400 },
      );
    }

    const registration = await db.registration.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true },
    });
    if (!registration) {
      return NextResponse.json(
        { error: "You are not registered for this event" },
        { status: 404 },
      );
    }

    // Validate required fields.
    const txRef =
      typeof transactionReference === "string"
        ? transactionReference.trim()
        : "";
    const ss =
      typeof screenshotUrl === "string" ? screenshotUrl.trim() : "";

    if (event.requireTransactionRef && !txRef) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 },
      );
    }
    if (event.requireScreenshot && !ss) {
      return NextResponse.json(
        { error: "Payment screenshot is required" },
        { status: 400 },
      );
    }
    // Basic sanity: screenshot, when provided, must be a base64 data URL.
    if (ss && !ss.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Screenshot must be a valid image (data URL)" },
        { status: 400 },
      );
    }
    // Reject excessively large payloads (> 4MB image data).
    const MAX_SS_BYTES = 4 * 1024 * 1024;
    if (ss.length > MAX_SS_BYTES * 1.34) {
      return NextResponse.json(
        { error: "Screenshot is too large. Please upload a smaller image." },
        { status: 400 },
      );
    }
    if (txRef.length > 200) {
      return NextResponse.json(
        { error: "Transaction ID is too long (max 200 chars)" },
        { status: 400 },
      );
    }

    // Upload the screenshot to the storage provider (Cloudinary if configured,
    // else base64 data URL fallback). The Registration model doesn't have a
    // dedicated screenshotPublicId field, so we don't track the public_id for
    // deletion here — screenshots are kept for audit. If Cloudinary is set up
    // this means we store a Cloudinary URL instead of a multi-megabyte base64
    // blob, which keeps the DB row small.
    let storedScreenshotUrl: string | null = null;
    if (ss) {
      const uploaded = await uploadFile(ss, "image/jpeg", {
        folder: "payments",
        transformations: ["w_800", "h_600", "c_limit", "q_auto", "f_auto"],
      });
      storedScreenshotUrl = uploaded.url;
    }

    const updated = await db.registration.update({
      where: { id: registration.id },
      data: {
        paymentStatus: "PENDING_VERIFICATION",
        paymentMethod: "MANUAL",
        transactionReference: txRef || null,
        screenshotUrl: storedScreenshotUrl,
        verifiedBy: null,
        verifiedAt: null,
        rejectionReason: null,
      },
      include: {
        user: { select: { name: true, email: true, image: true } },
      },
    });

    return NextResponse.json({
      registration: toRegistrationDto(updated),
      paymentStatus: "PENDING_VERIFICATION" as PaymentStatus,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 },
    );
  }
}
