import { NextAuthOptions, getServerSession as _getServerSession } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
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
// Super Admin is determined by User.platformRole = "SUPERADMIN" in the DB.
// The SUPERADMIN_EMAIL env var is used ONLY during initial seed/migration
// to identify which account should get platformRole=SUPERADMIN.
// After migration, the DB field is the source of truth — not the env var.
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || "superadmin@engagio.app")
  .toLowerCase()
  .trim()

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

// Additional admin emails from env (for org-level admins)
const adminEmails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const isEmailAdmin = (email?: string | null): boolean => {
  if (!email) return false
  const e = email.toLowerCase().trim()
  return e === SUPERADMIN_EMAIL || adminEmails.includes(e)
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any,
  session: { strategy: "jwt" },
  providers: [
    // Google OAuth — for org registration + participant login
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    // Credentials provider — supports BOTH:
    //   1. Password-based auth (for org admins + super admin with passwordHash)
    //   2. Email-only auth (for participants + demo accounts — no password needed)
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text", placeholder: "Your name" },
        asAdmin: { label: "Sign in as Admin", type: "text" },
        totpCode: { label: "TOTP Code", type: "text" },
        skipTotp: { label: "Skip TOTP", type: "text" },
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

        // ─── Lookup existing user ────────────────────────────────────
        const existing = await db.user.findUnique({ where: { email } })

        if (existing) {
          // If user has a password hash → verify password (password-based auth)
          if (existing.passwordHash) {
            if (!password) return null // password required but not provided
            const valid = await bcrypt.compare(password, existing.passwordHash)
            if (!valid) return null // wrong password
          } else {
            // No password hash: credentials provider requires password or OAuth-only
            // Email-only auth is only allowed via Google OAuth provider
            return null
          }

          // ─── TOTP (2FA) check for super admin accounts ──────────────
          // If the user has TOTP enabled AND this is a platform admin
          // (User.platformRole === "SUPERADMIN" from the DB), a valid TOTP
          // code is ALWAYS required. Previously this was keyed to the
          // SUPERADMIN_EMAIL env var and a client-supplied `skipTotp=true`
          // skipped the block and granted a full session without 2FA — a
          // bypass. The client detects TOTP presence via
          // /api/auth/totp/status (before submitting), so there is no
          // legitimate flow that needs to skip this check.
          const requiresTotp =
            existing.totpEnabled && existing.totpSecret && existing.platformRole === "SUPERADMIN"

          if (requiresTotp) {
            if (!totpCode) {
              // Signal to the client that a TOTP code is required.
              // Throw a custom error — no session is ever issued without
              // a valid code.
              throw new Error("TOTP_REQUIRED")
            }
            // Verify the TOTP code
            const { verifyTotpToken } = await import("./totp")
            if (!verifyTotpToken(existing.totpSecret, totpCode)) {
              throw new Error("INVALID_TOTP")
            }
          }

          // User has password and authenticated, or has no password hash (OAuth-only)
          return {
            id: existing.id,
            email: existing.email,
            name: existing.name,
            image: existing.image,
            role: existing.role,
            platformRole: existing.platformRole ?? "USER",
          } as any
        }

        // ─── Create new user ─────────────────────────────────────────
        // Determine role based on context:
        // - Superadmin email → ADMIN (platform super admin)
        // - In ADMIN_EMAILS env → ADMIN
        // - Otherwise → STUDENT (participant)
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
            role: shouldBeAdmin ? "ADMIN" : "STUDENT",
            passwordHash,
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
      if (account?.provider === "google" && user.email) {
        const existing = await db.user.findUnique({ where: { email: user.email } })
        if (!existing) {
          await db.user.create({
            data: {
              email: user.email,
              name: user.name,
              image: user.image,
              role: isEmailAdmin(user.email) ? "ADMIN" : "STUDENT",
            },
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
