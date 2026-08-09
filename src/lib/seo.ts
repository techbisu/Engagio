/**
 * SEO helpers — JSON-LD structured data + Open Graph metadata.
 *
 * These helpers build schema.org JSON-LD objects that we render into the
 * page as `<script type="application/ld+json">` so search engines (Google,
 * Bing, etc.) can index events, the organization, and the platform itself.
 *
 * Reference:
 *   - https://schema.org/Event
 *   - https://schema.org/Organization
 *   - https://schema.org/WebSite
 *   - https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
 *
 * The base domain is configurable via BASE_DOMAIN env var (defaults to
 * engagio.app), and the protocol is HTTPS in production, HTTP in dev.
 */

const BASE_DOMAIN = process.env.BASE_DOMAIN || "engagio.app"
const USE_HTTPS = process.env.NODE_ENV === "production"

/** Returns the configured protocol scheme (https in prod, http in dev). */
function scheme(): string {
  return USE_HTTPS ? "https" : "http"
}

/** Returns the canonical public origin URL, e.g. "https://engagio.app". */
export function publicOrigin(): string {
  return `${scheme()}://${BASE_DOMAIN}`
}

/** Builds a full public URL by joining the origin with a path. */
export function publicUrl(path?: string): string {
  if (!path || path === "/") return publicOrigin()
  const clean = path.startsWith("/") ? path : `/${path}`
  return `${publicOrigin()}${clean}`
}

// ---------------------------------------------------------------------------
// JSON-LD builders
// ---------------------------------------------------------------------------

export interface EventJsonLdInput {
  title: string
  description?: string
  startDate?: string | Date
  endDate?: string | Date
  organizer?: string | { name: string; url?: string }
  url?: string
  image?: string
  location?: string | { name: string; address?: string; url?: string }
  offers?: {
    price: number | string
    priceCurrency?: string
    availability?: string
    url?: string
  }
  eventStatus?: string
  eventAttendanceMode?: string
}

/**
 * Build a schema.org Event JSON-LD object.
 *
 *   {
 *     "@context": "https://schema.org",
 *     "@type": "Event",
 *     "name": "...",
 *     "description": "...",
 *     "startDate": "2025-01-01T00:00:00.000Z",
 *     "endDate": "2025-01-02T00:00:00.000Z",
 *     "organizer": { "@type": "Organization", "name": "..." },
 *     "url": "...",
 *     "image": "..."
 *   }
 */
export function buildEventJsonLd(event: EventJsonLdInput): Record<string, unknown> {
  const organizer: Record<string, unknown> = {
    "@type": "Organization",
  }
  if (typeof event.organizer === "string") {
    organizer.name = event.organizer
  } else if (event.organizer && typeof event.organizer === "object") {
    organizer.name = event.organizer.name
    if (event.organizer.url) organizer.url = event.organizer.url
  }

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
  }

  if (event.description) jsonLd.description = event.description
  if (event.startDate) {
    jsonLd.startDate =
      event.startDate instanceof Date ? event.startDate.toISOString() : event.startDate
  }
  if (event.endDate) {
    jsonLd.endDate =
      event.endDate instanceof Date ? event.endDate.toISOString() : event.endDate
  }
  if (Object.keys(organizer).length > 1) {
    jsonLd.organizer = organizer
  }
  if (event.url) jsonLd.url = event.url
  if (event.image) jsonLd.image = event.image

  if (typeof event.location === "string") {
    jsonLd.location = {
      "@type": "Place",
      name: event.location,
    }
  } else if (event.location && typeof event.location === "object") {
    jsonLd.location = {
      "@type": "Place",
      name: event.location.name,
      ...(event.location.address ? { address: event.location.address } : {}),
      ...(event.location.url ? { url: event.location.url } : {}),
    }
  }

  if (event.offers) {
    jsonLd.offers = {
      "@type": "Offer",
      price: event.offers.price,
      priceCurrency: event.offers.priceCurrency ?? "INR",
      availability:
        event.offers.availability ??
        "https://schema.org/InStock",
      ...(event.offers.url ? { url: event.offers.url } : {}),
    }
  }

  if (event.eventStatus) {
    jsonLd.eventStatus = event.eventStatus
  } else {
    jsonLd.eventStatus = "https://schema.org/EventScheduled"
  }

  if (event.eventAttendanceMode) {
    jsonLd.eventAttendanceMode = event.eventAttendanceMode
  } else {
    jsonLd.eventAttendanceMode = "https://schema.org/OnlineEventAttendanceMode"
  }

  return jsonLd
}

