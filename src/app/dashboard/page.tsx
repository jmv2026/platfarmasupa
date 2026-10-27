import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/app-header';
import DashboardView from './dashboard-view';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

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

  const isManagerOrAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'gestor' ||
    user.email === 'admin@sermail.pt' ||
    user.user_metadata?.role === 'admin';
  const userClientId = profile?.cliente_id;

  let clientsQuery = supabase.from('clientes').select('*').eq('ativo', true).order('name');
  let stockAtualQuery = supabase.from('vw_stock_atual').select('artigo_id, artigo_cli, descricao, validade, stock, cliente_id, tipo_artigo');
  let faturacaoQuery = supabase
    .from('vw_fact_mes')
    .select('sigla_cliente, cliente_id, data, total_docs, total_quantidade, total_merc, total_iva, total_desc, total_liquido');

  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
    stockAtualQuery = stockAtualQuery.eq('cliente_id', userClientId);
    faturacaoQuery = faturacaoQuery.eq('cliente_id', userClientId);
  }

  // Função auxiliar otimizada para paginação paralela ultra-rápida
  async function fetchAllRowsFast<T>(
    fetchPage: (from: number, to: number, countMode?: 'exact') => PromiseLike<{ data: T[] | null; count?: number | null; error: any }>,
    pageSize = 2000
  ): Promise<T[]> {
    // 1ª página rápida sem contagem exata para evitar SELECT COUNT(*) pesado na vista
    const firstPage = await fetchPage(0, pageSize - 1);
    if (firstPage.error || !firstPage.data) {
      if (firstPage.error) console.error('Erro ao buscar dados paginados:', firstPage.error);
      return [];
    }

    const allRows: T[] = [...firstPage.data];

    // Se a 1ª página já trouxe todos os dados (< pageSize), termina de imediato sem COUNT(*)
    if (firstPage.data.length < pageSize) {
      return allRows;
    }

    // Apenas se ultrapassar a 1ª página obtemos a contagem exata para paralelizar o restante
    const countRes = await fetchPage(0, 0, 'exact');
    const total = countRes.count ?? allRows.length;

    if (total <= pageSize) {
      return allRows;
    }

    // Lança todas as restantes páginas em paralelo simultâneo
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

  // Buscar todas as saídas de forma paralela (sem bloquear sequencialmente)
  const fetchSaidas = () =>
    fetchAllRowsFast<any>((from, to, countMode) => {
      let q = supabase
        .from('vw_saidas')
        .select(
          'id, cliente_id, sigla, artigo_cli, artigo_id, descricao, tipo_desc, quantidade, data_movimento, created_at, documento_ref',
          countMode ? { count: countMode } : undefined
        )
        .range(from, to);
      if (!isManagerOrAdmin && userClientId) {
        q = q.eq('cliente_id', userClientId);
      }
      return q;
    }, 2000);

  // Buscar pedidos de forma paralela
  const fetchPedidos = () =>
    fetchAllRowsFast<any>((from, to, countMode) => {
      let q = supabase
        .from('vw_pedidos')
        .select(
          'id, documento_ref, cliente_id, data_pedido, created_at, total_linhas, total_quantidade, sigla, nome, entidade, tipo_doc',
          countMode ? { count: countMode } : undefined
        )
        .range(from, to);
      if (!isManagerOrAdmin && userClientId) {
        q = q.eq('cliente_id', userClientId);
      }
      return q;
    }, 2000);

  // Buscar todos os dados em paralelo
  const [
    { data: clients },
    { data: stockAtual },
    pedidosRaw,
    { data: faturacao },
    saidasRaw,
  ] = await Promise.all([
    clientsQuery,
    stockAtualQuery,
    fetchPedidos(),
    faturacaoQuery,
    fetchSaidas(),
  ]);

  const finalPedidos = pedidosRaw || [];
  const finalSaidas = saidasRaw || [];
  const finalFaturacao = faturacao || [];

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      {/* Header com Navegação e Seletor de Idioma */}
      <AppHeader
        userProfile={profile}
        userEmail={user.email}
        activeTab="dashboard"
      />

      {/* Main View com Filtros Adaptativos */}
      <DashboardView
        clients={clients || []}
        stockAtual={stockAtual || []}
        pedidos={finalPedidos}
        saidas={finalSaidas}
        faturacao={finalFaturacao}
        currentUserProfile={profile}
        isManagerOrAdmin={isManagerOrAdmin}
      />
    </div>
  );
}

