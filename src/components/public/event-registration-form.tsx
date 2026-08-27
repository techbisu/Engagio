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

interface EventRegistrationFormProps {
  eventId: string
  onSuccess?: () => void
}

interface RegistrationField {
  id: string
  label: string
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'checkbox' | 'date' | 'select'
  required: boolean
  options?: string[] // For select fields
}

export function EventRegistrationForm({ eventId, onSuccess }: EventRegistrationFormProps) {
  const queryClient = useQueryClient()
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
    
    // Validate required fields
    const newErrors: Record<string, string> = {}
    data?.forEach((field: RegistrationField) => {
      if (field.required) {
        const value = formData[field.id]
        if (field.type === 'checkbox') {
          if (value !== true) {
            newErrors[field.id] = `Please check ${field.label}`
          }
        } else if (field.type === 'number') {
          if (value === undefined || value === '' || isNaN(Number(value))) {
            newErrors[field.id] = `${field.label} is required`
          }
        } else {
          if (!value || String(value).trim() === '') {
            newErrors[field.id] = `${field.label} is required`
          }
        }
      }
      
      // Email validation
      if (field.type === 'email' && formData[field.id]) {
        const email = String(formData[field.id]).trim()
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          newErrors[field.id] = 'Invalid email format'
        }
      }
      
      // Number validation
      if (field.type === 'number' && formData[field.id] && formData[field.id] !== '') {
        if (isNaN(Number(formData[field.id]))) {
          newErrors[field.id] = 'Please enter a valid number'
        }
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
        const newErrors = { ...prev }
        delete newErrors[fieldId]
        return newErrors
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
        <h3 className="text-2xl font-bold text-white">You're registered!</h3>
        <p className="mt-2 text-white/60">
          Thank you for registering for this event. We'll send you updates soon.
        </p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return null
  }

  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {data.map((field: RegistrationField) => (
            <div key={field.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={field.id} className="text-sm font-medium text-white">
                  {field.label}
                  {field.required && <span className="text-rose-500">*</span>}
                </Label>
              </div>
              
              {field.type === 'textarea' && (
                <Textarea
                  id={field.id}
                  value={String(formData[field.id] || '')}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className="border-white/10 bg-white/5 text-white focus:border-emerald-500"
                  placeholder={`Enter your ${field.label.toLowerCase()}`}
                />
              )}
              
              {field.type === 'checkbox' && (
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={field.id}
                    checked={!!formData[field.id]}
                    onCheckedChange={(checked) => handleChange(field.id, checked)}
                  />
                  <label htmlFor={field.id} className="text-sm text-white/80">
                    I confirm {field.label.toLowerCase()}
                  </label>
                </div>
              )}
              
              {field.type === 'select' && (
                <select
                  id={field.id}
                  value={String(formData[field.id] || '')}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select an option</option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
              
              {field.type === 'date' && (
                <Input
                  id={field.id}
                  type="date"
                  value={String(formData[field.id] || '')}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className="border-white/10 bg-white/5 text-white focus:border-emerald-500"
                />
              )}
              
              {(field.type === 'text' || field.type === 'email' || field.type === 'tel' || field.type === 'number') && (
                <Input
                  id={field.id}
                  type={field.type}
                  value={String(formData[field.id] || '')}
                  onChange={(e) => handleChange(field.id, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                  className="border-white/10 bg-white/5 text-white focus:border-emerald-500"
                  placeholder={`Enter your ${field.label.toLowerCase()}`}
                />
              )}
              
              {errors[field.id] && (
                <p className="text-xs text-rose-500">{errors[field.id]}</p>
              )}
            </div>
          ))}

          <Button
            type="submit"
            size="lg"
            className="w-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
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