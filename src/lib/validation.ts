/**
 * Input validation helpers using Zod.
 *
 * All API routes that accept user input should validate via these schemas
 * to prevent injection / malformed data.
 */

import { z } from "zod"

// Common validators
export const emailSchema = z
  .string()
  .email("Invalid email address")
  .max(254)
  .transform((s) => s.toLowerCase().trim())

export const slugSchema = z
  .string()
  .min(3, "Slug must be at least 3 characters")
  .max(30, "Slug must be 30 characters or less")
  .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
  .regex(/^(?!-).*[^-]$/, "Slug cannot start or end with a hyphen")

export const titleSchema = z.string().min(1, "Title is required").max(200)
export const descriptionSchema = z.string().max(5000).optional().default("")
export const urlSchema = z
  .string()
  .url("Invalid URL")
  .max(2048)
  .optional()
  .nullable()
export const idSchema = z.string().min(1).max(100)

// Domain schemas
export const customDomainSchema = z
  .string()
  .min(3, "Domain is too short")
  .max(253, "Domain is too long")
  .regex(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
    "Invalid domain format (use format like events.example.com)"
  )
  .transform((s) => s.toLowerCase().trim())

// Organization schemas
export const createOrgSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  slug: slugSchema.optional(),
  description: descriptionSchema,
  industry: z
    .enum([
      "Medical",
      "Education",
      "Corporate",
      "Training",
      "Professional Association",
      "NGO",
      "Other",
    ])
    .optional(),
})

export const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(5000).optional(),
  website: urlSchema,
  email: emailSchema.optional(),
  phone: z.string().max(30).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional(),
  timezone: z.string().max(50).optional(),
  locale: z.string().max(10).optional(),
  industry: z
    .enum([
      "Medical",
      "Education",
      "Corporate",
      "Training",
      "Professional Association",
      "NGO",
      "Other",
    ])
    .optional(),
})

// Member schemas
export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum([
    "ADMIN",
    "EVENT_MANAGER",
    "MODERATOR",
    "EVALUATOR",
    "CHECKIN_STAFF",
    "PARTICIPANT",
  ]),
})

export const updateMemberRoleSchema = z.object({
  role: z.enum([
    "OWNER",
    "ADMIN",
    "EVENT_MANAGER",
    "MODERATOR",
    "EVALUATOR",
    "CHECKIN_STAFF",
    "PARTICIPANT",
  ]),
})

// Domain schemas
export const addDomainSchema = z.object({
  domain: customDomainSchema,
})

// Event schemas
export const createEventSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  image: urlSchema,
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  isActive: z.boolean().optional().default(true),
  requireRegistration: z.boolean().optional().default(false),
})

// Validation helper — returns { success, data, error }
export function validate<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(input)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const firstError = result.error.issues[0]
  return { success: false, error: firstError?.message || "Validation failed" }
}
