export default function SuperAdminLoginLoading() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-slate-950 px-4">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="text-sm font-medium text-slate-400">Loading super admin…</p>
      </div>
    </div>
  )
}
