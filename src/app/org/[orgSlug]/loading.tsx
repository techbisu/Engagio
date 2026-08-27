export default function OrgLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="h-16 animate-pulse border-b bg-slate-100 dark:bg-slate-900" />
      <div className="flex-1 space-y-6 p-6">
        <div className="space-y-3">
          <div className="h-10 w-2/3 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
