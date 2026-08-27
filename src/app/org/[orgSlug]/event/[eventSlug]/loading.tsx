export default function OrgEventLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="h-16 animate-pulse border-b bg-slate-100 dark:bg-slate-900" />
      <div className="flex-1 space-y-6 p-6">
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-3">
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
