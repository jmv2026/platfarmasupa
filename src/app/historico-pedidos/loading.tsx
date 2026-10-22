export default function HistoricoPedidosLoading() {
  return (
    <div className="w-full px-4 sm:px-6 py-6 space-y-6 animate-pulse">
      {/* Title & Filter Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-sermail-green flex items-center justify-center">
            <span className="material-symbols-outlined text-sermail-green text-xl">receipt_long</span>
          </div>
          <div className="space-y-1.5">
            <div className="h-5 w-40 bg-slate-200 rounded"></div>
            <div className="h-3.5 w-60 bg-slate-100 rounded"></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-44 bg-slate-100 rounded-xl"></div>
          <div className="h-9 w-28 bg-slate-100 rounded-xl"></div>
        </div>
      </div>

      {/* Orders Table Skeleton */}
      <div className="sermail-card overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="h-9 w-64 bg-slate-100 rounded-xl"></div>
          <div className="h-9 w-36 bg-slate-100 rounded-xl"></div>
        </div>
        <div className="p-4 space-y-3">
          <div className="h-8 w-full bg-slate-100 rounded"></div>
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="h-14 w-full bg-slate-50 border border-slate-100 rounded-lg flex items-center px-4 gap-4">
              <div className="h-4 w-28 bg-slate-200 rounded"></div>
              <div className="h-4 w-20 bg-slate-100 rounded"></div>
              <div className="h-4 flex-1 bg-slate-100 rounded"></div>
              <div className="h-6 w-24 bg-slate-200 rounded-full"></div>
              <div className="h-4 w-20 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
