import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "./db"

const adminEmails = (process.env.ADMIN_EMAILS || "admin@quizmaster.pro")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const isEmailAdmin = (email?: string | null): boolean => {
  if (!email) return false
  return adminEmails.includes(email.toLowerCase())
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any,
  session: { strategy: "jwt" },
  providers: [
    // Google OAuth (configure GOOGLE_CLIENT_ID/SECRET for production)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    // Credentials provider for demo / email-based access
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

        const user = await db.user.upsert({
          where: { email },
          update: { name },
          create: {
            email,
            name,
            role: asAdmin || isEmailAdmin(email) ? "ADMIN" : "STUDENT",
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
      }
      // Re-fetch role from DB on subsequent calls to stay fresh
      if (!token.role && token.email) {
        const dbUser = await db.user.findUnique({ where: { email: token.email } })
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
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
    }
  }
  interface User {
    role?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
  }
}
