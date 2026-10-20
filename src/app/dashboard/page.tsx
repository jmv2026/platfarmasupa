import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/app-header';
import DashboardView from './dashboard-view';

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
  let stockAtualQuery = supabase.from('vw_stock_atual').select('artigo_id, artigo_codigo, artigo_descricao, validade, stock, cliente_id, tipo_artigo');
  let faturacaoQuery = supabase
    .from('vw_fact_mes')
    .select('sigla_cliente, cliente_id, data, total_docs, total_quantidade, total_merc, total_iva, total_desc');

  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
    stockAtualQuery = stockAtualQuery.eq('cliente_id', userClientId);
    faturacaoQuery = faturacaoQuery.eq('cliente_id', userClientId);
  }

  // Função auxiliar para paginação transparente (PostgREST tem limite padrão de 1000 registos por pedido)
  async function fetchAllRows<T>(
    fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
    pageSize = 1000
  ): Promise<T[]> {
    const allRows: T[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await fetchPage(from, from + pageSize - 1);
      if (error) {
        console.error('Erro ao buscar dados paginados:', error);
        break;
      }
      if (!data || data.length === 0) break;

      allRows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    return allRows;
  }

  // Buscar todas as saídas (vw_saidas ultrapassa 1000 registos e sem paginação trunca clientes como a Varimpulse)
  const fetchSaidas = () =>
    fetchAllRows<any>((from, to) => {
      let q = supabase
        .from('vw_saidas')
        .select('id, cliente_id, sigla, artigo_cli, artigo_codigo, artigo_descricao, tipo_desc, quantidade, data_movimento, created_at, documento_ref, lote')
        .range(from, to);
      if (!isManagerOrAdmin && userClientId) {
        q = q.eq('cliente_id', userClientId);
      }
      return q;
    });

  // Buscar pedidos com suporte a paginação transparente
  const fetchPedidos = () =>
    fetchAllRows<any>((from, to) => {
      let q = supabase
        .from('vw_pedidos')
        .select('id, documento_ref, cliente_id, data_pedido, created_at, total_linhas, total_quantidade, sigla, nome, entidade, tipo_doc')
        .range(from, to);
      if (!isManagerOrAdmin && userClientId) {
        q = q.eq('cliente_id', userClientId);
      }
      return q;
    });

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

