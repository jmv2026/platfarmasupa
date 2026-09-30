export default function PedidosLoading() {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-12 animate-pulse">
      <div className="w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Banner Skeleton */}
        <div className="rounded-2xl p-6 bg-gradient-to-r from-sermail-green-dark to-sermail-green text-white shadow-xs">
          <div className="space-y-2.5">
            <div className="h-6 w-40 bg-white/20 rounded-md"></div>
            <div className="h-4 w-60 bg-white/10 rounded-md"></div>
          </div>
        </div>

        {/* Form Container Skeleton */}
        <div className="sermail-card p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="h-4 w-28 bg-slate-200 rounded"></div>
              <div className="h-11 bg-slate-100 rounded-xl"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded"></div>
              <div className="h-11 bg-slate-100 rounded-xl"></div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="h-5 w-36 bg-slate-200 rounded"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-11 flex-1 bg-slate-100 rounded-xl"></div>
                  <div className="h-11 w-32 bg-slate-100 rounded-xl"></div>
                  <div className="h-11 w-11 bg-slate-100 rounded-xl"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
