# Engagio

Interactive Event & Learning Platform — **Engage. Learn. Connect.**

Create events, manage registration, engage participants with live activities (polls, quizzes, Q&A, voting), run assessments with anti-cheat + AI proctoring, issue certificates with QR verification, and share achievements — all in one multi-tenant SaaS platform.

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Prisma 6** + **PostgreSQL** (Neon / Supabase / standard Postgres)
- **Tailwind CSS 4** + **shadcn/ui**
- **Cloudinary** (image storage — base64 fallback in dev)
- **Resend** (email — non-blocking if not configured)
- **Vercel** (deployment)

## Quick Start (Local Dev)

```bash
# 1. Install dependencies
bun install

# 2. Set up environment
cp .env.example .env
# Edit .env — set DATABASE_URL to a Neon (or local Postgres) connection string
# Generate NEXTAUTH_SECRET: openssl rand -base64 32

# 3. Push schema to database
bun run db:push

# 4. Run tenancy migration (creates Default Org + seeds plans)
bun run scripts/migrate-tenancy.ts

# 5. Seed demo data (optional — admin/participant accounts + sample event)
bun run scripts/seed.ts

# 6. Start dev server
bun run dev
```

### Demo Logins (after seeding)

| Role | Email | Password | Access |
|------|-------|----------|--------|
| Admin | `admin@quizmaster.pro` | _any_ | Admin panel |
| Participant | `student@quizmaster.pro` | _any_ | Participant dashboard |

Or use the **"Quick Demo"** tab on the login screen.

## Deploy to Vercel + Neon

### 1. Create a Neon Database

1. Go to [neon.tech](https://neon.tech) → Sign up (free)
2. Create a project → copy the connection string
3. It looks like: `postgresql://user:pass@host.neon.tech/db?sslmode=require`

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import `techbisu/Engagio` from GitHub
3. Add these environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon connection string (with `?sslmode=require`) |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` (your Vercel URL) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_SECRET` | Same as `NEXTAUTH_SECRET` |
| `ADMIN_EMAILS` | Your admin email(s) |
| `BASE_DOMAIN` | `your-app.vercel.app` |
| `PAYMENT_ENCRYPTION_KEY` | Any random string |

4. Click **Deploy**

### 3. Run Database Migration

After the first successful deploy, run from your local machine:

```bash
# Set DATABASE_URL to your Neon connection string
export DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"

# Push schema
bun run db:push

# Run tenancy migration
bun run scripts/migrate-tenancy.ts

# Seed demo data (optional)
bun run scripts/seed.ts
```

### 4. Optional: Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create OAuth credentials
2. Authorized redirect URI: `https://YOUR_DOMAIN/api/auth/callback/google`
3. Add `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` to Vercel

### 5. Optional: Cloudinary

1. [cloudinary.com](https://cloudinary.com) → Sign up → copy credentials
2. Add `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` to Vercel
3. Without Cloudinary, images are stored as base64 (works but uses more DB space)

### 6. Optional: Resend Email

1. [resend.com](https://resend.com) → Sign up → create API key
2. Add `RESEND_API_KEY` + `EMAIL_FROM` to Vercel
3. Without Resend, emails are skipped (non-blocking)

## Features

- **Multi-tenant SaaS** — Organizations, members, RBAC, custom domains, billing
- **Events** — Landing pages, registration, payment, QR check-in
- **Activities** — Polls, Live Quiz, Q&A, Voting, Surveys, Feedback, Knowledge Checks
- **Question Bank** — 5 types (MCQ, True/False, Fill-blank, Matching, Coding), CSV import
- **Assessments** — 13 security toggles, AI Proctor, negative marking, random questions
- **Results** — Instant or publish-later, per-category analysis, leaderboard, PNG report
- **Certificates** — 5 templates, Canvas-rendered PNG, QR verification, public verify page
- **Shareable Achievement Cards** — Social sharing (WhatsApp/LinkedIn/Facebook/X), OG metadata
- **i18n** — Locale-aware date/currency formatting, translation-ready
- **Multi-currency** — INR/USD/EUR/GBP plan pricing
- **Themes** — Light/Dark/System
- **SEO** — Sitemap, robots, JSON-LD, OG metadata

## License

MIT
