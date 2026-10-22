export default function ConfiguracaoLoading() {
  return (
    <div className="w-full px-4 sm:px-6 py-6 space-y-6 animate-pulse">
      {/* Title Bar Skeleton */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-sermail-green flex items-center justify-center">
            <span className="material-symbols-outlined text-sermail-green text-xl">settings</span>
          </div>
          <div className="space-y-1.5">
            <div className="h-5 w-40 bg-slate-200 rounded"></div>
            <div className="h-3.5 w-64 bg-slate-100 rounded"></div>
          </div>
        </div>
      </div>

      {/* Tabs Row Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {[1, 2, 3, 4, 5, 6, 7].map((tab) => (
          <div
            key={tab}
            className={`h-9 w-28 rounded-lg ${tab === 1 ? 'bg-sermail-green/20' : 'bg-slate-100'}`}
          ></div>
        ))}
      </div>

      {/* Settings Form/Table Card Skeleton */}
      <div className="sermail-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-48 bg-slate-200 rounded"></div>
          <div className="h-9 w-32 bg-slate-100 rounded-xl"></div>
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 w-full bg-slate-50 border border-slate-100 rounded-lg flex items-center px-4 gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-200"></div>
              <div className="h-4 w-36 bg-slate-200 rounded"></div>
              <div className="h-4 flex-1 bg-slate-100 rounded"></div>
              <div className="h-4 w-24 bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
