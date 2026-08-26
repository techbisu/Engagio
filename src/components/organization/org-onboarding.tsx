"use client"

import * as React from "react"
import { useSession, signIn } from "next-auth/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  ArrowRight,
  Building2,
  Mail,
  Check,
  CheckCircle2,
  Loader2,
  Lock,
  ShieldCheck,
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
  onCreated: (orgId: string, orgSlug?: string) => void
  /** Called when the user clicks the small "back to home" link. Disabled by default. */
  onCancel?: () => void
  /** When the onboarding is forced (must complete), the user can't leave. */
  forced?: boolean
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



export function OrgOnboarding({ onCreated, onCancel, forced = true }: OrgOnboardingProps) {
  const { data: session, status: sessionStatus } = useSession()
  const queryClient = useQueryClient()

  // If the user already has a session, skip Step 1.
  const hasSession = sessionStatus === "authenticated" && !!session?.user?.email

  const [step, setStep] = React.useState<1 | 2>(hasSession ? 2 : 1)

  // Step 2: Organization details
  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [slugTouched, setSlugTouched] = React.useState(false)
  const [description, setDescription] = React.useState("")
  const [industry, setIndustry] = React.useState<string>("")

  // Step 1: Inline login
  const [loginEmail, setLoginEmail] = React.useState("")
  const [loginPassword, setLoginPassword] = React.useState("")
  const [loginLoading, setLoginLoading] = React.useState(false)

  // Auto-advance to Step 2 as soon as we have a session.
  React.useEffect(() => {
    if (hasSession && step === 1) {
      setStep(2)
    }
  }, [hasSession, step])

  // Auto-generate slug from name unless manually edited.
  React.useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(name))
    }
  }, [name, slugTouched])

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.email) {
        throw new Error("Session not found. Please sign in first.")
      }
      const data = await api<CreateOrgResponse>("/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: description.trim() || undefined,
          industry: industry || undefined,
          // Use the authenticated user's email/name.
          adminName: session.user.name || session.user.email.split("@")[0],
          adminEmail: session.user.email.toLowerCase(),
          adminPassword: undefined,
        }),
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
      onCreated(data.organization.id, data.organization.slug)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to create organization"
      toast.error("Could not create organization", { description: msg })
    },
  })



  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Organization name is required")
      return
    }
    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      toast.error("Slug can only contain lowercase letters, numbers, and hyphens")
      return
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
        {/* Top bar — only show cancel/home link when NOT forced */}
        <div className="mb-8 flex items-center justify-between">
          <BrandLogo size="sm" />
          {forced ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <Lock className="size-3" />
              Complete setup to continue
            </div>
          ) : (
            onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="gap-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Back to home
              </Button>
            )
          )}
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

              {/* Progress indicator */}
              <div className="mt-6 flex items-center gap-3">
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                    step === 1
                      ? "bg-white text-emerald-700"
                      : "bg-white/20 text-white"
                  )}
                >
                  {step > 1 ? <CheckCircle2 className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
                  1. Sign in
                </div>
                <div className="h-px flex-1 bg-white/30" />
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                    step === 2
                      ? "bg-white text-emerald-700"
                      : "bg-white/20 text-white"
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  2. Organization details
                </div>
              </div>
            </div>

            <CardHeader className="pt-6">
              <CardTitle className="text-base text-slate-900 dark:text-slate-50">
                {step === 1 ? "Step 1: Sign In" : "Step 2: Organization Details"}
              </CardTitle>
              <CardDescription>
                {step === 1
                  ? "Sign in with your email and password to create your organization."
                  : "Tell us about your organization. You can change everything later."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="space-y-6"
                  >
                    <div className="space-y-3">
                      <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (!loginEmail) {
                          toast.error("Please enter your email.")
                          return
                        }
                        if (!loginPassword) {
                          toast.error("Please enter your password.")
                          return
                        }
                        setLoginLoading(true)
                        signIn("credentials", {
                          email: loginEmail,
                          password: loginPassword,
                          redirect: false,
                        })
                          .then((res) => {
                            if (!res || res.error) {
                              if (res?.error === "EMAIL_NOT_VERIFIED") {
                                toast.error("Please verify your email first. Check your inbox.")
                              } else {
                                toast.error("Invalid email or password.")
                              }
                              return
                            }
                            toast.success("Signed in!")
                            window.location.reload()
                          })
                          .catch(() => {
                            toast.error("Something went wrong. Please try again.")
                          })
                          .finally(() => {
                            setLoginLoading(false)
                          })
                      }}
                      className="space-y-3.5"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="onboard-email" className="text-sm font-medium">
                          Email
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            id="onboard-email"
                            type="email"
                            placeholder="you@example.com"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            autoComplete="email"
                            required
                            disabled={loginLoading}
                            className="pl-9"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="onboard-password" className="text-sm font-medium">
                          Password
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            id="onboard-password"
                            type="password"
                            placeholder="••••••••"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                            disabled={loginLoading}
                            className="pl-9"
                          />
                        </div>
                        <div className="text-right">
                          <a href="/forgot-password" className="text-xs text-emerald-600 hover:underline dark:text-emerald-400">
                            Forgot password?
                          </a>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700"
                        disabled={loginLoading}
                      >
                        {loginLoading ? (
                          <>
                            <Loader2 className="size-4 animate-spin" /> Signing in...
                          </>
                        ) : (
                          <>
                            Sign In <ArrowRight className="size-4" />
                          </>
                        )}
                      </Button>
                    </form>

                    <div className="text-center text-xs text-slate-500 dark:text-slate-400">
                      Don&apos;t have an account?{" "}
                      <a href="/register?mode=admin" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                        Register here
                      </a>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>Your account is used to verify your identity.</span>
                    </div>

                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                      <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <p className="font-medium">Free plan, no credit card required.</p>
                          <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-200/80">
                            You can host up to 3 events and 50 participants on the free plan. Upgrade anytime.
                          </p>
                        </div>
                      </div>
                    </div>
