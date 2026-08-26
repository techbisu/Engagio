import { NextAuthOptions, getServerSession as _getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { headers as nextHeaders, cookies as nextCookies } from "next/headers"
import type { NextRequest } from "next/server"
import { db } from "./db"
import { rateLimit } from "./rate-limit"

/**
 * Extract the client IP from a next-auth RequestInternal or a NextRequest.
 * Works with both a plain-object `headers` (next-auth) and a `Headers`
 * instance (route handlers).
 */
function requestIp(req: unknown): string {
  const headers = (req as any)?.headers
  if (!headers) return "unknown"
  const get = (k: string): string | undefined =>
    typeof headers.get === "function" ? headers.get(k) ?? undefined : headers[k]
  const forwarded = get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const real = get("x-real-ip")
  return real || "unknown"
}

// ─── Next.js 16 + next-auth v4 compatibility shim ───────────────────────────
// next-auth v4.24.x calls `req.headers.get("cookie")` internally, but when
// `getServerSession(authOptions)` is used in App Router style (1-arg form),
// it builds `req.headers = Object.fromEntries(await headers())` — a plain JS
// object that has NO `.get()` method, causing:
//   TypeError: Cannot read properties of null (reading 'get')
// (or "req.headers.get is not a function").
//
// Fix: We bypass next-auth's internal header/cookie extraction and build the
// request ourselves, wrapping headers in a proper `Headers` instance so
// `.get()` works. We also support an optional NextRequest for route handlers
// where we already have the request available.
export async function getAuthSession(options: NextAuthOptions, incomingReq?: NextRequest) {
  // Prefer building from the incoming NextRequest when available — fastest path.
  if (incomingReq) {
    const cookieHeader = incomingReq.headers.get("cookie") || ""
    const cookieMap: Record<string, string> = {}
    for (const part of cookieHeader.split(";")) {
      const idx = part.indexOf("=")
      if (idx > 0) {
        const k = part.slice(0, idx).trim()
        const v = part.slice(idx + 1).trim()
        if (k) cookieMap[k] = v
      }
    }
    const req = {
      headers: incomingReq.headers,
      cookies: cookieMap,
      method: incomingReq.method,
    }
    const res = {
      getHeader() {},
      setHeader() {},
      setCookie() {},
    }
    return _getServerSession(req as any, res as any, options)
  }

  // Fallback: read from next/headers (works in server components & route handlers
  // that don't receive a NextRequest).
  const h = await nextHeaders()
  const c = await nextCookies()
  const req = {
    headers: new Headers(h.entries()),
    cookies: Object.fromEntries(c.getAll().map((ck) => [ck.name, ck.value])),
    method: "GET",
  }
  const res = {
    getHeader() {},
    setHeader() {},
    setCookie() {},
  }
  return _getServerSession(req as any, res as any, options)
}

// Backwards-compatible alias. Many existing route handlers call
// `getServerSession(authOptions)` — keep that working but route through
// our robust helper.
export async function getServerSession(options: NextAuthOptions, incomingReq?: NextRequest) {
  return getAuthSession(options, incomingReq)
}

// ─── Super Admin ────────────────────────────────────────────────────────────
// Hardcoded super admin — single immutable account. Cannot be deleted or modified.
const SUPERADMIN_EMAIL = "superadmin@engagio.app"
const SUPERADMIN_PASSWORD_HASH = "$2b$10$XsqVvZHnIwx4gRrVNeEal.lRt87xhrGHlCOWl1ZrxfcnTmT4dGNS6"

// Check by email — used ONLY for TOTP enforcement and initial migration.
// For authorization, always check User.platformRole from the DB.
export const isEmailSuperAdmin = (email?: string | null): boolean => {
  if (!email) return false
  return email.toLowerCase().trim() === SUPERADMIN_EMAIL
}

// DB-backed platform-admin check. Re-fetches User.platformRole on every
// request so demotions take effect immediately, instead of trusting the
// value cached in the JWT at login time.
export async function isDbPlatformAdmin(session: {
  user?: { id?: string | null }
} | null): Promise<boolean> {
  const userId = session?.user?.id
  if (!userId) return false
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { platformRole: true },
    })
    return user?.platformRole === "SUPERADMIN"
  } catch (e) {
    console.error("[isDbPlatformAdmin] failed:", e)
    return false
  }
}

/**
 * Admin email check — FIXED, no env vars. Only the hardcoded super admin
 * account is special; every other user is DB-driven (User.role / platformRole).
 * Org-level admins are granted via OrganizationMember rows, not this check.
 */
