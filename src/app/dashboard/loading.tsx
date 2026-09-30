export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-12 animate-pulse">
      {/* Skeleton Top Bar Contextual */}
      <div className="w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Banner Skeleton */}
        <div className="rounded-2xl p-6 bg-gradient-to-r from-sermail-green-dark to-sermail-green text-white shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2.5">
              <div className="h-6 w-48 bg-white/20 rounded-md"></div>
              <div className="h-4 w-72 bg-white/10 rounded-md"></div>
            </div>
            <div className="h-8 w-36 bg-white/15 rounded-full"></div>
          </div>
        </div>

        {/* 6 KPI Cards Grid Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="sermail-card p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-20 bg-slate-200 rounded"></div>
                <div className="w-7 h-7 rounded-lg bg-slate-100"></div>
              </div>
              <div className="h-7 w-24 bg-slate-200 rounded"></div>
              <div className="h-3 w-16 bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>

        {/* Client Filter Card Skeleton */}
        <div className="sermail-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="h-4 w-32 bg-slate-200 rounded"></div>
          <div className="h-10 w-full sm:w-72 bg-slate-100 rounded-xl"></div>
        </div>

        {/* Chart Card Skeleton */}
        <div className="sermail-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-44 bg-slate-200 rounded"></div>
            <div className="flex gap-2">
              <div className="h-9 w-24 bg-slate-100 rounded-xl"></div>
              <div className="h-9 w-24 bg-slate-100 rounded-xl"></div>
            </div>
          </div>
          <div className="h-72 w-full bg-slate-100 rounded-xl"></div>
        </div>
      </div>
    </div>
  );
}
