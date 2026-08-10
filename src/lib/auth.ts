import { NextAuthOptions, getServerSession as _getServerSession } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { headers as nextHeaders, cookies as nextCookies } from "next/headers"
import type { NextRequest } from "next/server"
import { db } from "./db"

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
// Super Admin is NOT auto-detected from email. It's a separate login at
// /?view=superadmin. The SUPERADMIN_EMAIL env var is used ONLY to identify
// which email CAN access the super admin login page — it does NOT grant
// super admin privileges automatically.
//
// For production: create a super admin user in the DB with role=ADMIN,
// then sign in via /?view=superadmin with that email + password.
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || "superadmin@engagio.app")
  .toLowerCase()
  .trim()

export const isEmailSuperAdmin = (email?: string | null): boolean => {
  if (!email) return false
  return email.toLowerCase().trim() === SUPERADMIN_EMAIL
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
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null

        const password = credentials?.password?.trim()
        const name = credentials?.name?.trim() || email.split("@")[0] || "Participant"
        const asAdmin = credentials?.asAdmin === "true"

        // ─── Lookup existing user ────────────────────────────────────
        const existing = await db.user.findUnique({ where: { email } })

        if (existing) {
          // If user has a password hash → verify password (password-based auth)
          if (existing.passwordHash) {
            if (!password) return null // password required but not provided
            const valid = await bcrypt.compare(password, existing.passwordHash)
            if (!valid) return null // wrong password
          }
          // If no password hash → email-only auth (participant/demo), allow
          return {
            id: existing.id,
            email: existing.email,
            name: existing.name,
            image: existing.image,
            role: existing.role,
          } as any
        }

        // ─── Create new user ─────────────────────────────────────────
        // Determine role based on context:
        // - Superadmin email → ADMIN (platform super admin)
        // - asAdmin flag → ADMIN (org registration/login page)
        // - In ADMIN_EMAILS env → ADMIN
        // - Otherwise → STUDENT (participant)
        const shouldBeAdmin = asAdmin || isEmailAdmin(email)

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
        token.isSuperAdmin = isEmailSuperAdmin((user as any).email || token.email)
      }
      if (!token.role && token.email) {
        const dbUser = await db.user.findUnique({ where: { email: token.email } })
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
          token.isSuperAdmin = isEmailSuperAdmin(dbUser.email)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).isSuperAdmin = token.isSuperAdmin || false
      }
      return session
    },
  },
  pages: {
    signIn: "/?view=login",
    error: "/?view=login",
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
      isSuperAdmin?: boolean
    }
  }
  interface User {
    role?: string
    isSuperAdmin?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
    isSuperAdmin?: boolean
  }
}
