export default function VerifyLoading() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Verifying…
        </p>
      </div>
    </div>
  )
}
