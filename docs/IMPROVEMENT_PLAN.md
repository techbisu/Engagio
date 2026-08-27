# Engagio — Production-Ready SaaS Improvement Plan

## Complete Analysis & Action Items

---

## 1. AUTHENTICATION & LOGIN FLOW IMPROVEMENTS

### 1.1 Current Issues

**Organization Registration (`/org-register`):**
- ❌ No Google login option — only email+password (Step 1)
- ❌ Link to `/register?mode=admin` is dead — that page doesn't handle admin registration
- ❌ If user already has a Google account but no password, they can't register an org
- ✅ Step 2 (org details) works correctly with auto-slug generation

**Organization Login (`/login`):**
- ❌ No Google login button — only email+password
- ✅ Email verification enforcement works
- ✅ Forgot/reset password flow works
- ✅ Post-login routing via `useRouteAfterAuth` is correct

**Participant Login:**
- ✅ Google login available on all participant entry points (event page, quiz page, activity page)
- ✅ Email-only login (no password) works for participants
- ✅ Google OAuth auto-links to existing users or creates new ones

### 1.2 Required Changes

#### A. Add Google Login to Organization Registration
**File:** `src/components/organization/org-onboarding.tsx`

Add a "Continue with Google" button on Step 1 alongside the email+password form:
```
[Continue with Google] ← new
───── OR ─────
[Email] [Password] [Sign In]
```

- Import `ParticipantGoogleLogin` or create an `OrgGoogleLogin` component
- On Google success → check if user has `passwordHash` (if not, they need to set one for billing)
- If no password → show "Set a password for your account" step between Step 1 and Step 2
- If password exists → skip to Step 2 directly

#### B. Add Google Login to Organization Login
**File:** `src/components/auth/login-form.tsx`

Add Google button above the email+password form:
```
[Continue with Google] ← new
───── OR ─────
[Email] [Password] [Sign In]
[Forgot password?]
```

- On Google success → `useRouteAfterAuth` handles routing (already works)
- No need for email pre-check — Google OAuth + routeAfterAuth already checks org membership

#### C. Remove Dead Link
**File:** `src/components/organization/org-onboarding.tsx` line 376

Remove or fix the `/register?mode=admin` link — it should point to `/org-register` itself or be removed since the user is already on the org registration page.

#### D. Seamless Flow Summary
```
ORG REGISTRATION:
  /org-register → Step 1: [Google] or [Email+Password] → Step 2: Org details → /org/{slug}/admin

ORG LOGIN:
  /login → [Google] or [Email+Password] → /org/{slug}/admin (or /no-org)

PARTICIPANT LOGIN (on event/quiz page):
  /event/{slug} → [Google] or [Email only] → /register?event={id} → /org/{slug}/participant/dashboard
  /quiz/{slug} → [Google] or [Email only] → Quiz start screen
```

---

## 2. DASHBOARD SEPARATION

### 2.1 Current State

**Organization Admin Dashboard (`/org/{slug}/admin`):**
- 11 tabs: Dashboard, Events, Questions, Quiz Links, Activities, Attempts, Payments, Results & Certs, Gate Passes, Users, Certificates
- ✅ Properly org-scoped via URL + header

**Participant Dashboard:**
- `/dashboard` — generic, shows all attempts across all orgs
- `/org/{slug}/participant/dashboard` — org-scoped, shows only that org's events
- ❌ Both render the same `StudentDashboard` component — no visual distinction
- ❌ No "Registered Events" list with action buttons in the dashboard
- ❌ Dashboard shows attempt history but NOT registered events with "Start Activity" buttons

### 2.2 Required Changes

#### A. Visual Separation
- **Admin Dashboard:** Dark sidebar with org name, logo, 11 nav tabs
- **Participant Dashboard:** Lighter theme, event-focused layout, no admin chrome

#### B. Participant Dashboard — Registered Events Section
Add a "My Registered Events" card section at the top of the dashboard:

```
┌─────────────────────────────────────┐
│ My Registered Events                │
├─────────────────────────────────────┤
│ [Event Card]     [Event Card]       │
│ Medical Summit   Workshop 2026      │
│ 3 activities     1 activity         │
│ [Start Quiz]     [Start Poll]       │
│ [View Results]   [View Results]     │
└─────────────────────────────────────┘
```

