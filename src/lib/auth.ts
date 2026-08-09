import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "./db"

// ─── Super Admin ────────────────────────────────────────────────────────────
// The permanent superadmin email. This account always gets platform-admin
// access. Set via env var or use the default.
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || "superadmin@engagio.app")
  .toLowerCase()
  .trim()

// Additional admin emails from env (for org-level admins)
const adminEmails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const isEmailSuperAdmin = (email?: string | null): boolean => {
  if (!email) return false
  return email.toLowerCase().trim() === SUPERADMIN_EMAIL
}

export const isEmailAdmin = (email?: string | null): boolean => {
  if (!email) return false
  const e = email.toLowerCase().trim()
  return e === SUPERADMIN_EMAIL || adminEmails.includes(e)
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any,
  session: { strategy: "jwt" },
  providers: [
    // Google OAuth — for all users (org admins, participants, superadmin)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    // Email-based credentials — for demo + users without Google
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        name: { label: "Name", type: "text", placeholder: "Your name" },
        asAdmin: { label: "Sign in as Admin", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const name = credentials?.name?.trim() || email?.split("@")[0] || "Participant"
        const asAdmin = credentials?.asAdmin === "true"
        if (!email) return null
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null

        // Determine role:
        // - Superadmin email → always ADMIN (platform super admin)
        // - asAdmin flag → ADMIN (for demo org admin)
        // - In ADMIN_EMAILS env → ADMIN
        // - Otherwise → STUDENT (participant)
        const shouldBeAdmin = asAdmin || isEmailAdmin(email)

        const user = await db.user.upsert({
          where: { email },
          update: { name },
          create: {
            email,
            name,
            role: shouldBeAdmin ? "ADMIN" : "STUDENT",
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
    async jwt({ token, user, account }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        // Mark as superadmin for the frontend
        token.isSuperAdmin = isEmailSuperAdmin((user as any).email || token.email)
      }
      // Re-fetch role from DB on subsequent calls to stay fresh
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

// Augment NextAuth types
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
