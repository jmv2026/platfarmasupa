export default function HistoricoPedidosLoading() {
  return (
    <div className="w-full px-4 sm:px-6 pt-1 pb-6 space-y-4 sm:space-y-6 animate-pulse">
      {/* Title & Filter Bar Skeleton (48px / h-12) */}
      <div className="bg-gradient-to-r from-sermail-green-dark via-sermail-green to-[#005a46] rounded-xl px-4 sm:px-6 h-12 shadow-sm border border-emerald-950/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white/40 text-base">receipt_long</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-[2cm]">
            <div className="h-4 w-40 bg-white/25 rounded"></div>
            <div className="h-3 w-60 bg-white/15 rounded"></div>
          </div>
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
