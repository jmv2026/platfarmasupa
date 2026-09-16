import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from './sign-out-button';
import { TIPO_ARTIGO_LABELS, TIPO_ARMAZENAMENTO_LABELS, TipoArtigo, TipoArmazenamento } from '@/lib/supabase/types';

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
  let stockAtualQuery = supabase.from('vw_stock_atual').select('*').order('cliente_sigla');
  let stockPedidosQuery = supabase.from('vw_stock_pedidos').select('*').order('cliente_sigla');
  let movimentosQuery = supabase.from('movimentos').select('*, clients(name, sigla), artigos(artigo_id, descricao)').order('data_movimento', { ascending: false }).limit(10);
  let pedidosCountQuery = supabase.from('pedidos').select('*', { count: 'exact', head: true });

  if (!isManagerOrAdmin && userClientId) {
    stockAtualQuery = stockAtualQuery.eq('client_id', userClientId);
    stockPedidosQuery = stockPedidosQuery.eq('client_id', userClientId);
    movimentosQuery = movimentosQuery.eq('client_id', userClientId);
    pedidosCountQuery = pedidosCountQuery.eq('client_id', userClientId);
  }

  // Buscar dados das views e tabelas em paralelo
  const [
    { data: stockAtual },
    { data: stockPedidos },
    { data: movimentos },
    { count: totalClientes },
    { count: totalArtigos },
    { count: totalPedidos },
  ] = await Promise.all([
    stockAtualQuery,
    stockPedidosQuery,
    movimentosQuery,
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('artigos').select('*', { count: 'exact', head: true }),
    pedidosCountQuery,
  ]);

  const totalStockVenda = stockPedidos?.reduce((acc, curr) => acc + Number(curr.stock || 0), 0) || 0;
  const totalLotes = stockAtual?.length || 0;

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
                href="/pedidos"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">local_shipping</span>
                Pedidos & Expedição
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
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold tracking-wide uppercase">
                  Fase 5 Concluída
                </span>
                <span className="text-xs text-primary-fixed font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Processo de Pedidos & Rastreabilidade FEFO
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-headline mb-2">
                Plataforma de Gestão Farmacêutica Sermail
              </h1>
              <p className="text-primary-fixed text-sm max-w-2xl">
                Controlo integral de armazéns, cálculo automático de stocks, sugestão inteligente FEFO e expedição em tempo real.
              </p>
            </div>

            <Link
              href="/pedidos"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-secondary text-on-secondary hover:bg-secondary/90 font-bold text-xs tracking-wide transition-all shadow-lg hover:shadow-xl self-start md:self-auto shrink-0"
            >
              <span className="material-symbols-outlined text-base">add_shopping_cart</span>
              Criar Novo Pedido
            </Link>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-secondary/10 pointer-events-none rounded-r-2xl"></div>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
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

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-on-surface-variant">Lotes em Armazém</p>
                <p className="text-2xl font-bold font-headline text-on-surface mt-1">{totalLotes}</p>
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

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
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

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
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

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
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

        {/* View 1: Stock Disponível para Pedidos (vw_stock_pedidos - Armazém 01) */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-outline-variant/20 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">shopping_cart_checkout</span>
                  Stock Disponível para Pedidos (<code className="text-xs bg-surface-container px-1.5 py-0.5 rounded font-mono text-secondary">vw_stock_pedidos</code>)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Armazém 01 (Venda)
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Visão de stock para alocação direta de encomendas comerciais (sem informação física de armazém/posição).
              </p>
            </div>

            <Link
              href="/pedidos"
              className="text-xs font-bold text-secondary hover:text-secondary/80 flex items-center gap-1"
            >
              Fazer Pedido com FEFO
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Cliente</th>
                  <th className="py-2.5 px-3">Código Artigo</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Tipo Artigo</th>
                  <th className="py-2.5 px-3">Conservação</th>
                  <th className="py-2.5 px-3">Lote</th>
                  <th className="py-2.5 px-3">Validade</th>
                  <th className="py-2.5 px-3 text-right rounded-r-lg">Stock Disponível</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {stockPedidos && stockPedidos.length > 0 ? (
                  stockPedidos.map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                      <td className="py-3 px-3 font-semibold">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                          {item.cliente_sigla}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-medium">{item.artigo_codigo}</td>
                      <td className="py-3 px-3 font-medium">{item.artigo_descricao}</td>
                      <td className="py-3 px-3">
                        <span className="text-[11px] text-on-surface-variant">
                          {TIPO_ARTIGO_LABELS[item.tipo_artigo as TipoArtigo] || item.tipo_artigo}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          item.tipo_armazenamento === 'TF' ? 'bg-cyan-100 text-cyan-800' :
                          item.tipo_armazenamento === 'TC' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          <span className="material-symbols-outlined text-[12px]">
                            {item.tipo_armazenamento === 'TF' ? 'ac_unit' : 'thermostat'}
                          </span>
                          {TIPO_ARMAZENAMENTO_LABELS[item.tipo_armazenamento as TipoArmazenamento] || item.tipo_armazenamento}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-secondary">{item.lote}</td>
                      <td className="py-3 px-3 font-mono text-on-surface-variant">
                        {item.validade ? new Date(item.validade).toLocaleDateString('pt-PT') : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                        {Number(item.stock).toLocaleString('pt-PT')} <span className="text-xs font-normal text-on-surface-variant">un</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-on-surface-variant">
                      Nenhum artigo com stock disponível para venda no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* View 2: Stock Consolidado com Localização (vw_stock_atual) */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-outline-variant/20 gap-2">
            <div>
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">inventory</span>
                Stock Consolidado (<code className="text-xs bg-surface-container px-1.5 py-0.5 rounded font-mono text-secondary">vw_stock_atual</code>)
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Visão detalhada por cliente, artigo, lote, validade e armazém (`armazem_loc`).
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Cliente</th>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Descrição Artigo</th>
                  <th className="py-2.5 px-3">Lote</th>
                  <th className="py-2.5 px-3">Validade</th>
                  <th className="py-2.5 px-3">Armazém Loc</th>
                  <th className="py-2.5 px-3">Tipo Armazém</th>
                  <th className="py-2.5 px-3 text-right rounded-r-lg">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {stockAtual && stockAtual.length > 0 ? (
                  stockAtual.map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                          {item.cliente_sigla}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-medium">{item.artigo_codigo}</td>
                      <td className="py-3 px-3 font-medium">{item.artigo_descricao}</td>
                      <td className="py-3 px-3 font-mono text-secondary font-semibold">{item.lote}</td>
                      <td className="py-3 px-3 font-mono text-on-surface-variant">
                        {item.validade ? new Date(item.validade).toLocaleDateString('pt-PT') : '-'}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-secondary-600">
                        {item.armazem_loc}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                          item.tipo_armazem === '01' ? 'bg-emerald-100 text-emerald-800' :
                          item.tipo_armazem === '05' ? 'bg-amber-100 text-amber-800' :
                          item.tipo_armazem === '02' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {item.armazem_descricao || `Armazém ${item.tipo_armazem}`}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                        {Number(item.stock).toLocaleString('pt-PT')} <span className="text-xs font-normal text-on-surface-variant">un</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-on-surface-variant">
                      Nenhum registo de stock consolidado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela de Movimentos Recentes */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">history</span>
            Últimos Movimentos de Stock Registados
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Tipo</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Artigo</th>
                  <th className="py-2.5 px-3">Armazém Loc</th>
                  <th className="py-2.5 px-3">Posição</th>
                  <th className="py-2.5 px-3">Qtd</th>
                  <th className="py-2.5 px-3 text-right rounded-r-lg">Data Movimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {movimentos && movimentos.length > 0 ? (
                  movimentos.map((mov) => {
                    const isEntry = mov.tipo_movimento === 'es' || mov.tipo_movimento === 'et';
                    return (
                      <tr key={mov.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            mov.tipo_movimento === 'es' ? 'bg-emerald-100 text-emerald-800' :
                            mov.tipo_movimento === 'ss' ? 'bg-rose-100 text-rose-800' :
                            mov.tipo_movimento === 'et' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            <span className="material-symbols-outlined text-[12px]">
                              {isEntry ? 'arrow_downward' : 'arrow_upward'}
                            </span>
                            {mov.tipo_movimento}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold">
                          {mov.clients?.sigla || '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-medium">{mov.artigo_id?.artigo_id || mov.artigos?.artigo_id}</span>
                          <span className="text-on-surface-variant text-[11px] block truncate max-w-[140px]">
                            {mov.artigo_id?.descricao || mov.artigos?.descricao}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-secondary">
                          {mov.armazem_loc}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-on-surface-variant">
                          {mov.posicao || '-'}
                        </td>
                        <td className={`py-2.5 px-3 font-mono font-bold ${isEntry ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isEntry ? '+' : '-'}{Number(mov.quantidade).toLocaleString('pt-PT')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-on-surface-variant">
                          {new Date(mov.data_movimento).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-on-surface-variant">
                      Nenhum movimento registado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
