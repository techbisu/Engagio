"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Mail, Users as UsersIcon, Inbox } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { initials } from "@/lib/utils"

import { api } from "./api"
import type { QuizAttemptDto } from "@/types"

interface UserRow {
  email: string
  name: string
  image?: string | null
  attemptCount: number
  lastActive: string
}

/**
 * Simple derived users list — there is no dedicated /api/users yet, so we
 * aggregate from the attempts endpoint.
 */
export function UsersList() {
  const [search, setSearch] = React.useState("")

  const { data, isLoading, isError, error } = useQuery<QuizAttemptDto[]>({
    queryKey: ["attempts", "all"],
    queryFn: () => api<QuizAttemptDto[]>(`/api/attempts/list?all=true`),
  })

  const users = React.useMemo<UserRow[]>(() => {
    if (!data) return []
    const map = new Map<string, UserRow>()
    for (const a of data) {
      const email = a.user?.email || "unknown@example.com"
      const existing = map.get(email)
      if (existing) {
        existing.attemptCount += 1
        if (new Date(a.startedAt) > new Date(existing.lastActive)) {
          existing.lastActive = a.startedAt
        }
      } else {
        map.set(email, {
          email,
          name: a.user?.name || email.split("@")[0],
          image: a.user?.image,
          attemptCount: 1,
          lastActive: a.startedAt,
        })
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.attemptCount - a.attemptCount
    )
  }, [data])

  const filtered = React.useMemo(() => {
    if (!search) return users
    const s = search.toLowerCase()
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(s) ||
        u.name.toLowerCase().includes(s)
    )
  }, [users, search])

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Users</h2>
          <p className="text-sm text-muted-foreground">
            {users.length} unique student{users.length === 1 ? "" : "s"} across all attempts.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by email or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Card>
        {isError ? (
          <CardContent className="py-6 text-sm text-rose-600 dark:text-rose-400">
            Failed to load users: {(error as Error)?.message || "Unknown error"}
          </CardContent>
        ) : isLoading ? (
          <CardContent className="py-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Inbox className="size-7" />
            </div>
            <p className="mt-4 text-lg font-semibold">No users found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search ? "Try a different search." : "Students will appear here after their first attempt."}
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-center">Attempts</TableHead>
                  <TableHead className="hidden sm:table-cell">Last active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.email} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-9">
                          {u.image ? (
                            <AvatarImage src={u.image} alt={u.name} />
                          ) : null}
                          <AvatarFallback className="bg-emerald-50 text-emerald-700 text-xs dark:bg-emerald-500/10 dark:text-emerald-400">
                            {initials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{u.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30 tabular-nums"
                      >
                        {u.attemptCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {new Date(u.lastActive).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <UsersIcon className="size-3.5" />
        User list is derived from recorded quiz attempts. A dedicated users API is not yet available.
      </p>
    </div>
  )
}
