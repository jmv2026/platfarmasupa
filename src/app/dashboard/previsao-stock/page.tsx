import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/app-header';
import PrevisaoStockView from './previsao-stock-view';
import { Suspense } from 'react';

export default async function PrevisaoStockPage() {
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

  const isManagerOrAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'gestor' ||
    user.email === 'admin@sermail.pt' ||
    user.user_metadata?.role === 'admin';
  const userClientId = profile?.cliente_id;

  // Construir queries com isolamento por cliente caso o utilizador não seja admin ou gestor
  let clientsQuery = supabase.from('clientes').select('*').eq('ativo', true).order('name');
  let stockAtualQuery = supabase.from('vw_stock_atual').select('artigo_id, artigo_cli, descricao, validade, stock, cliente_id, tipo_artigo');
  let stockPedidosQuery = supabase.from('vw_stock_pedidos').select('stock, cliente_id');
  // Função auxiliar otimizada para paginação paralela rápida
  async function fetchAllRowsFast<T>(
    fetchPage: (from: number, to: number, countMode?: 'exact') => PromiseLike<{ data: T[] | null; count?: number | null; error: any }>,
    pageSize = 1000
  ): Promise<T[]> {
    const firstPage = await fetchPage(0, pageSize - 1, 'exact');
    if (firstPage.error || !firstPage.data) {
      if (firstPage.error) console.error('Erro ao buscar dados paginados:', firstPage.error);
      return [];
    }

    const allRows: T[] = [...firstPage.data];
    const total = firstPage.count ?? allRows.length;

    if (total <= pageSize || firstPage.data.length < pageSize) {
      return allRows;
    }

    const numRemainingPages = Math.ceil((total - pageSize) / pageSize);
    const remainingPromises = Array.from({ length: numRemainingPages }, (_, i) => {
      const pageIndex = i + 1;
      const from = pageIndex * pageSize;
      const to = from + pageSize - 1;
      return fetchPage(from, to);
    });

    const remainingResults = await Promise.all(remainingPromises);
    for (const res of remainingResults) {
      if (res.data) {
        allRows.push(...res.data);
      }
    }

    return allRows;
  }

  // Fonte exclusiva para pedidos e consumos no gráfico de previsão: view vw_pedidos
  const fetchPedidos = () =>
    fetchAllRowsFast<any>((from, to, countMode) => {
      let q = supabase
        .from('vw_pedidos')
        .select('id, documento_ref, cliente_id, data_pedido, created_at, total_linhas, total_quantidade, sigla, nome, entidade, tipo_doc, pedido_linhas', countMode ? { count: countMode } : undefined)
        .range(from, to);
      if (!isManagerOrAdmin && userClientId) {
        q = q.eq('cliente_id', userClientId);
      }
      return q;
    });

  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
    stockAtualQuery = stockAtualQuery.eq('cliente_id', userClientId);
    stockPedidosQuery = stockPedidosQuery.eq('cliente_id', userClientId);
  }

  // Buscar dados em paralelo
  const [
    { data: clients },
    { data: stockAtual },
    { data: stockPedidos },
    pedidos,
  ] = await Promise.all([
    clientsQuery,
    stockAtualQuery,
    stockPedidosQuery,
    fetchPedidos(),
  ]);

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      {/* Header com Navegação e Seletor de Idioma */}
      <AppHeader
        userProfile={profile}
        userEmail={user.email}
        activeTab="dashboard"
      />

      {/* Main View da Previsão de Stock com Suspense para suporte a searchParams */}
      <Suspense
        fallback={
          <div className="w-full px-4 sm:px-6 py-8 flex items-center justify-center">
            <div className="flex items-center gap-3 text-sm font-semibold text-on-surface-variant">
              <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
              <span>A carregar Previsão de Stock...</span>
            </div>
          </div>
        }
      >
        <PrevisaoStockView
          clients={clients || []}
          stockAtual={stockAtual || []}
          stockPedidos={stockPedidos || []}
          pedidos={pedidos || []}
          isManagerOrAdmin={isManagerOrAdmin}
        />
      </Suspense>
    </div>
  );
}