export interface OrganizationJsonLdInput {
  name: string
  description?: string
  url: string
  logo?: string
  sameAs?: string[]
  email?: string
}

/**
 * Build a schema.org Organization JSON-LD object.
 */
export function buildOrganizationJsonLd(
  org: OrganizationJsonLdInput
): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: org.name,
    url: org.url,
  }

  if (org.description) jsonLd.description = org.description
  if (org.logo) {
    jsonLd.logo = {
      "@type": "ImageObject",
      url: org.logo,
    }
  }
  if (org.sameAs && org.sameAs.length > 0) {
    jsonLd.sameAs = org.sameAs
  }
  if (org.email) jsonLd.email = org.email

  return jsonLd
}

export interface WebSiteJsonLdInput {
  name: string
  url: string
  description?: string
  potentialAction?: {
    target: string
    queryInput: string
  }
}

/**
 * Build a schema.org WebSite JSON-LD object, optionally with a SearchAction
 * so Google can show a sitelinks search box in SERP.
 */
export function buildWebSiteJsonLd(
  site: WebSiteJsonLdInput
): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.url,
  }

  if (site.description) jsonLd.description = site.description

  if (site.potentialAction) {
    jsonLd.potentialAction = {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: site.potentialAction.target,
      },
      "query-input": site.potentialAction.queryInput,
    }
  }

  return jsonLd
}

// ---------------------------------------------------------------------------
// Open Graph metadata helper
// ---------------------------------------------------------------------------

export interface OgMetadataInput {
  title: string
  description?: string
  image?: string
  url?: string
  type?: "website" | "article" | "profile"
  siteName?: string
  twitterCard?: "summary" | "summary_large_image" | "player" | "app"
  twitterSite?: string
  twitterCreator?: string
}

/**
 * Build a flat key/value map of Open Graph + Twitter meta tags suitable for
 * rendering inside a `<meta>` tag list. Useful when you need to inject OG
 * tags dynamically (e.g., for a specific event landing page that overrides
 * the defaults from layout.tsx).
 *
 *   const tags = buildOgMetadata({ title: "...", image: "..." })
 *   // → { "og:title": "...", "og:image": "...", "twitter:card": "..." }
 *
 * In Next.js metadata API, prefer the `openGraph` / `twitter` fields of
 * the `Metadata` export — this helper is for cases where you must emit
 * tags manually.
 */
export function buildOgMetadata(
  input: OgMetadataInput
): Record<string, string> {
  const tags: Record<string, string> = {
    "og:title": input.title,
    "og:type": input.type ?? "website",
  }

  if (input.description) {
    tags["og:description"] = input.description
  }
  if (input.image) {
    tags["og:image"] = input.image
  }
  if (input.url) {
    tags["og:url"] = input.url
  }
  if (input.siteName) {
    tags["og:site_name"] = input.siteName
  }

  tags["twitter:card"] = input.twitterCard ?? "summary_large_image"
  tags["twitter:title"] = input.title
  if (input.description) {
    tags["twitter:description"] = input.description
  }
  if (input.image) {
    tags["twitter:image"] = input.image
  }
  if (input.url) {
    tags["twitter:url"] = input.url
  }
  if (input.twitterSite) {
    tags["twitter:site"] = input.twitterSite
  }
  if (input.twitterCreator) {
    tags["twitter:creator"] = input.twitterCreator
  }

  return tags
}

// ---------------------------------------------------------------------------
// React helpers
// ---------------------------------------------------------------------------

/**
 * Render a JSON-LD object as a `<script type="application/ld+json">` tag.
 *
 * Use this in any React component (client or server) to embed structured
 * data:
 *
 *   <script
 *     type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
 *   />
 *
 * This helper centralizes the (slightly awkward) React idiom so callers can
 * just spread the result onto a <script> element.
 */
export function jsonLdScriptProps(jsonLd: object): {
  type: "application/ld+json"
  dangerouslySetInnerHTML: { __html: string }
} {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(jsonLd) },
  }
}
