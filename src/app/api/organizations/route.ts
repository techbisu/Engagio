import { enforceLimit, BODY_LIMITS } from "@/lib/body-limit";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { auditLog, type TenantContext } from "@/lib/tenant";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

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
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/** POST /api/organizations — create a new organization.
 * If adminName/adminEmail/adminPassword are provided (from the registration
 * flow), creates the user + org + membership in one transaction.
 * Otherwise, uses the currently authenticated session user. */
export async function POST(req: NextRequest) {
  try {
    // Org creation is open to unauthenticated callers (registration flow) —
    // rate limit per IP to prevent org spam.
    const rl = await rateLimit(`org-create:${getClientIp(req)}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many organization sign-ups. Try again later." },
        { status: 429 }
      );
    }

    const session = await getServerSession(authOptions);
  const bodyResult = await enforceLimit<{ name?: string; slug?: string; description?: string; industry?: string; adminName?: string; adminEmail?: string; adminPassword?: string }>(req, BODY_LIMITS.STANDARD);
  if (bodyResult.error) return bodyResult.error;
  const body = bodyResult.data;
    const { name, slug, description, industry, adminName, adminEmail, adminPassword } = body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    // ─── Determine the owner user ─────────────────────────────────────
    let ownerId: string;
    let ownerEmail: string;
    let ownerName: string | null;

    if (adminEmail && adminPassword) {
      // Registration flow: create the admin user with a hashed password
      const email = adminEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Invalid admin email" }, { status: 400 });
      }
      if (adminPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }

      // Check if user already exists
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        // If they already have an org membership, tell them to login instead
        const existingMembership = await db.organizationMember.findFirst({
          where: { userId: existing.id },
        });
        if (existingMembership) {
          return NextResponse.json(
            { error: "This email already has an organization. Please login instead." },
            { status: 409 }
          );
        }
        ownerId = existing.id;
        ownerEmail = existing.email;
        ownerName = existing.name;
      } else {
        // Create the admin user with hashed password
        const { hashPassword } = await import("@/lib/password");
        const passwordHash = await hashPassword(adminPassword);
        const newUser = await db.user.create({
          data: {
            email,
            name: adminName?.trim() || email.split("@")[0],
            role: "ADMIN",
            passwordHash,
          },
        });
        ownerId = newUser.id;
        ownerEmail = newUser.email;
        ownerName = newUser.name;
      }
    } else if (session?.user?.id && session.user.email) {
      // Using existing session (user creating org)
      ownerId = session.user.id;
      ownerEmail = session.user.email;
      ownerName = session.user.name ?? null;
    } else {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // ─── Resolve the slug ─────────────────────────────────────────────
    let finalSlug: string;
    if (typeof slug === "string" && slug.trim()) {
      finalSlug = slugify(slug);
      if (!finalSlug) {
        return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
      }
      const clash = await db.organization.findUnique({ where: { slug: finalSlug } });
      if (clash) {
        return NextResponse.json({ error: "Slug is already taken" }, { status: 400 });
      }
    } else {
      finalSlug = await generateUniqueSlug(name);
    }

    // ─── Fetch FREE plan ──────────────────────────────────────────────
    const freePlan = await db.plan.findUnique({ where: { name: "FREE" } });

    // ─── Create org + OWNER membership + subscription ─────────────────
    const org = await db.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: name.trim(),
          slug: finalSlug,
          description: typeof description === "string" ? description.trim() || null : null,
          industry: typeof industry === "string" && industry.trim() ? industry.trim() : null,
          planId: freePlan?.id ?? null,
          status: "ACTIVE",
        },
      });
      await tx.organizationMember.create({
        data: {
          organizationId: created.id,
          userId: ownerId,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      // Create subscription
      if (freePlan) {
        await tx.subscription.create({
          data: {
            organizationId: created.id,
            planId: freePlan.id,
            status: "ACTIVE",
          },
        });
      }
      return created;
    });

    // Build a TenantContext for the audit log entry.
    const ctx: TenantContext = {
      userId: ownerId,
      userEmail: ownerEmail,
      userName: ownerName,
      userRole: "ADMIN",
      orgId: org.id,
      orgSlug: org.slug,
      orgName: org.name,
      orgRole: "OWNER",
      isPlatformAdmin: false,
    };
    await auditLog(ctx, "ORGANIZATION_CREATED", "Organization", org.id, {
      name: org.name,
      slug: org.slug,
    });

    return NextResponse.json({ organization: org, role: "OWNER" }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
