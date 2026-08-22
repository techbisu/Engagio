"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { CheckCircle2, XCircle, Clock, Download, QrCode, Calendar, User, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface GatePassData {
  valid: boolean
  revoked?: boolean
  passNumber: string
  participantName: string
  participantEmail?: string
  eventTitle: string
  eventStartDate?: string
  eventEndDate?: string
  orgName?: string
  status?: string
  checkedIn?: boolean
  checkedInAt?: string
  checkedOutAt?: string
  cardImageUrl?: string
  revokedAt?: string
  reason?: string
}

export default function GateVerifyPage() {
  const params = useParams<{ token: string }>()
  const token = params.token

  const { data, isLoading, isError } = useQuery<GatePassData>({
    queryKey: ["gate", token],
    queryFn: () =>
      fetch(`/api/gate/${token}`).then((r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json()
      }),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <XCircle className="size-16 text-rose-500" />
        <h1 className="text-2xl font-bold">Gate pass not found</h1>
        <p className="text-white/60">This gate pass token is invalid or has been deleted.</p>
      </div>
    )
  }

  const isRevoked = data.revoked || data.status === "REVOKED"
  const isCheckedIn = data.checkedIn || data.status === "CHECKED_IN"

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-md px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Status banner */}
          <div className="mb-6 flex justify-center">
            {isRevoked ? (
              <div className="flex flex-col items-center gap-2">
                <XCircle className="size-20 text-rose-500" />
                <h1 className="text-2xl font-bold text-rose-400">REVOKED</h1>
                {data.reason && (
                  <p className="text-sm text-white/60">Reason: {data.reason}</p>
                )}
              </div>
            ) : isCheckedIn ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="size-20 text-emerald-500" />
                <h1 className="text-2xl font-bold text-emerald-400">CHECKED IN</h1>
                {data.checkedInAt && (
                  <p className="text-sm text-white/60">
                    {new Date(data.checkedInAt).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="size-20 text-emerald-500" />
                <h1 className="text-2xl font-bold text-emerald-400">VALID PASS</h1>
              </div>
            )}
          </div>

          {/* Card */}
          <Card className="border-white/10 bg-white/5 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-center text-lg">{data.eventTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Participant info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-emerald-400" />
                  <span className="text-white/60">Name:</span>
                  <span className="font-semibold">{data.participantName}</span>
                </div>
                {data.participantEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-white/60">Email:</span>
                    <span>{data.participantEmail}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <QrCode className="size-4 text-emerald-400" />
                  <span className="text-white/60">Pass No:</span>
                  <span className="font-mono font-semibold">{data.passNumber}</span>
                </div>
                {data.orgName && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="size-4 text-emerald-400" />
                    <span className="text-white/60">Organization:</span>
                    <span>{data.orgName}</span>
                  </div>
                )}
                {data.eventStartDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="size-4 text-emerald-400" />
                    <span className="text-white/60">Dates:</span>
                    <span>
                      {new Date(data.eventStartDate).toLocaleDateString()} -
                      {data.eventEndDate ? new Date(data.eventEndDate).toLocaleDateString() : ""}
                    </span>
                  </div>
                )}
              </div>

              {/* Status badge */}
              <div className="flex justify-center">
                <Badge
                  className={
                    isRevoked
                      ? "bg-rose-500/20 text-rose-400"
                      : isCheckedIn
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-400"
                  }
                >
                  {isRevoked ? "REVOKED" : isCheckedIn ? "CHECKED IN" : "ACTIVE"}
                </Badge>
              </div>

              {/* Card image */}
              {data.cardImageUrl && (
                <div className="flex justify-center">
                  <img
                    src={data.cardImageUrl}
                    alt="ID Card"
                    className="max-w-full rounded-xl shadow-lg"
                  />
                </div>
              )}

              {/* Download button */}
              {data.cardImageUrl && !isRevoked && (
                <Button
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => {
                    const a = document.createElement("a")
                    a.href = data.cardImageUrl!
                    a.download = `gate-pass-${data.passNumber}.png`
                    a.click()
                  }}
                >
                  <Download className="size-4" /> Download ID Card
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-white/40">
            Powered by Engagio
          </p>
        </motion.div>
      </div>
    </div>
  )
}
