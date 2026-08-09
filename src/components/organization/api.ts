"use client"

/**
 * Shared API helper for Organization components.
 *
 * - Sends the `x-org-slug` header (resolved from localStorage) so the
 *   backend's tenant context can resolve the active organization.
 * - Throws an Error on non-2xx with the server-provided `error` message
 *   (or a generic fallback).
 *
 * Pair with `setOrgSlug(slug)` whenever the user switches organizations:
 * that helper updates localStorage + dispatches the `engagio-org-changed`
 * custom event so TanStack Query consumers can invalidate their caches.
 */

// ─── DTO types ─────────────────────────────────────────────────────────────

export type OrgRole =
  | "OWNER"
  | "ADMIN"
  | "EVENT_MANAGER"
  | "MODERATOR"
  | "EVALUATOR"
  | "CHECKIN_STAFF"
  | "PARTICIPANT"

export type OrgStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED"
export type MemberStatus = "ACTIVE" | "INVITED" | "SUSPENDED"
export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED"
export type PlanName = "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE"

export interface OrganizationDto {
  id: string
  name: string
  slug: string
  description?: string | null
  logoUrl?: string | null
  logoPublicId?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  primaryColor: string
  secondaryColor: string
  timezone: string
  locale: string
  status: OrgStatus
  industry?: string | null
  planId?: string | null
  createdAt: string
  updatedAt: string
  // Optional nested plan (returned by /api/organizations/[id])
  plan?: {
    id: string
    name: PlanName
    displayName: string
    priceMonthly: number
    priceYearly: number
  } | null
}

/** Lightweight org shape returned by GET /api/organizations (list). */
export interface OrganizationSummaryDto {
  id: string
  name: string
  slug: string
  description?: string | null
  logoUrl?: string | null
  primaryColor: string
  status: OrgStatus
  role: OrgRole
  memberCount: number
}

export interface OrgMemberDto {
  id: string
  userId: string
  role: OrgRole
  status: MemberStatus
  createdAt: string
  user: {
    name: string | null
    email: string
    image?: string | null
  }
}

export interface AuditLogDto {
  id: string
  action: string
  entityType?: string | null
  entityId?: string | null
  metadata: Record<string, unknown>
  createdAt: string
  user?: { name: string | null; email: string } | null
}

export interface OrgStatsDto {
  eventCount: number
  participantCount: number
  activityCount: number
  assessmentCount: number
  certificateCount: number
  memberCount: number
  attemptCount: number
}

export interface OrgInvitationDto {
  id: string
  organizationId: string
  email: string
  role: OrgRole
  status: InvitationStatus
  expiresAt: string
  acceptedAt?: string | null
  organization: {
    id: string
    name: string
    slug: string
    logoUrl?: string | null
    primaryColor: string
    secondaryColor?: string
  }
  invitedBy?: { name: string | null; email: string } | null
}

// ─── Fetch helper ───────────────────────────────────────────────────────────

const ORG_CHANGED_EVENT = "engagio-org-changed"
const ORG_SLUG_KEY = "engagio-org-slug"

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const orgSlug =
    typeof window !== "undefined" ? localStorage.getItem(ORG_SLUG_KEY) : null

  const isForm =
    typeof FormData !== "undefined" && init?.body instanceof FormData

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(orgSlug ? { "x-org-slug": orgSlug } : {}),
      ...(init?.headers || {}),
    },
  })

  if (!res.ok) {
    const e = await res.json().catch(() => ({} as Record<string, unknown>))
    const message =
      (e && typeof e === "object" && "error" in e && typeof e.error === "string"
        ? e.error
        : null) || `Request failed: ${res.status}`
    throw new Error(message)
  }

  // Some endpoints (e.g. DELETE) may return no content.
  const text = await res.text()
  if (!text) return undefined as unknown as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

// ─── Org context helpers ────────────────────────────────────────────────────

/**
 * Persist the active org slug to localStorage + dispatch the
 * `engagio-org-changed` event so TanStack Query consumers can invalidate.
 */
export function setOrgSlug(slug: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ORG_SLUG_KEY, slug)
  window.dispatchEvent(new CustomEvent(ORG_CHANGED_EVENT, { detail: { slug } }))
}

/** Read the current org slug from localStorage (client-only). */
export function getOrgSlug(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ORG_SLUG_KEY)
}

/** Remove the stored org slug (e.g. on sign-out). Dispatches the change event. */
export function clearOrgSlug(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(ORG_SLUG_KEY)
  window.dispatchEvent(new CustomEvent(ORG_CHANGED_EVENT, { detail: { slug: null } }))
}

export const ORG_CHANGED_EVENT_NAME = ORG_CHANGED_EVENT
export const ORG_SLUG_STORAGE_KEY = ORG_SLUG_KEY

// ─── Role helpers ───────────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  OWNER: 7,
  ADMIN: 6,
  EVENT_MANAGER: 5,
  MODERATOR: 4,
  EVALUATOR: 3,
  CHECKIN_STAFF: 2,
  PARTICIPANT: 1,
}

export function hasRole(memberRole: OrgRole, required: OrgRole): boolean {
  return ROLE_HIERARCHY[memberRole] >= ROLE_HIERARCHY[required]
}

export const ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  EVENT_MANAGER: "Event Manager",
  MODERATOR: "Moderator",
  EVALUATOR: "Evaluator",
  CHECKIN_STAFF: "Check-in Staff",
  PARTICIPANT: "Participant",
}

export const ALL_ROLES: OrgRole[] = [
  "OWNER",
  "ADMIN",
  "EVENT_MANAGER",
  "MODERATOR",
  "EVALUATOR",
  "CHECKIN_STAFF",
  "PARTICIPANT",
]

/** Roles that can be assigned when inviting a new member (excludes OWNER). */
export const INVITABLE_ROLES: OrgRole[] = [
  "ADMIN",
  "EVENT_MANAGER",
  "MODERATOR",
  "EVALUATOR",
  "CHECKIN_STAFF",
  "PARTICIPANT",
]
