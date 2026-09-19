import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from './sign-out-button';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  const isManagerOrAdmin = profile?.role === 'admin' || profile?.role === 'gestor';
  const userClientId = profile?.client_id;

  // Construir queries com isolamento por cliente caso o utilizador não seja admin ou gestor
  let stockAtualQuery = supabase.from('vw_stock_atual').select('*', { count: 'exact', head: true });
  let stockPedidosQuery = supabase.from('vw_stock_pedidos').select('stock');
  let pedidosCountQuery = supabase.from('pedidos').select('*', { count: 'exact', head: true });
  let clientsCountQuery = supabase.from('clients').select('*', { count: 'exact', head: true });
  let artigosCountQuery = supabase.from('artigos').select('*', { count: 'exact', head: true });

  if (!isManagerOrAdmin && userClientId) {
    stockAtualQuery = stockAtualQuery.eq('client_id', userClientId);
    stockPedidosQuery = stockPedidosQuery.eq('client_id', userClientId);
    pedidosCountQuery = pedidosCountQuery.eq('client_id', userClientId);
  }

  // Buscar dados em paralelo
  const [
    { count: totalLotes },
    { data: stockPedidos },
    { count: totalClientes },
    { count: totalArtigos },
    { count: totalPedidos },
  ] = await Promise.all([
    stockAtualQuery,
    stockPedidosQuery,
    clientsCountQuery,
    artigosCountQuery,
    pedidosCountQuery,
  ]);

  const totalStockVenda = stockPedidos?.reduce((acc, curr) => acc + Number(curr.stock || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      {/* Header */}
      <header className="bg-surface-container-lowest border-b border-outline-variant/30 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCnkcXW31nD71g-vuvCogM_z_BQZYp3SeYlcPR9lObd0zi9HRBQLH095qBoZinA-Ox1WGs2p4GnbxdG6x_SyJacxhAEC8ePoOTFdVI_u8bi5Jz8urQ-1CGoQ-GLBrcYgguObeMYGS3nk6bnr3sz5sBFS2jgvNJ4q2dD3yvulEH__TQ89del8tYF83X-KLnVQ8LmQORLqrmMFqwy3hANJ47Ndo2MfkhLHNWlMpcIv_xjQCfIXFJ6ZrBmF-2FQOqHQLzu"
                alt="Sermail Logo"
                className="h-9 max-w-[140px] object-contain"
              />
              <div className="h-6 w-px bg-outline-variant/50 hidden sm:block"></div>
              <span className="font-headline font-bold text-secondary text-sm hidden sm:inline-block">
                Plataforma Farma
              </span>
            </div>

            {/* Navigation Links */}
            <nav className="flex items-center gap-1">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-secondary bg-secondary/10 border border-secondary/20 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">dashboard</span>
                Dashboard
              </Link>
              <Link
                href="/stocks"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">inventory_2</span>
                Stocks
              </Link>
              <Link
                href="/pedidos"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">local_shipping</span>
                Pedidos & Expedição
              </Link>
              <Link
                href="/historico-pedidos"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                Histórico Pedidos
              </Link>
              {profile?.role === 'admin' && (
                <Link
                  href="/configuracao"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">settings</span>
                  Configuração
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-on-surface">
                {profile?.full_name || user.email}
              </p>
              <p className="text-[11px] text-on-surface-variant/80 mt-0.5">
                {profile?.empresa || 'Sermail'}
              </p>
            </div>

            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary-container to-primary text-on-primary rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-headline">
                Plataforma de Gestão Farmacêutica Sermail
              </h1>
              <p className="text-on-primary/80 text-xs sm:text-sm mt-1 max-w-2xl">
                Visão geral e acesso rápido às operações de armazém, encomendas e controlo de stocks.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/stocks"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-lowest/15 hover:bg-surface-container-lowest/25 text-on-primary border border-white/20 font-bold text-xs tracking-wide transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-base">inventory_2</span>
                Consultar Stocks
              </Link>
              <Link
                href="/pedidos"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-on-secondary hover:bg-secondary/90 font-bold text-xs tracking-wide transition-all shadow-lg hover:shadow-xl"
              >
                <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                Criar Novo Pedido
              </Link>
            </div>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-secondary/10 pointer-events-none rounded-r-2xl"></div>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-on-surface-variant">Stock Venda Livre</p>
                <p className="text-2xl font-bold font-headline text-secondary mt-1">{totalStockVenda.toLocaleString('pt-PT')} <span className="text-xs font-normal text-on-surface-variant">un</span></p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-xl">inventory_2</span>
              </div>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">check_circle</span>
              Armazém 01 (Venda)
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-on-surface-variant">Lotes em Armazém</p>
                <p className="text-2xl font-bold font-headline text-on-surface mt-1">{totalLotes || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-xl">warehouse</span>
              </div>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">pin_drop</span>
              Stock consolidado
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-on-surface-variant">Pedidos Registados</p>
                <p className="text-2xl font-bold font-headline text-on-surface mt-1">{totalPedidos || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-700">
                <span className="material-symbols-outlined text-xl">receipt_long</span>
              </div>
            </div>
            <p className="text-[11px] text-indigo-700 font-medium mt-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">local_shipping</span>
              Expedições ativas
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-on-surface-variant">Clientes</p>
                <p className="text-2xl font-bold font-headline text-on-surface mt-1">{totalClientes || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-700">
                <span className="material-symbols-outlined text-xl">corporate_fare</span>
              </div>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">shield</span>
              Siglas ≤ 4 carateres
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-on-surface-variant">Artigos</p>
                <p className="text-2xl font-bold font-headline text-on-surface mt-1">{totalArtigos || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-700">
                <span className="material-symbols-outlined text-xl">medication</span>
              </div>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">thermostat</span>
              TF, TC e TA
            </p>
          </div>
        </div>

        {/* Quick Access / Modules Cards */}
        <div>
          <h2 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">grid_view</span>
            Módulos e Acesso Rápido
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Stocks Module */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-secondary/50 transition-colors">
              <div>
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary mb-4">
                  <span className="material-symbols-outlined text-2xl">inventory_2</span>
                </div>
                <h3 className="text-base font-bold text-on-surface">Gestão de Stocks</h3>
                <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                  Consulte o stock disponível para venda (Armazém 01), o stock consolidado detalhado com localizações físicas e o histórico completo de movimentos.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-outline-variant/20">
                <Link
                  href="/stocks"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary hover:text-secondary/80 transition-colors"
                >
                  Aceder ao Módulo de Stocks
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Pedidos & Expedição Module */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-secondary/50 transition-colors">
              <div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                  <span className="material-symbols-outlined text-2xl">local_shipping</span>
                </div>
                <h3 className="text-base font-bold text-on-surface">Pedidos & Expedição</h3>
                <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                  Crie novos pedidos comerciais com alocação inteligente FEFO (First Expired, First Out) por lote e emita as respetivas guias de expedição.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-outline-variant/20">
                <Link
                  href="/pedidos"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  Criar Pedido / Expedição
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Histórico Pedidos Module */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-secondary/50 transition-colors">
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-700 mb-4">
                  <span className="material-symbols-outlined text-2xl">receipt_long</span>
                </div>
                <h3 className="text-base font-bold text-on-surface">Histórico de Pedidos</h3>
                <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                  Acompanhe todas as encomendas já registadas, consulte as linhas expedidas, dados de transporte e imprima guias de remessa.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-outline-variant/20">
                <Link
                  href="/historico-pedidos"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-800 transition-colors"
                >
                  Consultar Histórico
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Configuração Module (se admin) */}
            {profile?.role === 'admin' && (
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-secondary/50 transition-colors">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-700 mb-4">
                    <span className="material-symbols-outlined text-2xl">settings</span>
                  </div>
                  <h3 className="text-base font-bold text-on-surface">Configurações do Sistema</h3>
                  <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                    Administração global da plataforma: cadastro de clientes, catálogo de artigos farmacêuticos, parametrização de armazéns e gestão de acessos.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-outline-variant/20">
                  <Link
                    href="/configuracao"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
                  >
                    Gerir Configurações
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
