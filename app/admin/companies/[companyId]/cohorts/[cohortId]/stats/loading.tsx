export default function CohortStatsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 w-16 rounded bg-white/5" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-white/5" />
        <div className="space-y-1.5">
          <div className="h-5 w-48 rounded bg-white/5" />
          <div className="h-3 w-24 rounded bg-white/5" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
            <div className="h-3 w-20 rounded bg-white/5" />
            <div className="h-7 w-10 rounded bg-white/5" />
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex gap-2">
        <div className="flex-1 h-8 rounded-md bg-white/5" />
        <div className="h-8 w-28 rounded-md bg-white/5" />
        <div className="h-8 w-24 rounded-md bg-white/5" />
      </div>

      {/* Learner rows */}
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className="h-8 w-8 rounded-full bg-white/5 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 rounded bg-white/5" />
              <div className="h-2.5 w-44 rounded bg-white/5" />
            </div>
            <div className="h-5 w-20 rounded-full bg-white/5 hidden sm:block" />
            <div className="h-1.5 w-32 rounded-full bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  )
}
