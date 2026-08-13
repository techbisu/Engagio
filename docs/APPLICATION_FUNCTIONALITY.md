# Engagio — Application Functionality Document

**Version:** 1.0  
**Last Updated:** August 2026  
**Repository:** [github.com/techbisu/Engagio](https://github.com/techbisu/Engagio)  
**Live URL:** [engagio-six.vercel.app](https://engagio-six.vercel.app)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [User Roles](#4-user-roles)
5. [Feature Modules](#5-feature-modules)
6. [API Reference](#6-api-reference)
7. [Database Schema](#7-database-schema)
8. [Environment Variables](#8-environment-variables)
9. [Security](#9-security)
10. [Deployment](#10-deployment)

---

## 1. Overview

Engagio is a **multi-tenant SaaS platform** for hosting interactive events, workshops, conferences, training programs, and assessments. Organizations can create events, build custom landing pages, manage registrations, conduct quizzes/polls/surveys with anti-cheat protection, issue certificates, and generate shareable achievement cards.

### Core Value Proposition
- **Organizations** get a white-label event management platform with custom branding, domains, and billing.
- **Participants** get a seamless experience: register via Google, take assessments with AI proctoring, view results instantly, earn certificates, and share achievements on social media.
- **Super Admins** manage the entire platform: organizations, plans, billing, and users.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 (strict mode) |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York style) |
| **Database** | Prisma ORM (SQLite for dev, PostgreSQL/Neon for prod) |
| **Auth** | NextAuth.js v4 (Google OAuth + Credentials + TOTP 2FA) |
| **State** | Zustand (client) + TanStack Query (server) |
| **Image Storage** | Cloudinary (signed uploads, auto-optimization) |
| **Email** | Resend (transactional emails) |
| **Card Rendering** | Satori + @resvg/resvg-js (SVG to PNG with embedded fonts) |
| **Charts** | Recharts |
| **Animations** | Framer Motion |
| **QR Codes** | qrcode library |
| **Icons** | Lucide React |

---

## 3. Architecture

```
Browser (Client)
  React 19 + Next.js App Router (single-page SPA)
  Zustand store (view state) + TanStack Query (data)
        |
        v
Next.js API Routes (90 endpoints)
  /api/auth/*       NextAuth (Google, Credentials, TOTP)
  /api/events/*     Event CRUD + landing page builder
  /api/activities/* Activities (polls, quizzes, Q&A)
  /api/attempts/*   Quiz attempts + scoring
  /api/achievements/* Shareable achievement cards
  /api/organizations/* Multi-tenant org management
  /api/certificates/* Certificate generation + verify
  /api/registrations/* Event registration + payments
  /api/public/*     Public endpoints (no auth)
  /api/platform/*   Super admin endpoints
  /api/me/*         Current user data
        |
  +-----+-----+-----+
  |     |     |     |
  v     v     v     v
Prisma  Cloudinary  Resend  (Postgres/SQLite)  (Images)  (Email)
```

### Project Structure
```
src/
  app/
    api/                    90 API route handlers
    globals.css             Global styles
    layout.tsx              Root layout (providers, fonts)
    page.tsx                Single-page app router (all views)
    robots.ts               SEO robots
    sitemap.ts              SEO sitemap
  components/
    achievements/           Shareable card + modal + public share
    activities/             Poll, Q&A, survey, live display
    admin/                  Org admin panel (events, questions, etc.)
    auth/                   Login, super admin, participant login
    cert/                   Certificate verification
    landing/                Marketing landing page sections
    organization/           Org dashboard, settings, onboarding
    platform/               Super admin platform shell
    public/                 Event landing page, org landing page
    quiz/                   Quiz runner, question card, timer
    shared/                 Brand logo, site header/footer
    student/                Participant dashboard, quiz start
    ui/                     shadcn/ui component library
  hooks/                    use-ai-proctor, use-anti-cheat, etc.
  lib/                      31 utility modules (auth, db, storage, etc.)
  store/                    Zustand app store
  types/                    TypeScript type definitions (735 lines)
```

---

## 4. User Roles

### 4.1 Super Admin
- **Login:** `/?view=superadmin` (email + password + TOTP 2FA)
- **Credentials:** `superadmin@engagio.app` / `Engagio@2026`
- **Access:** Platform-level admin panel - manage all organizations, plans, billing, users
- **Security:** TOTP 2FA via Google Authenticator (optional, can be enabled)

### 4.2 Organization Admin
- **Login:** `/?view=login` (Google OAuth or email)
- **Access:** Organization dashboard - manage events, questions, quiz links, activities, certificates, registrations, payments, members
- **Roles (7 levels):**
  - **OWNER** - full access including billing, members, settings
  - **ADMIN** - full access except billing
  - **EVENT_MANAGER** - create/edit events, questions, quiz links
  - **MODERATOR** - manage activities, Q&A moderation
  - **ASSESSOR** - view attempts, results, generate certificates
  - **CHECKIN** - view registrations, check-in participants
  - **PARTICIPANT** - take quizzes, view own results

### 4.3 Participant
- **Login:** Direct on event landing page (`/?event=SLUG`) or quiz link (`/?quiz=SLUG`)
- **Auth:** Google OAuth or email-only (no password needed)
- **Access:** Take quizzes, view results, earn certificates, share achievements, view dashboard

---

## 5. Feature Modules

### 5.1 Organization Management (Multi-Tenant)
- **Public registration:** `/?view=org-register` - Google login then org details then FREE plan
- **Org login:** `/?view=login` - Google OAuth (must be registered)
- **Org switcher:** Members of multiple orgs can switch between them
- **Custom domains:** Organizations can add custom domains (with DNS verification)
- **Branding:** Custom logo, primary color, organization name
- **Members:** Invite members via email, assign roles, manage permissions
- **Billing:** 4 plans (FREE, STARTER, PROFESSIONAL, ENTERPRISE) with usage limits
- **Audit log:** All org actions are logged

### 5.2 Event Management
- **CRUD:** Create, edit, delete events with title, description, image, dates
- **Event types:** Quiz, Live Quiz, Poll, Q&A, Survey, Feedback, Knowledge Check, Pre/Post Assessment
- **Payment:** Free, UPI, or manual payment with QR code + transaction reference
- **Certificates:** Configurable certificate settings (template, passing score, auto-generate)
- **Registration fields:** Custom registration form builder (text, email, phone, dropdown, etc.)
- **Landing page builder:** Drag-and-drop sections (14 types: HERO, ABOUT, SPEAKERS, SCHEDULE, SPONSORS, VENUE, AGENDA, FAQ, GALLERY, CTA, STATS, ACTIVITIES, REGISTRATION, CUSTOM)
- **Event landing page:** Professional public page with org branding, no Engagio topbar, "Powered by Engagio" footer

### 5.3 Question Management
- **Types:** MCQ, TRUE_FALSE, FILL_BLANK, MATCHING, CODING
- **Features:** Categories, marks, negative marks, images, math notation, explanations
- **Import:** CSV bulk import with validation
- **Shuffle:** Optional question and option shuffling per attempt

### 5.4 Quiz Links
- **Shareable links:** Unique 6-character slug (e.g., `/?quiz=YXYJ3V`)
- **Settings:** Time limit, max attempts, pass threshold, show results, publish results
- **Security (13 toggles):**
  - Fullscreen required, auto-submit on exit
  - Tab switch detection, copy/paste blocking
  - Right-click disable, keyboard shortcut blocking
  - DevTools detection, anti-screenshot
  - Watermark overlay (participant email + timestamp)
  - AI Proctor (camera-based): face detection, multi-face alert, look-away detection

### 5.5 Quiz Runner
- **Fullscreen mode:** Anti-cheat fullscreen with grace period
- **Question navigator:** Sidebar with question numbers, jump to any question
- **Timer:** Countdown with watermark overlay
- **Flag questions:** Mark for review
- **Auto-save:** Answers saved locally + on server
- **Auto-submit:** On timeout or fullscreen exit (configurable)
- **AI Proctor:** Live camera preview in sidebar, skin-tone analysis for face detection
- **Results:** Instant results (if enabled) with score, percentage, pass/fail, answer review

### 5.6 Activities System
- **Types:** QUIZ, LIVE_QUIZ, POLL, SURVEY, FEEDBACK, Q_AND_A, VOTING, KNOWLEDGE_CHECK, PRE_POST_ASSESSMENT
- **Live display:** Projector view for live audience participation
- **Q&A moderation:** Approve/reject questions, upvote system
- **Real-time:** Instant response aggregation
- **Public activities section:** Carousel cards on event landing page (clickable to start)

### 5.7 Certificate System
- **5 templates:** Modern, Minimal, Professional, Celebration, Conference
- **Auto-generate:** On quiz completion (if passing score met)
- **Manual generate:** Admin can generate for any participant
- **QR verification:** Each certificate has a unique QR code linking to verification page
- **Verify page:** `/?verify=TOKEN` - public certificate verification
- **Revoke:** Admins can revoke certificates

### 5.8 Shareable Achievement Cards
- **5 styles:** Minimal (mint/aqua), Modern (emerald), Professional (amber), Celebration (purple), Conference (teal)
- **Design:** Light gradient background, trophy icon, paper burst effect, confetti, big score number
- **Generation:** Server-side rendering via Satori + Resvg with embedded DejaVu Sans fonts
- **Sharing:** WhatsApp, LinkedIn, Facebook, X (Twitter), Copy link, Download PNG
- **Public share page:** `/?share=TOKEN` - viewable by anyone
- **Privacy:** LINK_ONLY (anyone with link) or PRIVATE (only owner)
- **Download filename:** Uses VERIFY AT code (e.g., `engagio-DEM-2026-7K9M2N.png`)
- **Cache-busting:** Image URL includes `?v=dataVersion` to force refresh after regeneration
- **Force regeneration:** Modal auto-regenerates image with `force=true` to ensure latest renderer

### 5.9 Participant Dashboard
- **Stats:** Total attempts, average score, quizzes passed
- **Current and Upcoming Activities:** Shows LIVE/SCHEDULED activities from registered events
- **Recent attempts table:** Event, status, score, result, time, date, share button
- **My certificates:** View and download earned certificates
- **Take a quiz:** Enter quiz code or paste link
- **Leaderboard:** View rankings for any quiz

### 5.10 Analytics
- **Org-level:** Total events, questions, attempts, participants, revenue
- **Event-level:** Attempt trends (14-day chart), score distribution, completion rate
- **Charts:** Line charts (attempts over time), bar charts (score distribution)

### 5.11 Super Admin Platform
- **Dashboard:** Total organizations, users, events, revenue
- **Organizations:** View/edit/suspend organizations
- **Users:** View all users, change roles
- **Plans:** Manage pricing plans (FREE, STARTER, PROFESSIONAL, ENTERPRISE)
- **Payments:** Approve/reject manual payments
- **Storage:** Cloudinary storage status

### 5.12 Landing Page (Marketing)
- **Sections:** Hero, Trust Strip, Features, How It Works, Activities, Assessment, Certificates, Organization, Team, Use Cases, Security, Pricing, FAQ, CTA
- **Public pages:** About, Privacy, Terms, Contact, Pricing
- **SEO:** JSON-LD structured data, sitemap, robots.txt, OG metadata

---

## 6. API Reference

### Authentication (`/api/auth/*`)
| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth handler (Google, Credentials, TOTP) |
| `/api/auth/check-org` | POST | Check if email belongs to an org |
| `/api/auth/totp/status` | POST | Check if TOTP is required for email |
| `/api/auth/totp/setup` | POST | Generate TOTP secret + QR code |
| `/api/auth/totp/verify` | POST | Verify TOTP code |
| `/api/auth/totp/disable` | POST | Disable TOTP |

### Events (`/api/events/*`)
| Endpoint | Method | Description |
|---|---|---|
| `/api/events` | GET/POST | List/create events |
| `/api/events/[id]` | GET/PATCH/DELETE | Get/update/delete event |
| `/api/events/[id]/fields` | GET/POST | Registration form fields |
| `/api/events/[id]/registrations` | GET | List registrations |
| `/api/events/[id]/landing-page` | GET/PUT | Landing page sections |
| `/api/events/[id]/landing-page/sections` | POST | Create section |
| `/api/events/[id]/landing-page/sections/[sectionId]` | GET/PATCH/DELETE | Section CRUD |
| `/api/events/register-participant` | POST | Auto-register participant from quiz link |

### Activities (`/api/activities/*`)
| Endpoint | Method | Description |
|---|---|---|
| `/api/activities` | GET/POST | List/create activities |
| `/api/activities/[id]` | GET/PATCH/DELETE | Activity CRUD |
| `/api/activities/[id]/start` | POST | Start activity participation |
| `/api/activities/[id]/respond` | POST | Submit response |
| `/api/activities/[id]/results` | GET | View results |
| `/api/activities/[id]/close` | POST | Close activity |
| `/api/activities/[id]/duplicate` | POST | Duplicate activity |
| `/api/activities/[id]/export` | GET | Export responses |
| `/api/activities/[id]/questions` | GET/POST | Activity questions |
| `/api/activities/[id]/questions/[qid]` | PATCH/DELETE | Question CRUD |
| `/api/activities/[id]/qa/moderate` | POST | Moderate Q&A |
| `/api/activities/[id]/qa/upvote` | POST | Upvote Q&A |
| `/api/activities/by-slug/[slug]` | GET | Get by slug |

### Quiz Attempts (`/api/attempts/*`)
| Endpoint | Method | Description |
|---|---|---|
| `/api/attempts/start` | POST | Start quiz attempt |
| `/api/attempts/submit` | POST | Submit answers + score |
| `/api/attempts/list` | GET | List user's attempts |
| `/api/attempts/[id]` | GET | Get attempt details |
| `/api/attempts/publish` | POST | Publish results |

### Questions (`/api/questions/*`)
| Endpoint | Method | Description |
|---|---|---|
| `/api/questions` | GET/POST | List/create questions |
| `/api/questions/[id]` | PATCH/DELETE | Update/delete question |
| `/api/questions/import` | POST | CSV bulk import |

### Quiz Links (`/api/quiz-links/*`)
| Endpoint | Method | Description |
|---|---|---|
| `/api/quiz-links` | GET/POST | List/create quiz links |
| `/api/quiz-links/[id]` | GET/PATCH/DELETE | Quiz link CRUD |
| `/api/quiz-links/by-slug/[slug]` | GET | Get by slug (public) |

### Certificates (`/api/certificates/*`)
| Endpoint | Method | Description |
|---|---|---|
| `/api/certificates` | GET/POST | List/generate certificates |
| `/api/certificates/[id]` | GET/PATCH/DELETE | Certificate CRUD |
| `/api/certificates/generate` | POST | Auto-generate for event |
| `/api/certificates/[id]/upload-png` | POST | Upload custom PNG |

### Achievements (`/api/achievements/*`)
| Endpoint | Method | Description |
|---|---|---|
| `/api/achievements` | GET/POST | List/create shareable achievements |
| `/api/achievements/[id]` | GET/PATCH | Get/update achievement |
| `/api/achievements/[id]/generate-image` | POST | Generate/regenerate card PNG |
| `/api/achievements/[id]/share` | POST | Track share event |
| `/api/achievements/[id]/regenerate-link` | POST | Regenerate share token |
| `/api/achievements/[id]/revoke` | POST | Revoke achievement |

### Organizations (`/api/organizations/*`)
| Endpoint | Method | Description |
|---|---|---|
| `/api/organizations` | GET/POST | List/create organizations |
| `/api/organizations/current` | GET | Get current org context |
| `/api/organizations/[id]` | GET/PATCH | Get/update org |
| `/api/organizations/[id]/members` | GET/POST | List/invite members |
| `/api/organizations/[id]/members/[memberId]` | PATCH/DELETE | Update/remove member |
| `/api/organizations/[id]/domains` | GET/POST | List/add custom domains |
| `/api/organizations/[id]/domains/[domainId]` | DELETE | Remove domain |
| `/api/organizations/[id]/domains/[domainId]/verify` | POST | Verify domain DNS |
| `/api/organizations/[id]/billing` | GET | Billing details |
| `/api/organizations/[id]/billing/upgrade` | POST | Upgrade plan |
| `/api/organizations/[id]/stats` | GET | Org statistics |
| `/api/organizations/[id]/audit-log` | GET | Audit log |
| `/api/organizations/[id]/achievement-stats` | GET | Achievement statistics |
| `/api/organizations/invitations/[token]` | GET/POST | Accept invitation |

### Registrations (`/api/registrations/*`)
| Endpoint | Method | Description |
|---|---|---|
| `/api/registrations` | POST | Submit/update registration |
| `/api/registrations/check` | GET | Check registration status |
| `/api/registrations/payment` | GET/POST | Payment status + verification |

### Public (`/api/public/*`)
| Endpoint | Method | Description |
|---|---|---|
| `/api/public/event` | GET | Event details (by slug) |
| `/api/public/org` | GET | Org details (by slug) |
| `/api/public/event-landing` | GET | Landing page sections |
| `/api/public/activities` | GET | Event activities (LIVE + SCHEDULED) |

### User (`/api/me/*`)
| Endpoint | Method | Description |
|---|---|---|
| `/api/me` | GET | Current user profile |
| `/api/me/activities` | GET | Registered events with activities |

### Platform Admin (`/api/platform/*`)
| Endpoint | Method | Description |
|---|---|---|
| `/api/platform/stats` | GET | Platform statistics |
| `/api/platform/organizations` | GET | All organizations |
| `/api/platform/organizations/[id]` | GET/PATCH | Org management |
| `/api/platform/users` | GET | All users |
| `/api/platform/plans` | GET/POST | Plan management |

### Other Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/upload` | POST | File upload (Cloudinary) |
| `/api/verify/[token]` | GET | Certificate verification |
| `/api/share/[token]` | GET | Public achievement share |
| `/api/leaderboard/[slug]` | GET | Quiz leaderboard |
| `/api/analytics` | GET | Org analytics |
| `/api/analytics/event/[id]` | GET | Event analytics |
| `/api/admin/payments` | GET | List payments |
| `/api/admin/payments/[id]/approve` | POST | Approve payment |
| `/api/admin/payments/[id]/reject` | POST | Reject payment |
| `/api/admin/storage-status` | GET | Cloudinary storage status |
| `/api/pricing` | GET | Pricing plans |
| `/api/pricing/seed` | POST | Seed pricing data |
| `/api/setup` | POST | Initial setup + seed |
| `/api/fields/[id]` | PATCH/DELETE | Registration field CRUD |

---

## 7. Database Schema

### 7.1 Authentication Models

#### User
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| email | String (unique) | User email |
| name | String? | Display name |
| image | String? | Avatar URL |
| role | String | ADMIN or STUDENT |
| passwordHash | String? | bcrypt hash (null for Google-only) |
| totpSecret | String? | TOTP 2FA secret (super admin) |
| totpEnabled | Boolean | TOTP 2FA enabled flag |
| locale | String? | i18n preference |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relations:** Account[], Session[], QuizAttempt[], Registration[], Certificate[]

#### Account (OAuth)
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| userId | String | FK to User |
| type | String | OAuth account type |
| provider | String | "google" or "credentials" |
| providerAccountId | String | Provider-specific account ID |
| refresh_token | String? | OAuth refresh token |
| access_token | String? | OAuth access token |
| expires_at | Int? | Token expiry |
| token_type | String? | Token type |
| scope | String? | OAuth scopes |
| id_token | String? | ID token |
| session_state | String? | Session state |

**Unique constraint:** [provider, providerAccountId]

#### Session
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| sessionToken | String (unique) | Session token |
| userId | String | FK to User |
| expires | DateTime | Expiry date |

#### VerificationToken
| Field | Type | Description |
|---|---|---|
| identifier | String | Email identifier |
| token | String (unique) | Verification token |
| expires | DateTime | Expiry |

**Unique constraint:** [identifier, token]

### 7.2 Organization Models

#### Organization
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| name | String | Organization name |
| slug | String (unique) | URL slug |
| description | String? | Description |
| website | String? | Website URL |
| email | String? | Contact email |
| phone | String? | Contact phone |
| logoUrl | String? | Logo URL |
| primaryColor | String | Brand color (default #10b981) |
| industry | String? | Industry category |
| planId | String? | FK to Plan |
| status | String | ACTIVE or SUSPENDED |
| locale | String | Default locale |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update |

**Relations:** OrganizationMember[], OrganizationDomain[], OrganizationInvitation[], Event[], Subscription[], AuditLog[], ShareableAchievement[], Plan?

#### OrganizationMember
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| userId | String | FK to User |
| role | String | OWNER/ADMIN/EVENT_MANAGER/MODERATOR/ASSESSOR/CHECKIN/PARTICIPANT |
| status | String | ACTIVE/INVITED/REMOVED |
| invitedAt | DateTime? | Invitation timestamp |
| joinedAt | DateTime | Join timestamp |

**Unique constraint:** [organizationId, userId]

#### OrganizationDomain
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| domain | String (unique) | Custom domain |
| verified | Boolean | DNS verified |
| verificationToken | String? | DNS verification token |
| createdAt | DateTime | Creation timestamp |

#### OrganizationInvitation
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| email | String | Invitee email |
| role | String | Assigned role |
| token | String (unique) | Invitation token |
| invitedById | String | Inviter user ID |
| acceptedAt | DateTime? | Acceptance timestamp |
| expiresAt | DateTime | Expiry |
| createdAt | DateTime | Creation timestamp |

#### AuditLog
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| organizationId | String? | FK to Organization |
| userId | String? | Action performer |
| action | String | Action type (e.g. ORGANIZATION_CREATED) |
| entityType | String | Entity type |
| entityId | String? | Entity ID |
| metadata | String? | JSON metadata |
| ipAddress | String? | Request IP |
| createdAt | DateTime | Timestamp |

### 7.3 Billing Models

#### Plan
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| name | String (unique) | FREE/STARTER/PROFESSIONAL/ENTERPRISE |
| displayName | String | Display name |
| description | String? | Plan description |
| limits | String | JSON limits (maxEvents, maxParticipants, etc.) |
| isActive | Boolean | Plan available |
| createdAt | DateTime | Creation timestamp |

**Limits JSON structure:**
```json
{
  "maxEvents": 3,
  "maxParticipantsPerEvent": 100,
  "maxMembers": 3,
  "customBranding": false,
  "certificates": true,
  "aiProctor": false
}
```

#### PlanPrice
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| planId | String | FK to Plan |
| currency | String | Currency code (default INR) |
| priceMonthly | Int | Monthly price (in paise/cents) |
| priceYearly | Int | Yearly price |
| createdAt | DateTime | Creation timestamp |

#### Subscription
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| planId | String | FK to Plan |
| status | String | ACTIVE/CANCELLED/EXPIRED |
| currentPeriodStart | DateTime? | Period start |
| currentPeriodEnd | DateTime? | Period end |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update |

### 7.4 Event Models

#### Event
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| title | String | Event title |
| slug | String (unique) | URL slug |
| description | String? | Event description |
| image | String? | Hero image URL |
| startDate | DateTime | Start date |
| endDate | DateTime | End date |
| isActive | Boolean | Event active |
| requireRegistration | Boolean | Registration required |
| **Payment** | | |
| paymentMethod | String | FREE/UPI/MANUAL |
| paymentAmount | Int | Amount (in paise/cents) |
| paymentCurrency | String | Currency (default INR) |
| paymentInstructions | String? | Payment instructions |
| upiId | String? | UPI ID |
| upiLink | String? | UPI payment link |
| qrCodeUrl | String? | QR code image URL |
| qrCodePublicId | String? | Cloudinary public ID |
| requireTransactionRef | Boolean | Transaction ref required |
| requireScreenshot | Boolean | Payment screenshot required |
| **Certificate** | | |
| certEnabled | Boolean | Certificates enabled |
| certTemplate | String | Template (modern/minimal/professional/celebration/conference) |
| certIssueCondition | String | COMPLETED/PASSED |
| certPassingScore | Int | Passing percentage (default 60) |
| certAutoGenerate | Boolean | Auto-generate on completion |
| certOrgName | String? | Certificate org name |
| certSigneeName | String? | Signee name |
| certSigneeTitle | String? | Signee title |
| certSigneeImage | String? | Signee signature image |
| certSigneeImagePublicId | String? | Cloudinary public ID |
| certLogo | String? | Certificate logo |
| certLogoPublicId | String? | Cloudinary public ID |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update |

**Relations:** Organization, Question[], QuizLink[], QuizAttempt[], Registration[], EventField[], Certificate[], EventLandingSection[], Activity[]

#### EventLandingSection
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| eventId | String | FK to Event |
| type | String | Section type (14 types) |
| title | String? | Section title |
| subtitle | String? | Section subtitle |
| data | String | JSON payload (default "{}") |
| order | Int | Display order |
| isVisible | Boolean | Section visible |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update |

**Section types:** HERO, ABOUT, SPEAKERS, SCHEDULE, SPONSORS, VENUE, AGENDA, FAQ, GALLERY, CTA, STATS, ACTIVITIES, REGISTRATION, CUSTOM

#### EventField (Registration Form)
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| eventId | String | FK to Event |
| label | String | Field label |
| type | String | text/email/phone/textarea/dropdown/checkbox/radio |
| required | Boolean | Field required |
| options | String? | JSON array (for dropdown/radio/checkbox) |
| placeholder | String? | Placeholder text |
| order | Int | Display order |
| createdAt | DateTime | Creation timestamp |

### 7.5 Question Model

#### Question
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| eventId | String | FK to Event |
| type | String | MCQ/TRUE_FALSE/FILL_BLANK/MATCHING/CODING |
| question | String | Question text |
| options | String? | JSON array of options |
| correctAnswer | Int? | Correct option index (MCQ/TRUE_FALSE) |
| correctText | String? | Correct text (FILL_BLANK/CODING) |
| matchPairs | String? | JSON for MATCHING |
| explanation | String? | Answer explanation |
| category | String? | Question category |
| marks | Int | Marks (default 1) |
| negativeMarks | Int | Negative marks (default 0) |
| imageUrl | String? | Question image |
| order | Int | Display order |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update |

### 7.6 Quiz Link Model

#### QuizLink
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| eventId | String | FK to Event |
| slug | String (unique) | 6-char shareable slug |
| isActive | Boolean | Link active |
| **Settings** | | |
| shuffleQuestions | Boolean | Shuffle questions |
| shuffleOptions | Boolean | Shuffle options |
| timeLimit | Int | Time limit in minutes (0 = no limit) |
| maxAttempts | Int | Max attempts (0 = unlimited) |
| showResults | Boolean | Show results to participant |
| publishResults | Boolean | Publish results later (false = instant) |
| emailOnPublish | Boolean | Email on publish |
| leaderboardEnabled | Boolean | Leaderboard enabled |
| passThreshold | Int | Passing percentage (default 60) |
| **Security Toggles** | | |
| requireFullscreen | Boolean | Fullscreen required |
| autoSubmitOnExit | Boolean | Auto-submit on fullscreen exit |
| tabSwitchDetection | Boolean | Tab switch detection |
| copyPasteBlocking | Boolean | Copy/paste blocking |
| rightClickDisable | Boolean | Right-click disabled |
| keyboardShortcutBlocking | Boolean | Keyboard shortcut blocking |
| devtoolsDetection | Boolean | DevTools detection |
| antiScreenshot | Boolean | Anti-screenshot |
| watermarkOverlay | Boolean | Watermark overlay |
| **AI Proctor** | | |
| aiProctor | Boolean | AI proctor enabled |
| aiProctorFaceDetection | Boolean | Face detection |
| aiProctorMultiFace | Boolean | Multi-face alert |
| aiProctorLookAway | Boolean | Look-away detection |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update |

### 7.7 Quiz Attempt Model

#### QuizAttempt
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| quizLinkId | String | FK to QuizLink |
| eventId | String | FK to Event |
| userId | String | FK to User |
| status | String | IN_PROGRESS/COMPLETED/CHEAT_DETECTED/TIMEOUT |
| answers | String? | JSON: { questionId: answer } |
| questionOrder | String? | JSON: [questionId, ...] |
| score | Int | Score achieved |
| totalMarks | Int | Total possible marks |
| percentage | Int | Percentage score |
| passed | Boolean | Passed/failed |
| **Anti-cheat counters** | | |
| tabSwitches | Int | Tab switch count |
| fullscreenExits | Int | Fullscreen exit count |
| copyAttempts | Int | Copy attempt count |
| rightClicks | Int | Right-click count |
| devtoolsOpen | Int | DevTools open count |
| screenshotAttempts | Int | Screenshot attempt count |
| keyboardViolations | Int | Keyboard violation count |
| faceNotDetected | Int | Face not detected count |
| multiFaceAlerts | Int | Multi-face alert count |
| lookAwayAlerts | Int | Look-away alert count |
| flaggedQuestions | String? | JSON: [questionId, ...] |
| timeTaken | Int | Time taken (seconds) |
| startedAt | DateTime | Start timestamp |
| completedAt | DateTime? | Completion timestamp |
| publishedAt | DateTime? | Publish timestamp |

### 7.8 Registration Model

#### Registration
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| eventId | String | FK to Event |
| userId | String | FK to User |
| data | String | JSON: form field values |
| paymentStatus | String | FREE/PENDING/APPROVED/REJECTED |
| paymentScreenshot | String? | Screenshot URL |
| paymentScreenshotPublicId | String? | Cloudinary public ID |
| transactionRef | String? | Transaction reference |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update |

**Unique constraint:** [eventId, userId]

### 7.9 Certificate Model

#### Certificate
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| eventId | String | FK to Event |
| userId | String | FK to User |
| attemptId | String? | Linked quiz attempt |
| template | String | Certificate template |
| certificateNumber | String (unique) | Certificate number |
| verifyToken | String (unique) | Verification token |
| participantName | String | Participant name |
| eventTitle | String | Event title |
| eventDate | DateTime | Event date |
| score | Int? | Score |
| percentage | Int? | Percentage |
| passed | Boolean | Passed |
| issueDate | DateTime | Issue date |
| status | String | ACTIVE/REVOKED |
| imageUrl | String? | Generated PNG URL |
| imagePublicId | String? | Cloudinary public ID |
| createdAt | DateTime | Creation timestamp |

### 7.10 Activity Models

#### Activity
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| eventId | String | FK to Event |
| type | String | QUIZ/LIVE_QUIZ/POLL/SURVEY/FEEDBACK/Q_AND_A/VOTING/KNOWLEDGE_CHECK/PRE_POST_ASSESSMENT |
| title | String | Activity title |
| description | String? | Description |
| slug | String (unique) | URL slug |
| status | String | DRAFT/SCHEDULED/LIVE/CLOSED/COMPLETED |
| scheduledAt | DateTime? | Scheduled time |
| endsAt | DateTime? | End time |
| isAcceptingResponses | Boolean | Accepting responses |
| isAnonymous | Boolean | Anonymous responses |
| allowMultipleResponses | Boolean | Multiple responses allowed |
| showResultsToParticipants | Boolean | Results visible to participants |
| sortOrder | Int | Display order |
| quizLinkId | String? | FK to QuizLink (for quiz-type) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update |

#### ActivityQuestion
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| activityId | String | FK to Activity |
| type | String | SINGLE_CHOICE/MULTIPLE_CHOICE/RATING/TEXT/NUMBER/YES_NO/OPEN |
| question | String | Question text |
| options | String? | JSON array |
| required | Boolean | Required |
| order | Int | Display order |
| createdAt | DateTime | Creation timestamp |

#### ActivityResponse
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| activityId | String | FK to Activity |
| questionId | String | FK to ActivityQuestion |
| participationId | String | FK to ActivityParticipation |
| value | String | Answer value |
| isApproved | Boolean | Approved (for Q&A moderation) |
| upvotes | Int | Upvote count |
| createdAt | DateTime | Creation timestamp |

#### ActivityParticipation
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| activityId | String | FK to Activity |
| userId | String? | FK to User (null if anonymous) |
| anonymousId | String? | Anonymous ID |
| createdAt | DateTime | Creation timestamp |

### 7.11 Achievement Models

#### ShareableAchievement
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| eventId | String? | FK to Event |
| activityId | String? | FK to Activity |
| participantId | String? | FK to User |
| participantName | String | Participant name |
| type | String | QUIZ_RESULT/CERTIFICATE_EARNED/LEADERBOARD_ACHIEVEMENT/etc. |
| title | String | Achievement title |
| subtitle | String? | Subtitle |
| score | Int? | Score |
| totalScore | Int? | Total score |
| percentage | Int? | Percentage |
| rank | Int? | Rank |
| totalParticipants | Int? | Total participants |
| achievementData | String | JSON: orgName, eventTitle, activityTitle, orgLogoUrl |
| publicToken | String (unique) | Public share token |
| visibility | String | LINK_ONLY/PRIVATE |
| imageUrl | String? | Generated card PNG URL |
| imagePublicId | String? | Cloudinary public ID |
| templateId | String | Card style (minimal/modern/professional/celebration/conference) |
| certificateId | String? | Linked certificate |
| dataVersion | Int | Image version (for cache-busting) |
| revokedAt | DateTime? | Revocation timestamp |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update |

#### AchievementShare
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| achievementId | String | FK to ShareableAchievement |
| platform | String | WHATSAPP/LINKEDIN/FACEBOOK/TWITTER/DOWNLOAD/COPY |
| createdAt | DateTime | Creation timestamp |

### 7.12 Payment Provider Config

#### PaymentProviderConfig
| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| provider | String | RAZORPAY/STRIPE/PAYPAL |
| apiKey | String? | Encrypted API key |
| apiSecret | String? | Encrypted API secret |
| webhookSecret | String? | Encrypted webhook secret |
| isActive | Boolean | Provider active |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update |

---

## 8. Environment Variables

```bash
# Database (REQUIRED)
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"
# For local dev: DATABASE_URL="file:./db/custom.db"

# NextAuth (REQUIRED)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_SECRET="generate-with-openssl-rand-base64-32"

# Super Admin (REQUIRED)
SUPERADMIN_EMAIL="superadmin@engagio.app"

# Admin Emails (comma-separated)
ADMIN_EMAILS="your-email@example.com"

# Google OAuth (REQUIRED for Google login)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Cloudinary (REQUIRED for image uploads)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
CLOUDINARY_UPLOAD_PRESET="your-upload-preset"

# Resend (REQUIRED for email)
RESEND_API_KEY="your-resend-api-key"

# Payment Encryption (REQUIRED)
PAYMENT_ENCRYPTION_KEY="generate-with-openssl-rand-base64-32"

# Base Domain (for custom domains)
BASE_DOMAIN="localhost:3000"
```

---

## 9. Security

### 9.1 Authentication
- **Google OAuth** - Primary auth for org admins and participants
- **Credentials Provider** - Email + password (bcrypt hashed) for super admin
- **TOTP 2FA** - Google Authenticator integration for super admin (RFC 6238)
- **JWT Sessions** - Stateless sessions via NextAuth JWT strategy

### 9.2 Authorization (RBAC)
- **7 org roles:** OWNER, ADMIN, EVENT_MANAGER, MODERATOR, ASSESSOR, CHECKIN, PARTICIPANT
- **Permission checks** on every API route via `requireTenantContext()`
- **Resource ownership** checks (users can only access their own data)

### 9.3 Anti-Cheat (Quiz)
- **Fullscreen enforcement** with grace period
- **Tab switch detection** (visibilitychange API)
- **Copy/paste blocking** (clipboard API interception)
- **Right-click disable** (contextmenu prevention)
- **Keyboard shortcut blocking** (Ctrl+C, Ctrl+V, F12, etc.)
- **DevTools detection** (window size delta heuristic)
- **Anti-screenshot** (PrintScreen key interception)
- **Watermark overlay** (participant email + timestamp, repeated diagonally)
- **AI Proctor:** Camera-based face detection, multi-face alert, look-away detection (canvas skin-tone analysis, no video recording)

### 9.4 Data Security
- **Password hashing:** bcrypt (10 rounds)
- **Payment credentials:** AES-256 encrypted at rest
- **TOTP secrets:** Stored as plain text (required for verification) - protected by DB access controls
- **Cloudinary:** Signed uploads with API secret (server-side only)
- **Rate limiting:** API rate limiting via custom middleware

### 9.5 Multi-Tenant Isolation
- **Organization-scoped queries:** All data access is filtered by `organizationId`
- **Tenant context:** Resolved from subdomain, custom domain, or org slug header
- **Audit logging:** All org-level actions are logged with user, IP, and metadata

---

## 10. Deployment

### 10.1 Vercel Deployment
- **Build command:** `bash scripts/build.sh` (auto-detects DB provider, runs prisma generate + db push + seed + next build)
- **Install command:** `bun install`
- **Dev command:** `next dev`
- **Node.js version:** 20+
- **Regions:** Configured via Vercel project settings

### 10.2 Build Script (`scripts/build.sh`)
1. Detects DATABASE_URL format (postgresql:// to PostgreSQL, file: to SQLite)
2. Auto-switches Prisma provider in schema.prisma
3. Runs `prisma generate` + `prisma db push`
4. Seeds demo data (plans, org, event, questions, quiz link, users)
5. Runs `next build`

### 10.3 Demo Accounts
| Role | Email | Password | Login URL |
|---|---|---|---|
| Super Admin | superadmin@engagio.app | Engagio@2026 | `/?view=superadmin` |
| Org Admin | demo.admin@engagio.app | (any) | `/?view=login` |
| Participant | demo.participant@engagio.app | (any) | `/?view=login` |

### 10.4 Demo URLs
- **Org page:** `/?org=demo-medical`
- **Event page:** `/?event=medical-summit-2026`
- **Direct quiz:** `/?quiz=QUIZ_SLUG`

### 10.5 Local Development
```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Push database schema
bun run db:push

# Seed demo data
bun run db:seed-demo

# Start dev server
bun run dev
```

### 10.6 Scripts
| Script | Description |
|---|---|
| `bun run dev` | Start dev server (port 3000) |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run lint` | ESLint check |
| `bun run db:push` | Push schema to database |
| `bun run db:generate` | Generate Prisma client |
| `bun run db:migrate` | Run migrations |
| `bun run db:seed` | Seed basic data |
| `bun run db:seed-demo` | Seed demo data |
| `bun run db:reset` | Reset database |

---

## Appendix A: Tech Stack Summary

| Category | Technology | Version |
|---|---|---|
| Framework | Next.js | 16.1.x |
| Language | TypeScript | 5.x |
| Runtime | Bun | 1.3.x |
| Database | PostgreSQL (Neon) | 15+ |
| ORM | Prisma | 6.11.x |
| Auth | NextAuth.js | 4.24.x |
| UI Components | shadcn/ui | New York |
| Styling | Tailwind CSS | 4.x |
| State | Zustand | 5.x |
| Server State | TanStack Query | 5.x |
| Image Storage | Cloudinary | 2.10.x |
| Email | Resend | 6.18.x |
| Card Rendering | Satori + Resvg | 0.29 + 2.6 |
| Charts | Recharts | 2.15.x |
| Animation | Framer Motion | 12.x |
| Icons | Lucide React | 0.525.x |
| QR Code | qrcode | 1.5.x |
| Password Hashing | bcryptjs | 3.0.x |
| Image Processing | sharp | 0.34.x |

---

## Appendix B: File Count

| Category | Count |
|---|---|
| API Routes | 90 |
| React Components | 141 |
| Lib Utilities | 31 |
| Custom Hooks | 4 |
| Prisma Models | 25 |
| Type Definitions | 735 lines |
| Schema Lines | 787 lines |

---

*This document is automatically maintained alongside the codebase. Last generated: August 2026.*
