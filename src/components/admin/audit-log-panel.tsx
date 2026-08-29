"use client"

/**
 * Audit log panel — shows recent admin actions for the current org.
 * Read-only. Fetches from /api/organizations/[id]/audit-log.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Shield, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api } from "./api"

interface AuditLogEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  metadata: string | null
  createdAt: string
  actorName: string | null
  actorEmail: string | null
}

export function AuditLogPanel({ orgId }: { orgId: string }) {
  const { data, isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ["audit-log", orgId],
    queryFn: () => api<AuditLogEntry[]>(`/api/organizations/${orgId}/audit-log`),
    enabled: !!orgId,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
      </div>
    )
  }

  const logs = data || []

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Shield className="mx-auto mb-3 size-10 opacity-30" />
          <p>No audit log entries yet.</p>
          <p className="text-xs mt-1">Admin actions will appear here.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="size-4 text-emerald-600" /> Audit Log
          <Badge variant="secondary" className="ml-auto">{logs.length} entries</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[60vh]">
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                    >
                      {log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {log.entityType}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {log.actorName || log.actorEmail || "System"} ·{" "}
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
