import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { db } from "./db"

// ─── Super Admin ────────────────────────────────────────────────────────────
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
