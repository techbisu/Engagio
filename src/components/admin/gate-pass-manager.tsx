"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Download, Loader2, QrCode, User, RefreshCw, Ban, CheckCircle2,
  Clock, Search, ImageIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface GatePass {
  id: string
  passNumber: string
  participantName: string
  participantEmail: string
  status: string
  cardImageUrl: string | null
  checkedInAt: string | null
  checkedOutAt: string | null
  createdAt: string
  event: { id: string; title: string; slug: string }
}

export function GatePassManager({ eventId: initialEventId }: { eventId: string }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [selectedEventId, setSelectedEventId] = React.useState(initialEventId || "")

  // Fetch events for the dropdown selector
  const { data: eventsData } = useQuery<{ events: { id: string; title: string }[] }>({
    queryKey: ["events", "list"],
    queryFn: () => fetch("/api/events").then((r) => r.json()),
  })
  const events = eventsData?.events ?? []
  const activeEventId = selectedEventId || initialEventId

  const { data, isLoading } = useQuery<{ gatePasses: GatePass[] }>({
    queryKey: ["gate-passes", activeEventId],
    queryFn: () => fetch(`/api/gate-passes?eventId=${activeEventId}`).then((r) => r.json()),
    enabled: !!activeEventId,
  })

  const generateAllMutation = useMutation({
    mutationFn: async () => {
      const regsRes = await fetch(`/api/events/${activeEventId}/registrations`)
      const regs = await regsRes.json()
      const results = []
      for (const reg of (regs.registrations || [])) {
        const res = await fetch("/api/gate-passes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: activeEventId,
            userId: reg.userId,
            registrationId: reg.id,
            participantName: reg.user?.name || reg.user?.email?.split("@")[0] || "Participant",
            participantEmail: reg.user?.email || "",
          }),
        })
        const data = await res.json()
        // Generate the ID card PNG for each new pass
        if (!data.alreadyExists && data.gatePass?.id) {
          await fetch(`/api/gate-passes/${data.gatePass.id}/generate-card`, {
            method: "POST",
          })
        }
        results.push(data)
      }
      return results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gate-passes", activeEventId] })
      toast.success("Gate passes generated for all registered participants!")
    },
    onError: () => toast.error("Failed to generate gate passes"),
  })

  const generateCardMutation = useMutation({
    mutationFn: async (passId: string) => {
      const res = await fetch(`/api/gate-passes/${passId}/generate-card`, { method: "POST" })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gate-passes", activeEventId] })
      toast.success("ID card generated!")
    },
    onError: () => toast.error("Failed to generate ID card"),
  })

  const checkinMutation = useMutation({
    mutationFn: async (passId: string) => {
      const res = await fetch(`/api/gate-passes/${passId}/checkin`, { method: "POST" })
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["gate-passes", activeEventId] })
      toast.success(data.action === "checked_in" ? "Checked in!" : "Checked out!")
    },
    onError: () => toast.error("Check-in failed"),
  })

  const revokeMutation = useMutation({
    mutationFn: async (passId: string) => {
      const res = await fetch(`/api/gate-passes/${passId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Revoked by admin" }),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gate-passes", activeEventId] })
      toast.success("Gate pass revoked")
    },
    onError: () => toast.error("Failed to revoke"),
  })

  const passes = data?.gatePasses ?? []
  const filtered = passes.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.participantName.toLowerCase().includes(q) ||
      p.participantEmail.toLowerCase().includes(q) ||
      p.passNumber.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="size-5 text-emerald-600" /> Gate Passes & ID Cards
              </CardTitle>
              <CardDescription>Generate ID cards, check in participants, and verify gate passes.</CardDescription>
            </div>
            {activeEventId && (
            <Button
              onClick={() => generateAllMutation.mutate()}
              disabled={generateAllMutation.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {generateAllMutation.isPending ? (
                <><Loader2 className="size-4 animate-spin" /> Generating...</>
              ) : (
                <><RefreshCw className="size-4" /> Generate for All</>
              )}
            </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Event selector */}
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Select Event:</label>
            <select
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              <option value="">— Choose an event —</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>

          {!activeEventId ? (
            <div className="py-12 text-center text-muted-foreground">
              <QrCode className="mx-auto mb-3 size-12 opacity-30" />
              <p>Select an event to manage gate passes.</p>
            </div>
          ) : (
            <>
          {/* Search */}
          <div className="mb-4 relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or pass number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Stats */}
          <div className="mb-4 flex gap-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{passes.length}</p>
              <p className="text-xs text-muted-foreground">Total Passes</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">
                {passes.filter((p) => p.status === "CHECKED_IN").length}
              </p>
              <p className="text-xs text-muted-foreground">Checked In</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-rose-600">
                {passes.filter((p) => p.status === "REVOKED").length}
              </p>
              <p className="text-xs text-muted-foreground">Revoked</p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pass No.</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>ID Card</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No gate passes yet. Click "Generate for All" to create passes for all registered participants.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((pass) => (
                    <TableRow key={pass.id}>
                      <TableCell className="font-mono text-sm">{pass.passNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{pass.participantName}</p>
                          <p className="text-xs text-muted-foreground">{pass.participantEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            pass.status === "ACTIVE" && "bg-amber-100 text-amber-700",
                            pass.status === "CHECKED_IN" && "bg-emerald-100 text-emerald-700",
                            pass.status === "CHECKED_OUT" && "bg-slate-100 text-slate-600",
                            pass.status === "REVOKED" && "bg-rose-100 text-rose-700",
                          )}
                        >
                          {pass.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {pass.checkedInAt ? (
                          <span className="text-xs text-muted-foreground">
                            {new Date(pass.checkedInAt).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not checked in</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {pass.cardImageUrl ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const a = document.createElement("a")
                              a.href = pass.cardImageUrl!
                              a.download = `gate-pass-${pass.passNumber}.png`
                              a.click()
                            }}
                          >
                            <Download className="size-3" /> Download
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateCardMutation.mutate(pass.id)}
                            disabled={generateCardMutation.isPending}
                          >
                            {generateCardMutation.isPending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <ImageIcon className="size-3" />
                            )}
                            Generate
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {pass.status !== "REVOKED" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => checkinMutation.mutate(pass.id)}
                                disabled={checkinMutation.isPending}
                              >
                                {pass.status === "CHECKED_IN" ? (
                                  <><Clock className="size-3" /> Check Out</>
                                ) : (
                                  <><CheckCircle2 className="size-3" /> Check In</>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => revokeMutation.mutate(pass.id)}
                                disabled={revokeMutation.isPending}
                                className="text-rose-600 hover:text-rose-700"
                              >
                                <Ban className="size-3" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              window.open(`/gate/${pass.passNumber}`, "_blank")
                            }}
                          >
                            <QrCode className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
