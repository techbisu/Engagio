/**
 * Payment provider abstraction — keeps provider-specific logic behind a
 * single interface so business code doesn't depend on one provider.
 *
 * Providers: RAZORPAY, STRIPE, MANUAL
 * Future: CASHFREE, PAYPAL
 *
 * Credentials are stored encrypted in PaymentProviderConfig.credentialsEncrypted.
 * The server decrypts them only when making API calls.
 */

import crypto from "crypto"

// ─── Encryption ────────────────────────────────────────────────────────────

const ENCRYPTION_KEY = process.env.PAYMENT_ENCRYPTION_KEY || "dev-encryption-key-change-in-production-32b"
const ALGORITHM = "aes-256-cbc"
const IV_LENGTH = 16

function getKey(): Buffer {
  // Derive a 32-byte key from the env var (or fallback for dev)
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest()
}

/**
 * Encrypt a JSON object (e.g. { apiKey, secretKey, webhookSecret }).
 * Returns a base64 string safe for DB storage.
 */
export function encryptCredentials(credentials: Record<string, string>): string {
  const json = JSON.stringify(credentials)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  let encrypted = cipher.update(json, "utf8", "base64")
  encrypted += cipher.final("base64")
  // Prepend IV (as hex) + ":" + encrypted base64
  return iv.toString("hex") + ":" + encrypted
}

/**
 * Decrypt credentials back to a JSON object.
 */
export function decryptCredentials(encrypted: string): Record<string, string> {
  try {
    const [ivHex, encryptedData] = encrypted.split(":")
    if (!ivHex || !encryptedData) return {}
    const iv = Buffer.from(ivHex, "hex")
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
    let decrypted = decipher.update(encryptedData, "base64", "utf8")
    decrypted += decipher.final("utf8")
    return JSON.parse(decrypted)
  } catch (e) {
    console.error("[decryptCredentials] failed:", e)
    return {}
  }
}

// ─── Provider Types ────────────────────────────────────────────────────────

export type PaymentProvider = "RAZORPAY" | "STRIPE" | "MANUAL" | "CASHFREE" | "PAYPAL" | "OTHER"

export interface PaymentProviderConfigDto {
  id: string
  organizationId: string
  provider: PaymentProvider
  type: string
  status: string
  displayName: string
  hasCredentials: boolean // true if credentialsEncrypted is non-empty
  settings: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// ─── Provider Interface ────────────────────────────────────────────────────

export interface PaymentProviderClient {
  /** Create a payment order/intent for the given amount + currency. */
  createOrder(params: {
    amountMinor: number
    currency: string
    description: string
    metadata?: Record<string, string>
  }): Promise<{ orderId: string; providerData: Record<string, unknown> }>

  /** Verify a payment signature/webhook. */
  verifyPayment(params: {
    orderId: string
    paymentId: string
    signature: string
  }): Promise<boolean>

  /** Verify a webhook signature. */
  verifyWebhook(payload: string, signature: string): Promise<boolean>
}

/**
 * Factory: create a provider client from a PaymentProviderConfig.
 * Decrypts credentials and returns the appropriate client.
 *
 * For MANUAL provider, returns a no-op client (no API calls needed).
 * For RAZORPAY/STRIPE, returns a real client if credentials are configured.
 */
export async function createProviderClient(
  config: { provider: string; credentialsEncrypted: string }
): Promise<PaymentProviderClient> {
  const credentials = decryptCredentials(config.credentialsEncrypted)

  switch (config.provider) {
    case "RAZORPAY":
      return createRazorpayClient(credentials)
    case "STRIPE":
      return createStripeClient(credentials)
    case "MANUAL":
      return createManualClient()
    default:
      throw new Error(`Unsupported payment provider: ${config.provider}`)
  }
}

// ─── Razorpay Client (stub — implement when credentials available) ────────

function createRazorpayClient(credentials: Record<string, string>): PaymentProviderClient {
  const keyId = credentials.apiKey || credentials.keyId
  const keySecret = credentials.secretKey || credentials.keySecret

  return {
    async createOrder({ amountMinor, currency, description, metadata }) {
      // POST https://api.razorpay.com/v1/orders
      // Authorization: Basic base64(keyId:keySecret)
      // Body: { amount, currency, receipt, notes }
      if (!keyId || !keySecret) {
        throw new Error("Razorpay credentials not configured")
      }
      // TODO: implement real API call when credentials are available
      throw new Error("Razorpay integration pending — configure credentials first")
    },
    async verifyPayment({ orderId, paymentId, signature }) {
      // HMAC SHA256(orderId|paymentId, keySecret) === signature
      throw new Error("Razorpay verification pending")
    },
    async verifyWebhook(payload, signature) {
      throw new Error("Razorpay webhook verification pending")
    },
  }
}

// ─── Stripe Client (stub — implement when credentials available) ──────────

function createStripeClient(credentials: Record<string, string>): PaymentProviderClient {
  const secretKey = credentials.secretKey

  return {
    async createOrder({ amountMinor, currency, description, metadata }) {
      // POST https://api.stripe.com/v1/payment_intents
      // Authorization: Bearer secretKey
      if (!secretKey) {
        throw new Error("Stripe credentials not configured")
      }
      // TODO: implement real API call
      throw new Error("Stripe integration pending — configure credentials first")
    },
    async verifyPayment({ orderId, paymentId, signature }) {
      // Stripe-Signature header verification
      throw new Error("Stripe verification pending")
    },
    async verifyWebhook(payload, signature) {
      throw new Error("Stripe webhook verification pending")
    },
  }
}

// ─── Manual Client (no API — just verification flow) ──────────────────────

function createManualClient(): PaymentProviderClient {
  return {
    async createOrder() {
      // Manual payment doesn't create an order — the participant just pays
      // via UPI/bank transfer and submits evidence.
      return { orderId: "manual", providerData: {} }
    },
    async verifyPayment() {
      // Manual payment is verified by org staff, not programmatically
      return false
    },
    async verifyWebhook() {
      // No webhooks for manual payment
      return false
    },
  }
}

// ─── Validation ────────────────────────────────────────────────────────────

export function isValidProvider(provider: string): provider is PaymentProvider {
  return ["RAZORPAY", "STRIPE", "MANUAL", "CASHFREE", "PAYPAL", "OTHER"].includes(provider)
}

export function maskCredentials(credentials: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {}
  for (const [key, value] of Object.entries(credentials)) {
    if (!value) {
      masked[key] = ""
    } else if (value.length <= 8) {
      masked[key] = "****"
    } else {
      masked[key] = value.slice(0, 4) + "****" + value.slice(-4)
    }
  }
  return masked
}
