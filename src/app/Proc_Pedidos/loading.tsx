export default function LoadingProcPedidos() {
  return (
    <div className="min-h-screen bg-background text-on-background">
      <div className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between">
        <div className="h-8 w-48 bg-slate-200/70 rounded-lg animate-pulse" />
        <div className="h-8 w-32 bg-slate-200/70 rounded-lg animate-pulse" />
      </div>
      <div className="w-full px-6 pt-6 space-y-5">
        <div className="h-24 bg-slate-200/70 rounded-xl animate-pulse" />
        <div className="h-14 bg-white border border-slate-200/80 rounded-xl animate-pulse" />
        <div className="h-96 bg-white border border-slate-200/80 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

