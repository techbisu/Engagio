import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/tenant";
import { randomBytes } from "crypto";

/** Generate a unique pass number: GP-YYYY-XXXXXX */
function generatePassNumber(): string {
  const year = new Date().getFullYear();
  const hash = randomBytes(3).toString("hex").toUpperCase();
  return `GP-${year}-${hash}`;
}

/** Generate a 32-char hex verify token */
function generateVerifyToken(): string {
  return randomBytes(16).toString("hex");
}

/** GET /api/gate-passes?eventId=xxx — list gate passes for an event (org admin) */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const eventId = req.nextUrl.searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    const ctx = await requireTenantContext(req);
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const passes = await db.gatePass.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      include: {
        event: { select: { id: true, title: true, slug: true, startDate: true, endDate: true } },
      },
    });

    return NextResponse.json({ gatePasses: passes });
  } catch (e) {
    console.error("[GET /api/gate-passes] error:", e);
    return NextResponse.json({ error: "Internal Server Error", detail: "An unexpected error occurred" }, { status: 500 });
  }
}

/** POST /api/gate-passes — generate a gate pass for a registered participant */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { eventId, userId, registrationId, participantName, participantEmail, participantData } = body;

    if (!eventId || !userId) {
      return NextResponse.json({ error: "eventId and userId are required" }, { status: 400 });
    }

    const ctx = await requireTenantContext(req);
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    // Check if a gate pass already exists for this (eventId, userId)
    const existing = await db.gatePass.findFirst({
      where: { eventId, userId },
    });
    if (existing) {
      return NextResponse.json({ gatePass: existing, alreadyExists: true }, { status: 200 });
    }

    // Get participant details from the user record if not provided
    let name = participantName;
    let email = participantEmail;
    if (!name || !email) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
      if (user) {
        name = name || user.name || user.email.split("@")[0];
        email = email || user.email;
      }
    }

    const gatePass = await db.gatePass.create({
      data: {
        eventId,
        userId,
        registrationId: registrationId || null,
        passNumber: generatePassNumber(),
        verifyToken: generateVerifyToken(),
        participantName: name || "Participant",
        participantEmail: email || "",
        participantData: JSON.stringify(participantData || {}),
        generatedBy: session.user.id,
        generatedAutomatically: false,
      },
    });

    return NextResponse.json({ gatePass }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/gate-passes] error:", e);
    return NextResponse.json({ error: "Internal Server Error", detail: "An unexpected error occurred" }, { status: 500 });
  }
}
