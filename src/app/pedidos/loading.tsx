export default function PedidosLoading() {
  return (
    <div className="w-full px-4 sm:px-6 pt-1 pb-6 space-y-4 sm:space-y-6 animate-pulse">
      {/* Header Card Skeleton (48px / h-12) */}
      <div className="bg-gradient-to-r from-sermail-green-dark via-sermail-green to-[#005a46] rounded-xl px-4 sm:px-6 h-12 shadow-sm border border-emerald-950/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white/40 text-base">add_shopping_cart</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-[2cm]">
            <div className="h-4 w-36 bg-white/25 rounded"></div>
            <div className="h-3 w-56 bg-white/15 rounded"></div>
          </div>
        </div>
      </div>

      {/* Form Panels Skeleton (Side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Panel: Dados do Pedido */}
        <div className="lg:col-span-4 bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-4">
          <div className="h-4 w-32 bg-slate-200 rounded"></div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="h-3 w-24 bg-slate-200 rounded"></div>
              <div className="h-9 w-full bg-slate-100 rounded-lg"></div>
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-28 bg-slate-200 rounded"></div>
              <div className="h-9 w-full bg-slate-100 rounded-lg"></div>
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-20 bg-slate-200 rounded"></div>
              <div className="h-9 w-full bg-slate-100 rounded-lg"></div>
            </div>
          </div>
        </div>

        {/* Right Panel: Destino / Destinatário */}
        <div className="lg:col-span-8 bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-40 bg-slate-200 rounded"></div>
            <div className="h-7 w-24 bg-slate-200 rounded-lg"></div>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-4 h-8 bg-slate-100 rounded-lg"></div>
              <div className="sm:col-span-8 h-8 bg-slate-100 rounded-lg"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-7 h-9 bg-slate-100 rounded-lg"></div>
            <div className="sm:col-span-5 h-9 bg-slate-100 rounded-lg"></div>
            <div className="sm:col-span-12 h-9 bg-slate-100 rounded-lg"></div>
            <div className="sm:col-span-4 h-9 bg-slate-100 rounded-lg"></div>
            <div className="sm:col-span-5 h-9 bg-slate-100 rounded-lg"></div>
            <div className="sm:col-span-3 h-9 bg-slate-100 rounded-lg"></div>
          </div>
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
  );
}