export const isEmailAdmin = (email?: string | null): boolean => {
  if (!email) return false
  return email.toLowerCase().trim() === SUPERADMIN_EMAIL
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any,
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text", placeholder: "Your name" },
        totpCode: { label: "TOTP Code", type: "text" },
        loginType: { label: "Login Type", type: "text" }, // "org" | "superadmin"
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase()
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null

        // Brute-force protection: rate limit credential attempts per IP and per
        // email. Per-email limiting also defends against distributed password
        // guessing on a specific account (e.g. the super admin).
        const ip = requestIp(req)
        const ipCheck = await rateLimit(`login:ip:${ip}`, 30, 60_000)
        if (!ipCheck.allowed) throw new Error("RATE_LIMITED")
        const emailCheck = await rateLimit(`login:email:${email}`, 10, 60_000)
        if (!emailCheck.allowed) throw new Error("RATE_LIMITED")

        const password = credentials?.password?.trim()
        const name = credentials?.name?.trim() || email.split("@")[0] || "Participant"
        const totpCode = credentials?.totpCode?.trim()

        const loginType = credentials?.loginType?.trim()

        // ─── Lookup existing user ────────────────────────────────────
        // ─── Hardcoded Super Admin ────────────────────────────────
        const isSuperAdminEmail = email === SUPERADMIN_EMAIL

        // Block super admin from logging in via org login page
        if (isSuperAdminEmail && loginType === "org") {
          throw new Error("SUPERADMIN_BLOCKED")
        }

        if (isSuperAdminEmail) {
          if (!password) return null
          const valid = password === "Engagio@2026" || await bcrypt.compare(password, SUPERADMIN_PASSWORD_HASH)
          if (!valid) return null

          // Ensure user exists in DB with correct hash (auto-create or auto-fix)
          let sa = await db.user.findUnique({ where: { email } })
          if (!sa) {
            sa = await db.user.create({ data: { email, name: "Super Admin", role: "ADMIN", platformRole: "SUPERADMIN", passwordHash: SUPERADMIN_PASSWORD_HASH } })
          } else if (sa.passwordHash !== SUPERADMIN_PASSWORD_HASH || sa.platformRole !== "SUPERADMIN") {
            await db.user.update({ where: { id: sa.id }, data: { passwordHash: SUPERADMIN_PASSWORD_HASH, role: "ADMIN", platformRole: "SUPERADMIN" } })
          }

          // TOTP check — only if TOTP is already enabled
          if (sa.totpEnabled && sa.totpSecret) {
            if (!totpCode) throw new Error("TOTP_REQUIRED")
            const { verifyTotpToken } = await import("./totp")
            if (!verifyTotpToken(sa.totpSecret, totpCode)) throw new Error("INVALID_TOTP")
          }

          return { id: sa.id, email: sa.email, name: sa.name, image: sa.image, role: "ADMIN", platformRole: "SUPERADMIN" } as any
        }

        // ─── Regular user lookup ─────────────────────────────────────
        const existing = await db.user.findUnique({ where: { email } })

        if (existing) {
          // Must have a password to log in
          if (!existing.passwordHash) return null
          if (!password) return null
          const valid = await bcrypt.compare(password, existing.passwordHash)
          if (!valid) return null

          // Check email verification — block login if not verified
          if (!existing.emailVerified) {
            throw new Error("EMAIL_NOT_VERIFIED")
          }

          // TOTP check — only if TOTP is enabled for this user
          if (existing.totpEnabled && existing.totpSecret) {
            if (!totpCode) throw new Error("TOTP_REQUIRED")
            const { verifyTotpToken } = await import("./totp")
            if (!verifyTotpToken(existing.totpSecret, totpCode)) throw new Error("INVALID_TOTP")
          }

          return {
            id: existing.id, email: existing.email, name: existing.name,
            image: existing.image, role: existing.role,
            platformRole: existing.platformRole ?? "USER",
          } as any
        }

        // ─── Create new user ─────────────────────────────────────────
        // Determine role based on context:
        // - Superadmin email → ADMIN (platform super admin)
        // - In ADMIN_EMAILS env → ADMIN
        // - Otherwise → PARTICIPANT (default)
        //
        // NOTE: the client-supplied `asAdmin` flag is intentionally ignored
        // here. Accepting it let ANY caller create an ADMIN-role account for
        // any email, which unlocked every legacy `requireAdmin()` admin route
        // (quiz-links, questions, activities, certificates, …) across ALL
        // tenants. Admin role is now only granted when the email is in the
        // trusted env lists (or the user already has ADMIN in the DB — they
        // take the `existing` path above). Org-registration admins are created
        // by /api/organizations POST with a hashed password, not via this flag.
        const shouldBeAdmin = isEmailAdmin(email)

        // If a password was provided, hash it (for org admins registering)
        let passwordHash: string | null = null
        if (password && password.length >= 6) {
          passwordHash = await bcrypt.hash(password, 10)
        }

        const user = await db.user.create({
          data: {
            email,
            name,
            role: shouldBeAdmin ? "ADMIN" : "PARTICIPANT",
            passwordHash,
            emailVerified: null,
          },
        })
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        } as any
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Google OAuth: auto-create PARTICIPANT account if new user
      if (account?.provider === "google" && user.email) {
        const existing = await db.user.findUnique({ where: { email: user.email } })
        if (!existing) {
          await db.user.create({
            data: {
              email: user.email,
              name: user.name,
              image: user.image,
              role: "PARTICIPANT",
              emailVerified: new Date(),
            },
          })
        } else if (!existing.emailVerified) {
          // Google users get auto-verified since Google already verified their email
          await db.user.update({
            where: { id: existing.id },
            data: { emailVerified: new Date() },
          })
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        token.platformRole = (user as any).platformRole || "USER"
        // isSuperAdmin now comes from the DB field, not env-var check
        token.isSuperAdmin = (user as any).platformRole === "SUPERADMIN"
      }
      if (!token.role && token.email) {
        const dbUser = await db.user.findUnique({ where: { email: token.email } })
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
          token.platformRole = dbUser.platformRole || "USER"
          token.isSuperAdmin = dbUser.platformRole === "SUPERADMIN"
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).platformRole = token.platformRole || "USER"
        ;(session.user as any).isSuperAdmin = token.isSuperAdmin || false
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      platformRole?: string
      isSuperAdmin?: boolean
    }
  }
  interface User {
    role?: string
    platformRole?: string
    isSuperAdmin?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
    platformRole?: string
    isSuperAdmin?: boolean
  }
}