**File:** `src/components/student/student-dashboard.tsx`
- Fetch `/api/me/activities` (already exists)
- Show each registered event as a card with:
  - Event name + org name
  - Number of active activities
  - Action buttons: Start Quiz, View Results, View Certificate
  - Status badge: LIVE / UPCOMING / COMPLETED

#### C. Participant Dashboard — Activity Actions
Each activity in the "Current & Upcoming Activities" section needs:
- **Start** button (for LIVE activities) → navigates to quiz/activity
- **View** button (for UPCOMING activities) → shows details
- **Results** button (for completed attempts) → shows results if published

---

## 3. REGISTRATION FORM IMPROVEMENTS

### 3.1 Current Issues

- ❌ Participant name and email are NOT auto-filled from the logged-in user's profile
- ❌ The form shows raw field IDs instead of user-friendly labels in some cases
- ✅ Required field validation works
- ✅ Already-registered check works (shows "Already registered" message)

### 3.2 Required Changes

#### A. Auto-fill User Data
**File:** `src/components/public/event-registration-form.tsx`

The form currently initializes `formData` as an empty object. It should:
1. Accept a `user` prop (the logged-in user)
2. Auto-fill any field with `type: "email"` → `user.email`
3. Auto-fill any field with `label` containing "name" or "Name" → `user.name`
4. Auto-fill any field with `type: "tel"` → `user.phone` (if available)

```tsx
// In the component:
const { user } = useCurrentUser()

// Auto-fill on mount
React.useEffect(() => {
  if (!data || !user) return
  const prefilled: Record<string, string | number | boolean> = {}
  data.forEach((field) => {
    if (field.type === 'email' && user.email) prefilled[field.id] = user.email
    if (field.label.toLowerCase().includes('name') && user.name) prefilled[field.id] = user.name
  })
  setFormData(prev => ({ ...prefilled, ...prev }))
}, [data, user])
```

