import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/tenant";
import type { PaymentStatus, RegistrationDto } from "@/types";

/** Default page size for paginated results. */
const PAGE_SIZE = 50;

/** Map a Prisma Registration row to a RegistrationDto (with payment fields). */
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
 * GET /api/admin/payments
 * Admin only. Lists registrations with `paymentStatus !== "NONE"`,
 * including the user info (name, email, image) + event info (title,
 * paymentAmount, paymentCurrency).
 *
 * Query params:
 *   - `status` (default: PENDING_VERIFICATION): one of
 *     PENDING_VERIFICATION | COMPLETED | REJECTED | ALL.
 *   - `eventId` (optional): filter to a single event.
 *   - `cursor` (optional): pagination cursor (the `id` of the last item from previous page).
 *   - `limit` (optional): page size, default 50, max 100.
 *
 * Returns: `{ payments: RegistrationDto[], nextCursor: string | null, total: number }`.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "registration.payment.verify");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") || "PENDING_VERIFICATION").toUpperCase();
    const eventId = url.searchParams.get("eventId");
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || String(PAGE_SIZE), 10) || PAGE_SIZE, 1), 100);

    // Build where clause — org-scoped via the registration's event.
    const where: any = {
      paymentStatus: { not: "NONE" },
      event: { organizationId: auth.ctx.orgId },
    };
    if (statusParam !== "ALL") {
      if (
        statusParam === "PENDING_VERIFICATION" ||
        statusParam === "COMPLETED" ||
        statusParam === "REJECTED"
      ) {
        where.paymentStatus = statusParam;
      } else {
        where.paymentStatus = "PENDING_VERIFICATION";
      }
    }
    if (eventId) {
      where.eventId = eventId;
    }
    // Cursor-based pagination
    if (cursor) {
      where.id = { gt: cursor };
    }

    let orderBy: any = { createdAt: "desc" };
    if (
      statusParam === "COMPLETED" ||
      statusParam === "REJECTED" ||
      statusParam === "ALL"
    ) {
      orderBy = [{ verifiedAt: "desc" }, { createdAt: "desc" }];
    }

    // Fetch one extra to determine if there's a next page
    const registrations = await db.registration.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, image: true } },
        event: {
          select: {
            id: true,
            title: true,
            paymentAmount: true,
            paymentCurrency: true,
          },
        },
      },
      orderBy,
      take: limit + 1,
    });

    const hasNextPage = registrations.length > limit;
    const items = hasNextPage ? registrations.slice(0, limit) : registrations;
    const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

    const payments = items.map((r: any) => ({
      ...toRegistrationDto(r),
      event: {
        id: r.event.id,
        title: r.event.title,
        paymentAmount: r.event.paymentAmount ?? 0,
        paymentCurrency: r.event.paymentCurrency ?? "INR",
      },
    }));

    return NextResponse.json({
      payments,
      nextCursor,
      total: payments.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
