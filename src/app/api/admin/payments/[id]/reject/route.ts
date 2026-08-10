import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import type { PaymentStatus, RegistrationDto } from "@/types";

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

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/payments/[id]/reject
 * Admin only. `id` is the registration ID.
 *
 * Body: { rejectionReason: string }
 *
 * Validates:
 *   - The registration exists.
 *   - paymentStatus is "PENDING_VERIFICATION".
 *   - rejectionReason is a non-empty string (max 500 chars).
 *
 * Updates:
 *   - paymentStatus = "REJECTED"
 *   - verifiedBy = session.user.id
 *   - verifiedAt = now
 *   - rejectionReason from body.
 *
 * Returns: `{ success: true, registration }`.
 *
 * The participant sees the rejection + reason in their PaymentScreen and can
 * re-submit via the "Resubmit Payment" button.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const adminId = (session.user as any).id as string | undefined;
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const existing = await db.registration.findUnique({
      where: { id },
      select: { id: true, paymentStatus: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 },
      );
    }
    if (existing.paymentStatus !== "PENDING_VERIFICATION") {
      return NextResponse.json(
        {
          error:
            "Only payments pending verification can be rejected. Current status: " +
            existing.paymentStatus,
        },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const reason =
      typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";
    if (!reason) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 },
      );
    }
    if (reason.length > 500) {
      return NextResponse.json(
        { error: "Rejection reason is too long (max 500 chars)" },
        { status: 400 },
      );
    }

    const updated = await db.registration.update({
      where: { id },
      data: {
        paymentStatus: "REJECTED",
        verifiedBy: adminId,
        verifiedAt: new Date(),
        rejectionReason: reason,
      },
      include: {
        user: { select: { name: true, email: true, image: true } },
      },
    });

    return NextResponse.json({
      success: true,
      registration: toRegistrationDto(updated),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 },
    );
  }
}
