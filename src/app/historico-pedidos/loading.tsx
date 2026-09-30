export default function HistoricoPedidosLoading() {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-12 animate-pulse">
      <div className="w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Banner Skeleton */}
        <div className="rounded-2xl p-6 bg-gradient-to-r from-sermail-green-dark to-sermail-green text-white shadow-xs">
          <div className="space-y-2.5">
            <div className="h-6 w-48 bg-white/20 rounded-md"></div>
            <div className="h-4 w-72 bg-white/10 rounded-md"></div>
          </div>
        </div>

        {/* Filter Card Skeleton */}
        <div className="sermail-card p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="h-10 bg-slate-100 rounded-xl"></div>
            <div className="h-10 bg-slate-100 rounded-xl"></div>
            <div className="h-10 bg-slate-100 rounded-xl"></div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="sermail-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="h-5 w-36 bg-slate-200 rounded"></div>
            <div className="h-8 w-28 bg-slate-100 rounded-lg"></div>
          </div>
          <div className="divide-y divide-slate-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-4 flex items-center justify-between gap-4">
                <div className="h-4 w-32 bg-slate-200 rounded"></div>
                <div className="h-4 w-40 bg-slate-100 rounded"></div>
                <div className="h-4 w-24 bg-slate-100 rounded"></div>
                <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
