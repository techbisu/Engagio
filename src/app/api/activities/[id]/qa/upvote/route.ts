import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { parseResponseMetadata } from "@/lib/activity-mapper";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/activities/[id]/qa/upvote — participant upvotes a Q&A question.
 *  Body: { responseId }
 *  No deduplication for MVP — simply increments the counter by 1.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const { responseId } = body || {};
    if (typeof responseId !== "string" || !responseId) {
      return NextResponse.json(
        { error: "responseId is required" },
        { status: 400 }
      );
    }

    const existing = await db.activityResponse.findFirst({
      where: { id: responseId, activityId: id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    const meta = parseResponseMetadata(existing.metadata);
    const newCount = (meta.upvotes ?? 0) + 1;
    meta.upvotes = newCount;

    await db.activityResponse.update({
      where: { id: responseId },
      data: { metadata: JSON.stringify(meta) },
    });

    return NextResponse.json({ success: true, upvotes: newCount });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
