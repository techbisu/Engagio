'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, CheckCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { useCurrentUser } from '@/components/shared/use-current-user'

interface EventRegistrationFormProps {
  eventId: string
  onSuccess?: () => void
}

interface RegistrationField {
  id: string
  label: string
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'checkbox' | 'date' | 'select'
  required: boolean
  options?: string[]
  placeholder?: string | null
  helpText?: string | null
}

export function EventRegistrationForm({ eventId, onSuccess }: EventRegistrationFormProps) {
  const queryClient = useQueryClient()
  const { user } = useCurrentUser()
  const [formData, setFormData] = React.useState<Record<string, string | number | boolean>>({})
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Fetch registration fields
  const { data, isLoading: isFieldsLoading } = useQuery({
    queryKey: ['event-fields', eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/fields`)
      if (!res.ok) throw new Error('Failed to fetch fields')
      return res.json() as Promise<RegistrationField[]>
    },
  })

  // Auto-fill name and email from the logged-in user's profile
  React.useEffect(() => {
    if (!data || !user) return
    const prefilled: Record<string, string | number | boolean> = {}
    data.forEach((field) => {
      if (field.type === 'email' && user.email) {
        prefilled[field.id] = user.email
      }
      if ((field.label.toLowerCase().includes('name') || field.label.toLowerCase().includes('participant')) && user.name) {
        prefilled[field.id] = user.name
      }
    })
    if (Object.keys(prefilled).length > 0) {
      setFormData((prev) => ({ ...prefilled, ...prev }))
    }
  }, [data, user])

  // Check if already registered
  const { data: checkData, isLoading: isCheckLoading } = useQuery({
    queryKey: ['registration-check', eventId],
    queryFn: async () => {
      const res = await fetch(`/api/registrations/check?eventId=${eventId}`)
      if (!res.ok) throw new Error('Failed to check registration')
      return res.json()
    },
    retry: false,
  })

  // Submit registration
  const { mutate: submitRegistration, isPending } = useMutation({
    mutationFn: async (data: Record<string, string | number | boolean>) => {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, data }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to submit registration')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registration-check', eventId] })
      toast.success('Registration successful!')
      onSuccess?.()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit registration')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    data?.forEach((field: RegistrationField) => {
      if (field.required) {
        const value = formData[field.id]
        if (field.type === 'checkbox') {
          if (value !== true) newErrors[field.id] = `Please check ${field.label}`
        } else if (field.type === 'number') {
          if (value === undefined || value === '' || isNaN(Number(value))) newErrors[field.id] = `${field.label} is required`
        } else {
          if (!value || String(value).trim() === '') newErrors[field.id] = `${field.label} is required`
        }
      }
      if (field.type === 'email' && formData[field.id]) {
        const email = String(formData[field.id]).trim()
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) newErrors[field.id] = 'Invalid email format'
      }
    })
    setErrors(newErrors)
    if (Object.keys(newErrors).length === 0) {
      submitRegistration(formData)
    }
  }

  const handleChange = (fieldId: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
    if (errors[fieldId]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
    }
  }

  if (isFieldsLoading || isCheckLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (checkData?.registered) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-6 grid size-20 place-items-center rounded-full bg-emerald-500/20">
          <CheckCircle className="size-10 text-emerald-500" />
        </div>
        <h3 className="text-2xl font-bold">You&apos;re registered!</h3>
        <p className="mt-2 text-muted-foreground">
          Thank you for registering for this event. We&apos;ll send you updates soon.
        </p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return null
  }

  // Use theme-aware (light/dark) styling — no hardcoded white-on-dark colors.
  return (
    <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {data.map((field: RegistrationField) => (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={field.id} className="text-sm font-medium text-foreground">
                {field.label}
                {field.required && <span className="text-rose-500"> *</span>}
              </Label>

              {field.type === 'textarea' && (
                <Textarea
                  id={field.id}
                  value={String(formData[field.id] || '')}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  placeholder={field.placeholder || `Enter your ${field.label.toLowerCase()}`}
                />
              )}

              {field.type === 'checkbox' && (
                <div className="flex items-center gap-3 py-1">
                  <Checkbox
                    id={field.id}
                    checked={!!formData[field.id]}
                    onCheckedChange={(checked) => handleChange(field.id, checked)}
                  />
                  <label htmlFor={field.id} className="text-sm text-muted-foreground">
                    I confirm {field.label.toLowerCase()}
                  </label>
                </div>
              )}

              {field.type === 'select' && (
                <select
                  id={field.id}
                  value={String(formData[field.id] || '')}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm text-foreground focus:border-emerald-500 focus:outline-none dark:border-slate-800"
                >
                  <option value="">Select an option</option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              )}

              {field.type === 'date' && (
                <Input
                  id={field.id}
                  type="date"
                  value={String(formData[field.id] || '')}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                />
              )}

              {(field.type === 'text' || field.type === 'email' || field.type === 'tel' || field.type === 'number') && (
                <Input
                  id={field.id}
                  type={field.type}
                  value={String(formData[field.id] || '')}
                  onChange={(e) => handleChange(field.id, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                  placeholder={field.placeholder || `Enter your ${field.label.toLowerCase()}`}
                  readOnly={field.type === 'email' && !!user?.email && formData[field.id] === user.email}
                />
              )}

              {field.helpText && (
                <p className="text-xs italic text-muted-foreground">{field.helpText}</p>
              )}

              {errors[field.id] && (
                <p className="text-xs text-rose-500">{errors[field.id]}</p>
              )}
            </div>
          ))}

          <Button
            type="submit"
            size="lg"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Complete Registration <ArrowRight className="ml-2 size-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
