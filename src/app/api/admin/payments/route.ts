import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import type { PaymentStatus, RegistrationDto } from "@/types";

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
 *
 * Ordering:
 *   - For PENDING_VERIFICATION: createdAt desc (newest submissions first).
 *   - For COMPLETED / REJECTED: verifiedAt desc.
 *   - For ALL: verifiedAt desc (or createdAt desc when verifiedAt is null).
 *
 * Returns: `{ payments: RegistrationDto[], total: number }`.
 * Each payment DTO also includes an `event` object with paymentAmount /
 * paymentCurrency / title for display convenience. (We attach these to the
 * returned DTO via the `data` field — clients consume `payment.event`.)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") || "PENDING_VERIFICATION").toUpperCase();
    const eventId = url.searchParams.get("eventId");

    // Build where clause.
    const where: any = {
      paymentStatus: { not: "NONE" },
    };
    if (statusParam !== "ALL") {
      // Only allow the documented statuses.
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

    // Order: pending → createdAt desc; completed/rejected → verifiedAt desc;
    // ALL → verifiedAt desc (with createdAt desc fallback for null verifiedAt).
    let orderBy: any = { createdAt: "desc" };
    if (
      statusParam === "COMPLETED" ||
      statusParam === "REJECTED" ||
      statusParam === "ALL"
    ) {
      orderBy = [{ verifiedAt: "desc" }, { createdAt: "desc" }];
    }

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
      take: 200,
    });

    // Map to DTOs with attached event info.
    const payments: (RegistrationDto & {
      event: {
        id: string;
        title: string;
        paymentAmount: number;
        paymentCurrency: string;
      };
    })[] = registrations.map((r: any) => ({
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
      total: payments.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 },
    );
  }
}
