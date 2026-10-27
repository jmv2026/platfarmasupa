export default function DashboardLoading() {
  return (
    <div className="w-full px-4 sm:px-6 py-6 space-y-6 animate-pulse">
      {/* Banner Skeleton (48px / h-12) */}
      <div className="bg-gradient-to-r from-sermail-green-dark via-sermail-green to-[#005a46] rounded-xl px-4 sm:px-6 h-12 flex items-center shadow-sm border border-emerald-950/30">
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md shrink-0"></div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-[2cm]">
              <div className="h-4 w-40 bg-white/25 rounded-md"></div>
              <div className="h-3 w-56 bg-white/15 rounded-md"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar Skeleton */}
      <div className="flex items-center justify-between bg-white border border-slate-200/90 rounded-2xl px-5 py-3.5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-slate-100"></div>
          <div className="h-4 w-32 bg-slate-200 rounded"></div>
        </div>
        <div className="h-8 w-64 bg-slate-100 rounded-xl"></div>
      </div>

      {/* 6 KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="sermail-card px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-col justify-between gap-1.5 sm:gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 w-full">
                <div className="h-2.5 w-20 bg-slate-200 rounded"></div>
                <div className="h-2 w-16 bg-slate-100 rounded"></div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-slate-100 shrink-0"></div>
            </div>
            <div className="flex items-baseline justify-between pt-0.5">
              <div className="h-6 w-12 bg-slate-200 rounded"></div>
              <div className="h-2.5 w-14 bg-slate-100 rounded"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart Selector Buttons Skeleton */}
      <div className="flex items-center gap-2.5 pt-1">
        <div className="h-9 w-36 bg-slate-200 rounded-xl"></div>
        <div className="h-9 w-36 bg-slate-100 rounded-xl"></div>
        <div className="h-9 w-36 bg-slate-100 rounded-xl"></div>
        <div className="h-9 w-40 bg-slate-100 rounded-xl"></div>
      </div>

      {/* Chart Box Skeleton */}
      <div className="sermail-card p-6 min-h-[360px] flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-44 bg-slate-200 rounded"></div>
          <div className="h-7 w-32 bg-slate-100 rounded-lg"></div>
        </div>
        <div className="h-60 w-full bg-slate-50 rounded-xl flex items-end gap-3 p-4">
          {[40, 65, 30, 85, 55, 70, 95, 60, 45, 80, 50, 75].map((h, idx) => (
            <div
              key={idx}
              className="flex-1 bg-slate-200/80 rounded-t"
              style={{ height: `${h}%` }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
}
