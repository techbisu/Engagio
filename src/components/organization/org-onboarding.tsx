"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BrandLogo } from "@/components/shared/brand-logo"

import { api, setOrgSlug, type OrganizationDto, type OrgRole } from "./api"

interface OrgOnboardingProps {
  onCreated: (orgId: string) => void
  onCancel: () => void
}

interface CreateOrgResponse {
  organization: OrganizationDto
  role: OrgRole
}

const INDUSTRIES = [
  "Medical",
  "Education",
  "Corporate",
  "Training",
  "Professional Association",
  "NGO",
  "Other",
] as const

/** Generate a URL-safe slug from a name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
}

export function OrgOnboarding({ onCreated, onCancel }: OrgOnboardingProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = React.useState<1 | 2>(1)
  // Step 1: Admin account
  const [adminName, setAdminName] = React.useState("")
  const [adminEmail, setAdminEmail] = React.useState("")
  const [adminPassword, setAdminPassword] = React.useState("")
  // Step 2: Organization
  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [slugTouched, setSlugTouched] = React.useState(false)
  const [description, setDescription] = React.useState("")
  const [industry, setIndustry] = React.useState<string>("")

  // Auto-generate slug from name unless the user has manually edited it.
  React.useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(name))
    }
  }, [name, slugTouched])

  const createMutation = useMutation({
    mutationFn: async () => {
      const data = await api<CreateOrgResponse>("/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
          industry: industry || undefined,
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim().toLowerCase(),
          adminPassword: adminPassword,
        }),
      })
      // After creating the org + admin account, sign in with the new credentials
      const { signIn } = await import("next-auth/react")
      await signIn("credentials", {
        email: adminEmail.trim().toLowerCase(),
        password: adminPassword,
        asAdmin: "true",
        redirect: false,
      })
      return data
    },
    onSuccess: (data) => {
      setOrgSlug(data.organization.slug)
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", "current"] })
      toast.success("Organization created!", {
        description: `${data.organization.name} is ready. You're the owner.`,
      })
      onCreated(data.organization.id)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to create organization"
      toast.error("Could not create organization", { description: msg })
    },
  })

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminName.trim()) { toast.error("Your name is required"); return }
    if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      toast.error("Please enter a valid email"); return
    }
    if (!adminPassword || adminPassword.length < 6) {
      toast.error("Password must be at least 6 characters"); return
    }
    setStep(2)
  }

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error("Organization name is required"); return }
    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      toast.error("Slug can only contain lowercase letters, numbers, and hyphens"); return
    }
    createMutation.mutate()
  }

  const isSubmitting = createMutation.isPending

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-50/30 dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20">
      {/* Decorative background blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-0 size-80 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-0 size-96 rounded-full bg-teal-300/20 blur-3xl dark:bg-teal-500/10"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-8 sm:px-6 sm:py-12">
        {/* Top bar */}
        <div className="mb-8 flex items-center justify-between">
          <BrandLogo size="sm" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="gap-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex-1"
        >
          <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            {/* Hero header with gradient */}
            <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-600 px-6 py-8 text-white sm:px-8 sm:py-10">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/20 backdrop-blur">
                  <Building2 className="size-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                    Create your organization
                  </h1>
                  <p className="mt-0.5 text-sm text-emerald-50/90">
                    Set up a workspace for your team, events, and participants.
                  </p>
                </div>
              </div>
            </div>

            <CardHeader className="pt-6">
              <CardTitle className="text-base text-slate-900 dark:text-slate-50">
                {step === 1 ? "Step 1: Your Admin Account" : "Step 2: Organization Details"}
              </CardTitle>
              <CardDescription>
                {step === 1
                  ? "Create your organization admin account."
                  : "Tell us about your organization. You can change everything later."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {step === 1 ? (
                <form onSubmit={handleStep1Submit} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-name" className="text-sm font-medium">Your Name <span className="text-rose-500">*</span></Label>
                    <Input id="admin-name" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="John Doe" maxLength={100} required autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-email" className="text-sm font-medium">Email <span className="text-rose-500">*</span></Label>
                    <Input id="admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="john@organization.com" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-pass" className="text-sm font-medium">Password <span className="text-rose-500">*</span></Label>
                    <Input id="admin-pass" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Min 6 characters" required />
                    <p className="text-xs text-slate-500">You'll use this to log in to your organization dashboard.</p>
                  </div>
                  <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit" className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">Continue <ArrowRight className="size-4" /></Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleStep2Submit} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="org-name" className="text-sm font-medium">Organization name <span className="text-rose-500">*</span></Label>
                    <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Learning Academy" maxLength={100} required autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="org-slug" className="text-sm font-medium">Slug <span className="text-slate-400 font-normal">(optional)</span></Label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">engagio.app/</span>
                        <Input id="org-slug" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")) }} placeholder="acme-learning" maxLength={40} className="pl-[88px]" />
                      </div>
                      {slug && (<span className="hidden items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 sm:flex"><Check className="size-3.5" /> looks good</span>)}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="org-description" className="text-sm font-medium">Description <span className="text-slate-400 font-normal">(optional)</span></Label>
                    <Textarea id="org-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does your organization do?" rows={3} maxLength={500} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select your industry" /></SelectTrigger>
                      <SelectContent>{INDUSTRIES.map((ind) => (<SelectItem key={ind} value={ind}>{ind}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>Back</Button>
                    <Button type="submit" disabled={isSubmitting || !name.trim()} className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700">
                      {isSubmitting ? (<><Loader2 className="size-4 animate-spin" /> Creating…</>) : (<><Sparkles className="size-4" /> Create Organization</>)}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Helper footer */}
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="font-medium">You&apos;ll be the organization owner.</p>
              <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-200/80">
                As the owner, you can invite teammates, manage roles, configure branding, and access all events in this workspace.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