#### B. Better Field Rendering
- Show field label as the input label (not the field ID)
- Show placeholder text for each field type
- Make email field read-only if auto-filled (user can't change their email)

---

## 4. QUIZ RESULT VISIBILITY

### 4.1 Current Issues

**When `publishResults = true` (results NOT instant):**
- ✅ Quiz results page: Score, percentage, pass/fail are HIDDEN until published (correct)
- ✅ Share achievement button: HIDDEN until published (correct)
- ✅ Dashboard attempts table: Score shown as "Hidden" when `published === false` (correct)

**When `showResults = false` (results completely hidden):**
- ✅ Quiz results page: Shows "Your answers have been recorded" (correct)
- ❌ Share achievement button: STILL VISIBLE in quiz-results.tsx (should be hidden)
- ❌ Dashboard: Share button shown for ALL completed attempts regardless of publish status

### 4.2 Required Changes

#### A. Hide Share Button When Results Not Published
**File:** `src/components/quiz/quiz-results.tsx` line 487

Wrap the share button section in a condition:
```tsx
{data.published !== false && (
  // Share achievement CTA
)}
```

#### B. Hide Share Button in Dashboard for Unpublished Attempts
**File:** `src/components/student/student-dashboard.tsx` line 567

Add condition before rendering ShareAchievementButton:
```tsx
{a.published !== false ? (
  <ShareAchievementButton ... />
) : (
  <span className="text-xs text-muted-foreground">Hidden</span>
)}
```

#### C. Hide Score/Pass-Fail in Dashboard for Unpublished
Already partially done — `a.published === false` shows "Hidden" for score and "—" for result. But the share button is still shown. Fix: wrap share button in `a.published !== false` check.

---

## 5. ADMIN PANEL FUNCTIONALITY REVIEW

### 5.1 Registration Form Builder
**File:** `src/components/admin/registration-form-builder.tsx`
- ✅ Can add/edit/delete fields
- ✅ Supports: text, email, tel, number, textarea, checkbox, date, select
- ✅ Required field toggle
- ✅ Field ordering
- ❌ No live preview of the form
- ❌ No drag-and-drop reordering

### 5.2 Landing Page Builder
**File:** `src/components/admin/landing-page-builder.tsx`
- ✅ 14 section types including ACTIVITIES and REGISTRATION
- ✅ Drag-and-drop reordering via @dnd-kit
- ✅ Inline editing for each section
- ✅ Auto-save (debounced)
- ✅ Show/hide toggle per section
- ❌ No live preview
- ❌ ACTIVITIES section auto-loads from event (correct behavior)

### 5.3 Gate Pass Manager
**File:** `src/components/admin/gate-pass-manager.tsx`
- ❌ No event selector dropdown — relies on `linkPreselectedEventId` which is empty if user navigates directly to the Gate Passes tab
- ✅ "Generate for All" button works
- ✅ Search, check-in, revoke, download ID card
- ✅ Stats display

### 5.4 Required Changes for Admin Panel

#### A. Gate Pass Manager — Event Selector
Add an event dropdown at the top of the GatePassManager:
```tsx
// Add an event selector at the top
const { data: events } = useQuery({ queryKey: ["events"], queryFn: ... })
const [selectedEventId, setSelectedEventId] = useState(linkPreselectedEventId || "")

<Select value={selectedEventId} onChange={setSelectedEventId}>
  {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
</Select>
```

#### B. Registration Form Builder — Live Preview
Add a split-pane view: left side = form builder, right side = live preview of how the form will look to participants.

---

## 6. LOADING STATES

### 6.1 Current State
- 478 loading state references across components (Loader2, animate-spin, isLoading, Skeleton)
- 124 Skeleton references
- ✅ Most data-loading states have spinners
- ❌ No consistent loading state for route transitions
- ❌ No skeleton loading for event landing page, dashboard, admin panel initial load
- ❌ No loading state for button clicks (e.g., "Submit" button doesn't show spinner)

### 6.2 Required Changes

#### A. Add `loading.tsx` Files for Route-Level Loading
Create `loading.tsx` files in key route directories:

**`src/app/admin/loading.tsx`:**
```tsx
export default function AdminLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  )
}
```

Create for: `/admin`, `/dashboard`, `/login`, `/org-register`, `/event/[eventSlug]`, `/org/[orgSlug]`, `/superadmin/login`

#### B. Button Loading States
All mutation buttons should show a spinner + disabled state:
```tsx
<Button disabled={isPending}>
  {isPending ? <><Loader2 className="size-4 animate-spin" /> Loading...</> : "Submit"}
</Button>
```

#### C. Skeleton Loading for Data-Heavy Components
Add skeleton loaders for:
- Event landing page (while fetching event data)
- Dashboard (while fetching attempts + registered events)
- Admin tables (while fetching events, questions, etc.)
- Quiz start page (while fetching quiz metadata)

---

## 7. ROUTE VERIFICATION

### 7.1 All 29 Page Routes (verified HTTP 200)

| Route | Status | Notes |
|---|---|---|
| `/` | ✅ 200 | Marketing landing |
| `/login` | ✅ 200 | Org admin login |
| `/org-register` | ✅ 200 | Org registration |
| `/superadmin/login` | ✅ 200 | Super admin login |
| `/admin` | ✅ 200 | Legacy admin (redirects to /org/{slug}/admin) |
| `/dashboard` | ✅ 200 | Generic participant dashboard |
| `/event/[eventSlug]` | ✅ 200 | Legacy event URL (301 to /org/{slug}/event/{slug}) |
| `/org/[orgSlug]` | ✅ 200 | Org landing page |
| `/org/[orgSlug]/admin` | ✅ 200 | Org admin panel |
| `/org/[orgSlug]/event/[eventSlug]` | ✅ 200 | Org event landing |
| `/org/[orgSlug]/participant/dashboard` | ✅ 200 | Org participant dashboard |
| `/org/[orgSlug]/[eventSlug]/quiz/[quizSlug]` | ✅ 200 | Org-scoped quiz |
| `/quiz/[quizSlug]` | ✅ 200 | Legacy quiz URL (redirects to org-scoped) |
| `/verify/[token]` | ✅ 200 | Certificate verification |
| `/share/[token]` | ✅ 200 | Achievement share |
| `/gate/[token]` | ✅ 200 | Gate pass verification |
| `/invite/[token]` | ✅ 200 | Invitation accept |
| `/live/[activityId]` | ✅ 200 | Live display (projector) |
| `/activity/[slug]` | ✅ 200 | Activity join |
| `/register` | ✅ 200 | Event registration form |
| `/forgot-password` | ✅ 200 | Forgot password |
| `/reset-password` | ✅ 200 | Reset password |
| `/about` | ✅ 200 | About page |
| `/privacy` | ✅ 200 | Privacy policy |
| `/terms` | ✅ 200 | Terms of service |
| `/contact` | ✅ 200 | Contact page |
| `/pricing` | ✅ 200 | Pricing page |
| `/no-org` | ✅ 200 | No organization redirect |
| `/org/custom-domain` | ✅ 200 | Custom domain setup |

### 7.2 Middleware Redirects (all verified 301)

| Old URL | New URL | Status |
|---|---|---|
| `/?view=login` | `/login` | ✅ 301 |
| `/?view=superadmin` | `/superadmin/login` | ✅ 301 |
| `/?view=org-register` | `/org-register` | ✅ 301 |
| `/?view=student` | `/dashboard` | ✅ 301 |
| `/?view=admin` | `/admin` | ✅ 301 |
| `/?quiz=SLUG` | `/quiz/SLUG` | ✅ 301 |
| `/?event=SLUG` | `/event/SLUG` | ✅ 301 |
| `/?org=SLUG` | `/org/SLUG` | ✅ 301 |
| `/?verify=TOKEN` | `/verify/TOKEN` | ✅ 301 |
| `/?share=TOKEN` | `/share/TOKEN` | ✅ 301 |
| `/?invite=TOKEN` | `/invite/TOKEN` | ✅ 301 |
| `/?gate=TOKEN` | `/gate/TOKEN` | ✅ 301 |

---

## 8. CUSTOM DOMAINS & VERCEL SUBDOMAINS

### 8.1 Current State

**Custom Domains:**
- ✅ `OrganizationDomain` model exists in schema
- ✅ DNS verification via TXT records implemented (`/api/organizations/[id]/domains/[domainId]/verify`)
- ✅ Middleware resolves custom domains via `x-engagio-org-host` header
- ❌ Vercel doesn't automatically add custom domains — they must be added via Vercel Dashboard or API

**Auto Subdomains:**
- ✅ Middleware already handles `slug.engagio.app` → rewrites to `/org/{slug}`
- ❌ Vercel does NOT automatically create wildcard subdomains
- ❌ Need to add `*.engagio.app` as a wildcard domain in Vercel project settings

### 8.2 Required Changes

#### A. Vercel Wildcard Subdomain Setup
1. In Vercel project settings → Domains → add `*.engagio.app`
2. DNS: Add a wildcard CNAME record `*.engagio.app` → `cname.vercel-dns.com`
3. Vercel will automatically provision SSL for all subdomains
4. Middleware already handles `slug.engagio.app` → `/org/{slug}` rewrite

#### B. Custom Domain Flow (for orgs with their own domain)
1. Org admin adds domain: `myorg.com` via `/org/{slug}/admin` → Settings → Domains
2. API creates `OrganizationDomain` record with verification token
3. Admin adds TXT record: `_engagio-verify.myorg.com` → `{token}`
4. Admin clicks "Verify" → API checks DNS via `dns.resolveTxt()`
5. On success: domain marked as `verified = true`
6. **Manual step required:** Add `myorg.com` as a custom domain in Vercel Dashboard (or via Vercel API)
7. Middleware resolves `myorg.com` → looks up `OrganizationDomain` → finds org slug → rewrites to `/org/{slug}`

#### C. Automate Custom Domain via Vercel API
Create a new API endpoint that calls the Vercel API to add the domain automatically:

```
POST /api/organizations/[id]/domains
→ After DNS verification, call Vercel API:
  POST https://api.vercel.com/v9/projects/{projectId}/domains
  Body: { name: "myorg.com" }
→ Store the Vercel domain ID for later removal
```

This requires:
- `VERCEL_TOKEN` environment variable (Vercel API token)
- `VERCEL_PROJECT_ID` environment variable

---

## 9. COMPREHENSIVE IMPROVEMENT LIST

### Priority 1 — Critical (Must Fix Before Launch)

| # | Task | Files | Effort |
|---|---|---|---|
| 1 | Add Google login to org registration page | `org-onboarding.tsx` | Medium |
| 2 | Add Google login to org login page | `login-form.tsx` | Small |
| 3 | Auto-fill name/email on registration form | `event-registration-form.tsx` | Small |
| 4 | Hide share button when results not published | `quiz-results.tsx`, `student-dashboard.tsx` | Small |
| 5 | Add event selector to Gate Pass Manager | `gate-pass-manager.tsx` | Small |
| 6 | Add registered events list with action buttons to participant dashboard | `student-dashboard.tsx` | Medium |
| 7 | Remove dead `/register?mode=admin` link | `org-onboarding.tsx` | Tiny |

### Priority 2 — Important (Should Fix Before Launch)

| # | Task | Files | Effort |
|---|---|---|---|
| 8 | Add `loading.tsx` for key routes (7 files) | `src/app/*/loading.tsx` | Small |
| 9 | Add skeleton loading for data-heavy components | Various | Medium |
| 10 | Add button loading states for all mutations | Various | Small |
| 11 | Vercel wildcard subdomain setup (`*.engagio.app`) | Vercel Dashboard + DNS | Small |
| 12 | Automate custom domain via Vercel API | New API endpoint | Medium |
| 13 | Add payments management tab to super admin panel | `platform-admin-shell.tsx` | Medium |

### Priority 3 — Nice to Have (Post-Launch)

| # | Task | Files | Effort |
|---|---|---|---|
| 14 | Live preview for registration form builder | `registration-form-builder.tsx` | Large |
| 15 | Live preview for landing page builder | `landing-page-builder.tsx` | Large |
| 16 | Remove unused `ParticipantLogin` component | `participant-login.tsx` | Tiny |
| 17 | Add billing checkout flow (Stripe/Razorpay) | New API + UI | Large |
| 18 | Add subscription management (cancel, upgrade, downgrade) | New UI | Large |
| 19 | Add email notifications for key events (registration, certificate, etc.) | `email.ts` | Medium |
| 20 | Add analytics dashboard for super admin (revenue, growth, churn) | `platform-admin-shell.tsx` | Medium |

---

## 10. CONCEPTUAL DASHBOARD SEPARATION

### Organization Admin Dashboard
```
/org/{slug}/admin
├── Sidebar: Org logo + name + 11 nav items
├── Dashboard: Analytics, recent activity, quick stats
├── Events: Create/edit/delete events, landing page builder, gate passes
├── Questions: Per-event question bank, CSV import
├── Quiz Links: Generate shareable links, security settings
├── Activities: Polls, surveys, Q&A, live display
├── Attempts: All participant attempts, filter by event
├── Payments: Verify manual UPI payments, approve/reject
├── Results & Certs: Publish results, issue certificates
├── Gate Passes: Generate ID cards, check-in/out, revoke
├── Users: Registered participants, org members
└── Certificates: Issue, verify, revoke
```

### Participant Dashboard
```
/org/{slug}/participant/dashboard (org-scoped)
/dashboard (generic — all orgs)
├── Header: User name + avatar + org name + sign out
├── Stats Row: Total attempts, Average score, Quizzes passed
├── My Registered Events ← NEW
│   ├── Event Card: Name, org, activities count
│   ├── [Start Quiz] [View Results] [Download Certificate]
│   └── Status: LIVE / UPCOMING / COMPLETED
├── Current & Upcoming Activities ← EXISTS (improve)
│   ├── Activity Card: Type icon, title, status badge
│   ├── [Start] (LIVE) or [View] (UPCOMING)
│   └── Stats: Questions, Duration, Participants
├── My Recent Attempts ← EXISTS
│   ├── Table: Event, Status, Score (or "Hidden"), Result, Share, Date
│   └── Share button only if published
├── Take a Quiz: Enter quiz code
├── Leaderboard: View rankings
└── My Certificates: Download earned certificates
```

---

*This document serves as the complete improvement roadmap for Engagio production readiness.*
