export default function PedidosLoading() {
  return (
    <div className="w-full px-4 sm:px-6 py-6 space-y-6 animate-pulse">
      {/* Header Card Skeleton */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-sermail-green flex items-center justify-center">
            <span className="material-symbols-outlined text-sermail-green text-xl">add_shopping_cart</span>
          </div>
          <div className="space-y-1.5">
            <div className="h-5 w-36 bg-slate-200 rounded"></div>
            <div className="h-3.5 w-56 bg-slate-100 rounded"></div>
          </div>
        </div>
        <div className="h-9 w-48 bg-slate-100 rounded-xl"></div>
      </div>

      {/* Form Fields Grid Skeleton */}
      <div className="sermail-card p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="h-3.5 w-24 bg-slate-200 rounded"></div>
            <div className="h-10 w-full bg-slate-100 rounded-xl"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3.5 w-28 bg-slate-200 rounded"></div>
            <div className="h-10 w-full bg-slate-100 rounded-xl"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3.5 w-20 bg-slate-200 rounded"></div>
            <div className="h-10 w-full bg-slate-100 rounded-xl"></div>
          </div>
        </div>

        {/* Lines Table Skeleton */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 bg-slate-200 rounded"></div>
            <div className="h-8 w-28 bg-slate-100 rounded-lg"></div>
          </div>
          <div className="h-10 w-full bg-slate-100 rounded-lg"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 w-full bg-slate-50 border border-slate-100 rounded-lg flex items-center px-4 gap-4">
              <div className="h-4 flex-1 bg-slate-200 rounded"></div>
              <div className="h-4 w-24 bg-slate-100 rounded"></div>
              <div className="h-4 w-20 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
