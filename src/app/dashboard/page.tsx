import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/supabase/session';
import { fetchAllRowsFast } from '@/lib/supabase/pagination';
import AppHeader from '@/components/navigation/app-header';
import DashboardView from './dashboard-view';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export default async function DashboardPage() {
  const { supabase, user, profile, isManagerOrAdmin, userClientId } = await getAuthContext();

  if (!user) {
    redirect('/login');
  }

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

  // Buscar entradas de stock (ES) de forma paralela
  const fetchEntradasES = () =>
    fetchAllRowsFast<any>((from, to, countMode) => {
      let q = supabase
        .from('movimentos')
        .select(
          'documento_ref, cliente_id, sigla, cliente_ser, data_movimento, data, created_at, tipo_movimento, tipomovimento',
          countMode ? { count: countMode } : undefined
        )
        .or('tipo_movimento.ilike.ES,tipomovimento.ilike.ES')
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
    entradasRaw,
  ] = await Promise.all([
    clientsQuery,
    stockAtualQuery,
    fetchPedidos(),
    faturacaoQuery,
    fetchSaidas(),
    fetchEntradasES(),
  ]);

  const finalPedidos = pedidosRaw || [];
  const finalSaidas = saidasRaw || [];
  const finalFaturacao = faturacao || [];
  const finalEntradas = entradasRaw || [];

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
        entradas={finalEntradas}
        faturacao={finalFaturacao}
        currentUserProfile={profile}
        isManagerOrAdmin={isManagerOrAdmin}
      />
    </div>
  );
}

