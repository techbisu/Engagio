import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { auditLog, type TenantContext } from "@/lib/tenant";

/** Generate a URL-safe slug from a name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** Generate a unique slug — appends a random suffix if the base is taken. */
async function generateUniqueSlug(base: string): Promise<string> {
  const slug = slugify(base) || "org";
  const existing = await db.organization.findUnique({ where: { slug } });
  if (!existing) return slug;
  // Append a 4-char random suffix.
  for (let i = 0; i < 5; i++) {
    const suffix = randomBytes(2).toString("hex");
    const candidate = `${slug}-${suffix}`;
    const clash = await db.organization.findUnique({ where: { slug: candidate } });
    if (!clash) return candidate;
  }
  // Extremely unlikely fallback.
  return `${slug}-${randomBytes(4).toString("hex")}`;
}

/** GET /api/organizations — list all orgs the current user is a member of. */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const memberships = await db.organizationMember.findMany({
      where: { userId: session.user.id, status: "ACTIVE" },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            logoUrl: true,
            primaryColor: true,
            status: true,
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const organizations = memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      description: m.organization.description,
      logoUrl: m.organization.logoUrl,
      primaryColor: m.organization.primaryColor,
      status: m.organization.status,
      role: m.role,
      memberCount: m.organization._count.members,
    }));
    return NextResponse.json({ organizations });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/** POST /api/organizations — create a new organization (caller becomes OWNER). */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const { name, slug, description, industry } = body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    // Resolve the final slug: provided slug (validated) or generated from name.
    let finalSlug: string;
    if (typeof slug === "string" && slug.trim()) {
      finalSlug = slugify(slug);
      if (!finalSlug) {
        return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
      }
      const clash = await db.organization.findUnique({ where: { slug: finalSlug } });
      if (clash) {
        return NextResponse.json(
          { error: "Slug is already taken" },
          { status: 400 }
        );
      }
    } else {
      finalSlug = await generateUniqueSlug(name);
    }

    // Fetch the FREE plan (assign by default to new orgs).
    const freePlan = await db.plan.findUnique({ where: { name: "FREE" } });

    // Create org + OWNER membership in a transaction.
    const org = await db.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: name.trim(),
          slug: finalSlug,
          description:
            typeof description === "string" ? description.trim() || null : null,
          industry: typeof industry === "string" && industry.trim() ? industry.trim() : null,
          planId: freePlan?.id ?? null,
          status: "ACTIVE",
        },
      });
      await tx.organizationMember.create({
        data: {
          organizationId: created.id,
          userId: session.user.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      return created;
    });

    // Build a TenantContext for the audit log entry.
    const ctx: TenantContext = {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name ?? null,
      userRole: (session.user as any).role,
      orgId: org.id,
      orgSlug: org.slug,
      orgName: org.name,
      orgRole: "OWNER",
      isPlatformAdmin: (session.user as any).role === "ADMIN",
    };
    await auditLog(ctx, "ORGANIZATION_CREATED", "Organization", org.id, {
      name: org.name,
      slug: org.slug,
    });

    return NextResponse.json({ organization: org, role: "OWNER" }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