</div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="step2"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    onSubmit={handleStep2Submit}
                    className="space-y-5"
                  >
                    {/* Authenticated user chip */}
                    {session?.user && (
                      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                        {session.user.image ? (
                          <img
                            src={session.user.image}
                            alt=""
                            className="size-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="grid size-8 place-items-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                            {(session.user.name || session.user.email || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {session.user.name || "Signed in"}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {session.user.email}
                          </p>
                        </div>
                        <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="org-name" className="text-sm font-medium">
                        Organization name <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="org-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Acme Learning Academy"
                        maxLength={100}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="org-slug" className="text-sm font-medium">
                        Slug <span className="font-normal text-slate-400">(optional)</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                            engagio.app/
                          </span>
                          <Input
                            id="org-slug"
                            value={slug}
                            onChange={(e) => {
                              setSlugTouched(true)
                              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                            }}
                            placeholder="acme-learning"
                            maxLength={40}
                            className="pl-[88px]"
                          />
                        </div>
                        {slug && (
                          <span className="hidden items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 sm:flex">
                            <Check className="size-3.5" /> looks good
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="org-description" className="text-sm font-medium">
                        Description <span className="font-normal text-slate-400">(optional)</span>
                      </Label>
                      <Textarea
                        id="org-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What does your organization do?"
                        rows={3}
                        maxLength={500}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Industry</Label>
                      <Select value={industry} onValueChange={setIndustry}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select your industry" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.map((ind) => (
                            <SelectItem key={ind} value={ind}>
                              {ind}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                      {/* No back button — user must complete the form (forced). */}
                      <Button
                        type="submit"
                        disabled={isSubmitting || !name.trim()}
                        className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="size-4 animate-spin" /> Creating…
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-4" /> Create Organization
                            <ArrowRight className="size-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
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
