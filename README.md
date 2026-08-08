# Engagio — Workshop & Event Quiz Platform

A complete, production-ready Next.js 16 quiz/exam platform with admin panel, Gmail auth, anti-cheat protection, CSV question import, shareable quiz links, and live analytics. Built with TypeScript, Tailwind CSS 4, shadcn/ui, Prisma, and NextAuth.

![Stack](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8) ![Prisma](https://img.shields.io/badge/Prisma-6-2d3748) ![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### For Students
- 🔐 **Gmail / email login** (NextAuth Google OAuth + email-based demo auth)
- 🎯 **Unique quiz links** per event/workshop (e.g. `?quiz=R85XSX`)
- 🔀 **Random question order** — every student sees a different shuffle
- ⏱️ **Timed quizzes** with auto-submit on timeout
- 📊 **Instant results** with per-question review & explanations
- 📜 **Attempt history** on the student dashboard

### For Admins
- 📊 **Live dashboard** with stats, score distribution, top events
- 📅 **Event management** (create/edit/delete, dates, status)
- ❓ **Question bank** per event with add/edit/delete + drag-order
- 📥 **CSV bulk import** — upload a `.csv` and parse hundreds of questions
- 🔗 **Quiz link generator** with configurable shuffle, time limit, attempts, pass threshold
- 📋 **Attempts table** with filters, CSV export, per-attempt detail (anti-cheat metrics, IP, UA)
- 👥 **Users list** derived from attempts

### Anti-Cheat Protection
- 🖥️ **Fullscreen lock** (request + re-enter prompt on exit)
- 👁️ **Tab-switch detection** (visibility change counter)
- 🚫 **Copy / cut / right-click prevention** (with counters)
- ⏰ **Auto-submit on timeout** (1-minute grace period)
- 📝 **beforeunload guard** to prevent accidental page-leave
- 🌐 **IP + user-agent logging** per attempt
- 🚨 **Cheat-detection status** on submitted attempts (still records the score)

### Platform
- 🎨 **Modern, responsive UI** — emerald/teal palette, glassmorphism, Framer Motion animations
- 📱 **Mobile-first** with adaptive layouts (sidebar → drawer, table → cards)
- 🌗 **Dark mode ready** (CSS variables; toggling can be wired via next-themes)
- 🦶 **Sticky footer** on all pages
- ⚡ **Standalone output** for optimal Vercel deployment

## 🚀 Quick Start (Local Dev)

### Prerequisites
- [Bun](https://bun.sh) ≥ 1.3 (or Node 20+ / npm)
- A Vercel project (optional, only for deployment)

### 1. Install dependencies
```bash
bun install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env and set NEXTAUTH_SECRET to a strong random string:
#   openssl rand -base64 32
```

### 3. Initialize the database
```bash
bun run db:push      # Create SQLite schema
bun run db:seed      # Seed demo data (admin, student, event, 10 questions, quiz link)
```

After seeding, note the printed **quiz slug** (e.g. `R85XSX`) — you can use it to take the quiz.

### 4. Run the dev server
```bash
bun run dev
```
Open the preview at the URL shown in your terminal (default `http://localhost:3000`).

### 5. Try it out

| Role | Email | Password | What you'll see |
|------|-------|----------|-----------------|
| Admin | `admin@quizmaster.pro` | _any_ | Admin panel: dashboard, events, questions, links, attempts |
| Student | `student@quizmaster.pro` | _any_ | Student dashboard with attempt history |

Or use the **"Quick Demo"** tab on the login screen to sign in as Admin or Student with one click.

To take the demo quiz, sign in as a student and enter the seeded slug (`R85XSX` or whichever was printed by the seed script), or visit `/?quiz=R85XSX` directly.

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Single-page app shell — view switching via Zustand store
│   ├── layout.tsx            # Root layout with NextAuth SessionProvider + TanStack Query
│   ├── globals.css           # Tailwind 4 + emerald theme tokens
│   └── api/
│       ├── auth/[...nextauth]/route.ts   # NextAuth handler
│       ├── me/route.ts                   # Current session info
│       ├── events/[...]                  # Event CRUD (admin)
│       ├── questions/[...]                # Question CRUD + /import (admin)
│       ├── quiz-links/[...]              # Link CRUD + /by-slug/[slug] (public)
│       ├── attempts/{start,submit,list,[id]}  # Attempt lifecycle
│       └── analytics/[...]               # Admin dashboard + per-event analytics
├── components/
│   ├── shared/               # SiteHeader, SiteFooter, BrandLogo, ConfirmDialog, etc.
│   ├── landing/              # Hero, Features, HowItWorks, FAQ, CtaSection
│   ├── auth/                 # LoginForm (Tabs: Sign In / Quick Demo)
│   ├── admin/                # AdminShell + Dashboard, EventsManager, QuestionsManager,
│   │                         # LinksManager, AttemptsTable, UsersList, StatCard
│   ├── student/              # StudentShell, StudentDashboard, QuizStart, api helpers
│   ├── quiz/                 # QuizRunner, QuestionCard, QuizTimer, QuestionNavigator, QuizResults
│   └── providers.tsx         # NextAuth + TanStack Query providers
├── hooks/
│   ├── use-anti-cheat.ts     # Tab/copy/right-click/fullscreen listeners + counters
│   ├── use-toast.ts
│   └── use-mobile.ts
├── lib/
│   ├── db.ts                 # Prisma client singleton
│   ├── auth.ts               # NextAuth config (Google + Credentials, JWT, role sync)
│   ├── utils.ts              # cn, generateQuizSlug, shuffleArray, formatDate, etc.
│   └── csv.ts                # parseCsvQuestions, buildCsvTemplate
├── store/
│   └── app-store.ts          # Zustand store + URL sync (deep-linking)
└── types/
    └── index.ts              # Shared DTOs (EventDto, QuestionDto, etc.)

prisma/
├── schema.prisma             # SQLite schema (local dev)
└── schema.postgres.prisma    # Postgres schema for Vercel production

scripts/
└── seed.ts                   # Demo data: admin + student users, event, 10 questions, quiz link

.github/workflows/
├── ci.yml                    # Lint on PRs
└── deploy.yml                # Build + deploy to Vercel on push to main

vercel.json                   # Vercel project config (env var linking)
.env.example                   # All required env vars
```

## 🗄️ Database

The app uses **Prisma** with **SQLite** for local development (zero-config, file-based).

For **Vercel production**, switch to Postgres (recommended: [Neon](https://neon.tech) free tier):

1. Create a Postgres database and copy its connection string.
2. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
   (Or replace the file with `prisma/schema.postgres.prisma`.)
3. Set `DATABASE_URL` in your Vercel project settings to the Postgres URL.
4. Run migrations: `bunx prisma migrate deploy` (in CI or once locally against the prod DB).
5. Seed: `bun run db:seed` (will create the demo admin, event, and quiz link).

## 🔐 Authentication

### Email-based (Demo mode, default)
The Credentials provider lets anyone sign in with any email + name. The role (Admin/Student) is determined by:
1. The `ADMIN_EMAILS` env var (comma-separated, case-insensitive).
2. Or by using the "Quick Demo as Admin" button on the login screen.

### Google OAuth (Production)
1. Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Set the authorized redirect URI to:
   ```
   https://YOUR_DOMAIN/api/auth/callback/google
   ```
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in your env (or Vercel project settings).
4. Set `NEXT_PUBLIC_GOOGLE_ENABLED=true` to show the "Continue with Google" button.

### Promoting a user to admin after signup
Either:
- Add their email to `ADMIN_EMAILS`, or
- Update the database directly: `UPDATE User SET role='ADMIN' WHERE email='you@example.com'`

## 📥 CSV Question Import Format

The import dialog accepts a CSV with these columns (header row required):

| question | option_a | option_b | option_c | option_d | correct_answer | marks | explanation |
|----------|----------|----------|----------|----------|----------------|-------|-------------|
| What is 2+2? | 3 | 4 | 5 | 6 | B | 1 | Basic arithmetic |

- `correct_answer`: a letter (`A`-`D`) or 1-based index (`1`-`4`).
- `option_c` and `option_d` are optional (min 2 options).
- `marks` and `explanation` are optional (default marks = 1).
- Quoted fields with commas are supported: `"What is ""hello""?"`.

You can download a template from the Import dialog itself.

## 🚢 Deploy to Vercel

### Option A: Connect via Vercel Dashboard (recommended)

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Vercel auto-detects Next.js — keep the defaults.
4. Add the environment variables (see `.env.example`):
   - `DATABASE_URL` — your Postgres connection string
   - `NEXTAUTH_URL` — `https://your-project.vercel.app`
   - `NEXTAUTH_SECRET` — a strong random string (`openssl rand -base64 32`)
   - `ADMIN_EMAILS` — your admin email(s)
   - (optional) `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_ENABLED`
5. Click **Deploy**.
6. Once deployed, run the seed once: `DATABASE_URL=... bun run db:seed` (locally, against the prod DB) — or set up a one-off Vercel job.

### Option B: Deploy via GitHub Actions (CI/CD)

The included `.github/workflows/deploy.yml` automatically builds and deploys to Vercel on every push to `main`/`master`.

**Setup:**
1. Push the repo to GitHub.
2. Import the project on Vercel once (this creates the project ID).
3. In your GitHub repo settings → **Secrets and variables → Actions**, add:
   - `VERCEL_TOKEN` — a Vercel access token (create at [vercel.com/account/tokens](https://vercel.com/account/tokens))
   - `VERCEL_ORG_ID` — your Vercel org/user ID (found in `.vercel/project.local` after `vercel link`, or in your Vercel dashboard settings)
   - `VERCEL_PROJECT_ID` — the Vercel project ID (same as above)
4. Push to `main` — the workflow will build & deploy automatically.

The included `.github/workflows/ci.yml` runs ESLint on every PR.

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start dev server on port 3000 |
| `bun run build` | Build for production (standalone output) |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push Prisma schema to DB (destructive, dev only) |
| `bun run db:generate` | Regenerate Prisma Client |
| `bun run db:migrate` | Create & apply a Prisma migration |
| `bun run db:seed` | Seed demo data (admin, student, event, questions, quiz link) |

## 🎯 Deep Linking

Quiz links are shareable URLs of the form `https://your-domain/?quiz=SLUG`. When a student opens one:
- If they're logged in → they go straight to the pre-quiz screen.
- If not → they're sent to login, then redirected to the quiz.

The admin panel and student dashboard also have shareable URLs:
- `?view=admin` → admin panel
- `?view=student` → student dashboard
- `?view=login` → login screen

## 🛡️ Anti-Cheat Notes

- The anti-cheat counters (`tabSwitches`, `fullscreenExits`, `copyAttempts`, `rightClicks`) are sent to the server on submit and stored on the attempt.
- An attempt is flagged as `CHEAT_DETECTED` if any of: tabSwitches > 5, fullscreenExits > 2, copyAttempts > 0, rightClicks > 3.
- An attempt is flagged as `TIMEOUT` if `timeTaken > timeLimit * 60 + 60` (1-minute grace).
- The score is still recorded in both cases — flagging just metadata.
- Fullscreen requires a user gesture and may be blocked in iframes; the quiz shows a non-blocking overlay and remains usable.

## 📄 License

MIT — feel free to fork, modify, and deploy.
