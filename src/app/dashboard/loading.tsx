export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b bg-white px-6 py-4 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="size-8 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
        <div className="size-9 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="grid flex-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="size-9 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-7 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
      <div className="px-6 pb-6">
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      </div>
    </div>
  )
}
