/**
 * i18n foundation for Engagio.
 *
 * This is infrastructure-only — it doesn't translate the entire app now.
 * It provides:
 *   - A `t(key)` function that looks up translation keys in messages
 *   - Locale resolution: User preference → Org locale → 'en'
 *   - formatCurrency, formatDate, formatNumber helpers
 *
 * Future: add `messages/hi.json`, `messages/bn.json` and switch locales
 * without rewriting components.
 */

import { db } from "./db"

// ─── Currency configuration ────────────────────────────────────────────────

export interface CurrencyConfig {
  code: string
  symbol: string
  name: string
  decimalDigits: number
  locale: string
  isActive: boolean
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", decimalDigits: 2, locale: "en-IN", isActive: true },
  { code: "USD", symbol: "$", name: "US Dollar", decimalDigits: 2, locale: "en-US", isActive: true },
  { code: "EUR", symbol: "€", name: "Euro", decimalDigits: 2, locale: "en-IE", isActive: true },
  { code: "GBP", symbol: "£", name: "British Pound", decimalDigits: 2, locale: "en-GB", isActive: true },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", decimalDigits: 2, locale: "en-AU", isActive: false },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", decimalDigits: 2, locale: "en-CA", isActive: false },
]

export function getCurrencyConfig(code: string): CurrencyConfig {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) || SUPPORTED_CURRENCIES[0]
}

export function getActiveCurrencies(): CurrencyConfig[] {
  return SUPPORTED_CURRENCIES.filter((c) => c.isActive)
}

// ─── Locale resolution ──────────────────────────────────────────────────────

export const SUPPORTED_LOCALES = ["en", "hi", "bn"] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: SupportedLocale = "en"

/**
 * Resolve the locale for a user, falling back to org locale, then 'en'.
 */
export async function resolveLocale(
  userId?: string,
  orgId?: string
): Promise<SupportedLocale> {
  // 1. User preference
  if (userId) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    })
    if (user?.locale && isSupportedLocale(user.locale)) {
      return user.locale as SupportedLocale
    }
  }

  // 2. Organization locale
  if (orgId) {
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { locale: true },
    })
    if (org?.locale && isSupportedLocale(org.locale)) {
      return org.locale as SupportedLocale
    }
  }

  // 3. Default
  return DEFAULT_LOCALE
}

function isSupportedLocale(locale: string): boolean {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale)
}

// ─── Translation messages ──────────────────────────────────────────────────

// For MVP, we load messages synchronously. In the future, this could be
// loaded from JSON files via dynamic import.
import enMessages from "../../messages/en.json"

const messageBundles: Record<string, Record<string, string>> = {
  en: enMessages as Record<string, string>,
  // Future: hi: await import("../../messages/hi.json"),
  // Future: bn: await import("../../messages/bn.json"),
}

/**
 * Translation function. Looks up a dotted key (e.g. "events.create").
 * Falls back to the key itself if not found.
 */
export function t(key: string, locale: SupportedLocale = DEFAULT_LOCALE): string {
  const bundle = messageBundles[locale] || messageBundles[DEFAULT_LOCALE]
  return bundle[key] || key
}

/**
 * Translation with interpolation. Replaces {placeholders}.
 */
export function ti(
  key: string,
  params: Record<string, string | number>,
  locale: SupportedLocale = DEFAULT_LOCALE
): string {
  let text = t(key, locale)
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v))
  }
  return text
}

// ─── Formatting helpers ────────────────────────────────────────────────────

/**
 * Format a currency amount from integer minor units (paise/cents) to a
 * locale-aware string.
 *
 *   formatCurrency(49900, "INR") → "₹499.00"
 *   formatCurrency(999, "USD") → "$9.99"
 *   formatCurrency(0, "INR") → "₹0.00"
 */
export function formatCurrency(
  amountMinor: number,
  currencyCode: string = "INR",
  locale?: string
): string {
  const config = getCurrencyConfig(currencyCode)
  const effectiveLocale = locale || config.locale
  const majorAmount = amountMinor / Math.pow(10, config.decimalDigits)

  try {
    return new Intl.NumberFormat(effectiveLocale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: config.decimalDigits,
      maximumFractionDigits: config.decimalDigits,
    }).format(majorAmount)
  } catch {
    // Fallback: symbol + number
    return `${config.symbol}${majorAmount.toFixed(config.decimalDigits)}`
  }
}

/**
 * Format a date using the org/user locale + timezone.
 *
 *   formatDate("2026-08-08", "en") → "Aug 8, 2026"
 *   formatDate("2026-08-08", "en-IN") → "8/8/2026"
 */
export function formatDate(
  date: Date | string,
  locale: string = "en",
  timezone?: string
): string {
  const d = typeof date === "string" ? new Date(date) : date
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(d)
  } catch {
    return d.toLocaleDateString()
  }
}

/**
 * Format a date+time.
 */
export function formatDateTime(
  date: Date | string,
  locale: string = "en",
  timezone?: string
): string {
  const d = typeof date === "string" ? new Date(date) : date
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(d)
  } catch {
    return d.toLocaleString()
  }
}

/**
 * Format a number with locale-aware separators.
 *
 *   formatNumber(1248, "en") → "1,248"
 *   formatNumber(1248, "en-IN") → "1,248"
 */
export function formatNumber(
  value: number,
  locale: string = "en"
): string {
  try {
    return new Intl.NumberFormat(locale).format(value)
  } catch {
    return String(value)
  }
}

/**
 * Format a relative time (e.g. "3 days ago", "in 2 hours").
 */
export function formatRelativeTime(
  date: Date | string,
  locale: string = "en"
): string {
  const d = typeof date === "string" ? new Date(date) : date
  const seconds = Math.round((d.getTime() - Date.now()) / 1000)
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    const absSeconds = Math.abs(seconds)
    if (absSeconds < 60) return rtf.format(seconds, "second")
    if (absSeconds < 3600) return rtf.format(Math.round(seconds / 60), "minute")
    if (absSeconds < 86400) return rtf.format(Math.round(seconds / 3600), "hour")
    if (absSeconds < 2592000) return rtf.format(Math.round(seconds / 86400), "day")
    if (absSeconds < 31536000) return rtf.format(Math.round(seconds / 2592000), "month")
    return rtf.format(Math.round(seconds / 31536000), "year")
  } catch {
    return d.toISOString()
  }
}
