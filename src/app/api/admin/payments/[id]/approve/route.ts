import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, ownsResource } from "@/lib/tenant";
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
 * POST /api/admin/payments/[id]/approve
 * Admin only. `id` is the registration ID.
 *
 * Validates:
 *   - The registration exists.
 *   - paymentStatus is "PENDING_VERIFICATION" (can't approve already-decided).
 *
 * Updates:
 *   - paymentStatus = "COMPLETED"
 *   - verifiedBy = session.user.id
 *   - verifiedAt = now
 *   - clears rejectionReason.
 *
 * Returns: `{ success: true, registration }`.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    // Payment verification is an ADMIN-level action (per the role matrix).
    const auth = await requirePermission(req, "registration.payment.verify");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const adminId = auth.ctx.userId;

    const { id } = await ctx.params;
    const existing = await db.registration.findUnique({
      where: { id },
      select: { id: true, paymentStatus: true },
      include: { event: { select: { organizationId: true } } },
    });
    if (!existing || !ownsResource(existing.event, auth.ctx)) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 },
      );
    }
    if (existing.paymentStatus !== "PENDING_VERIFICATION") {
      return NextResponse.json(
        {
          error:
            "Only payments pending verification can be approved. Current status: " +
            existing.paymentStatus,
        },
        { status: 400 },
      );
    }

    const updated = await db.registration.update({
      where: { id },
      data: {
        paymentStatus: "COMPLETED",
        verifiedBy: adminId,
        verifiedAt: new Date(),
        rejectionReason: null,
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
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
