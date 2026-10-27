export default function StocksLoading() {
  return (
    <div className="w-full px-4 sm:px-6 py-6 space-y-6 animate-pulse">
      {/* Title & Stats Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-sermail-green flex items-center justify-center">
            <span className="material-symbols-outlined text-sermail-green text-xl">inventory_2</span>
          </div>
          <div className="space-y-1.5">
            <div className="h-5 w-32 bg-slate-200 rounded"></div>
            <div className="h-3.5 w-48 bg-slate-100 rounded"></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 bg-slate-100 rounded-xl"></div>
          <div className="h-9 w-40 bg-slate-100 rounded-xl"></div>
        </div>
      </div>

      {/* 4 KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="sermail-card px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-col justify-between gap-1.5 sm:gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 w-full">
                <div className="h-2.5 w-24 bg-slate-200 rounded"></div>
                <div className="h-2 w-16 bg-slate-100 rounded"></div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-slate-100 shrink-0"></div>
            </div>
            <div className="flex items-baseline justify-between pt-0.5">
              <div className="h-6 w-14 bg-slate-200 rounded"></div>
              <div className="h-2.5 w-16 bg-slate-100 rounded"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <div className="h-9 w-32 bg-sermail-green/20 rounded-lg"></div>
        <div className="h-9 w-32 bg-slate-100 rounded-lg"></div>
        <div className="h-9 w-32 bg-slate-100 rounded-lg"></div>
      </div>

      {/* Table Skeleton */}
      <div className="sermail-card overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="h-9 w-64 bg-slate-100 rounded-xl"></div>
          <div className="h-9 w-28 bg-slate-100 rounded-xl"></div>
        </div>
        <div className="p-4 space-y-3">
          <div className="h-8 w-full bg-slate-100 rounded"></div>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
            <div key={row} className="h-12 w-full bg-slate-50 border border-slate-100 rounded-lg flex items-center px-4 gap-4">
              <div className="h-4 w-12 bg-slate-200 rounded"></div>
              <div className="h-4 w-32 bg-slate-200 rounded"></div>
              <div className="h-4 flex-1 bg-slate-100 rounded"></div>
              <div className="h-4 w-24 bg-slate-100 rounded"></div>
              <div className="h-4 w-16 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
