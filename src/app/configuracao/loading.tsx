export default function ConfiguracaoLoading() {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-12 animate-pulse">
      <div className="w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Banner Skeleton */}
        <div className="rounded-2xl p-6 bg-gradient-to-r from-sermail-green-dark to-sermail-green text-white shadow-xs">
          <div className="space-y-2.5">
            <div className="h-6 w-44 bg-white/20 rounded-md"></div>
            <div className="h-4 w-64 bg-white/10 rounded-md"></div>
          </div>
        </div>

        {/* Tabs Bar Skeleton */}
        <div className="sermail-card p-2 flex items-center gap-2 overflow-x-auto">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 w-28 bg-slate-100 rounded-lg shrink-0"></div>
          ))}
        </div>

        {/* Content Panel Skeleton */}
        <div className="sermail-card p-6 space-y-4">
          <div className="h-5 w-40 bg-slate-200 rounded"></div>
          <div className="space-y-3 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
