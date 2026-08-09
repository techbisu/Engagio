'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Mail, MessageSquare, Clock, CheckCircle2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { ViewName } from '@/types'

interface ContactPageProps {
  onNavigate: (view: ViewName) => void
}

export function ContactPage({ onNavigate: _onNavigate }: ContactPageProps) {
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [subject, setSubject] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !message) {
      toast.error('Please fill in all required fields.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address.')
      return
    }
    setSubmitting(true)
    // Simulate submission — in production, this would POST to /api/contact
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setSubmitting(false)
    setSubmitted(true)
    toast.success('Message sent! We\'ll get back to you soon.')
  }

  const channels = [
    {
      icon: Mail,
      title: 'Email us',
      description: 'For general inquiries, partnerships, and support.',
      value: 'hello@engagio.app',
      href: 'mailto:hello@engagio.app',
    },
    {
      icon: MessageSquare,
      title: 'Product feedback',
      description: 'Have a feature request or found a bug? Let us know.',
      value: 'feedback@engagio.app',
      href: 'mailto:feedback@engagio.app',
    },
    {
      icon: Clock,
      title: 'Response time',
      description: 'We typically respond within 24 hours on business days.',
      value: '< 24 hours',
      href: null,
    },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="bg-gradient-to-b from-emerald-50/50 to-background dark:from-emerald-950/20 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <Mail className="size-3" />
              Contact
            </span>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Let&apos;s talk.
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              Questions, feedback, partnership ideas, or just want to say hello?
              We&apos;d love to hear from you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact channels */}
      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-3">
            {channels.map((channel, i) => (
              <motion.div
                key={channel.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="rounded-xl border border-border bg-background p-6 text-center"
              >
                <div className="mx-auto flex size-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <channel.icon className="size-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  {channel.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {channel.description}
                </p>
                {channel.href ? (
                  <a
                    href={channel.href}
                    className="mt-3 inline-block text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {channel.value}
                  </a>
                ) : (
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {channel.value}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact form */}
      <section className="bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-border bg-background p-8 shadow-sm sm:p-10"
          >
            {submitted ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <CheckCircle2 className="size-7" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-foreground">
                  Message sent!
                </h3>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Thanks for reaching out, {name}. We&apos;ll get back to you at{' '}
                  <span className="font-medium text-foreground">{email}</span> within
                  24 hours.
                </p>
                <Button
                  variant="outline"
                  className="mt-6"
                  onClick={() => {
                    setSubmitted(false)
                    setName('')
                    setEmail('')
                    setSubject('')
                    setMessage('')
                  }}
                >
                  Send another message
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  Send us a message
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Fill out the form below and we&apos;ll get back to you as soon as possible.
                </p>
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="mt-1.5"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="mt-1.5"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="What's this about?"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us more..."
                      className="mt-1.5 min-h-[120px]"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-600/90 hover:to-teal-500/90"
                  >
                    {submitting ? (
                      <>Sending...</>
                    ) : (
                      <>
                        <Send className="size-4" /> Send message
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  )
}
