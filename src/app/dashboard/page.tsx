import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/app-header';
import DashboardView from './dashboard-view';
import { Client, UserProfile } from '@/lib/supabase/types';

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
  let stockPedidosQuery = supabase.from('vw_stock_pedidos').select('stock, cliente_id');
  
  // Fonte exclusiva para pedidos no dashboard: view vw_pedidos
  let pedidosQuery = supabase
    .from('vw_pedidos')
    .select('id, documento_ref, cliente_id, data_pedido, created_at, total_linhas, total_quantidade, sigla, nome, entidade, tipo_doc');
    
  let faturacaoQuery = supabase
    .from('vw_fact_mes')
    .select('sigla_cliente, cliente_id, data, total_docs, total_quantidade, total_merc, total_iva, total_desc');
  let saidasQuery = supabase.from('vw_saidas').select('id, cliente_id, artigo_cli, artigo_codigo, artigo_descricao, tipo_desc, quantidade, data_movimento, created_at, documento_ref, lote');

  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
    pedidosQuery = pedidosQuery.eq('cliente_id', userClientId);
    stockAtualQuery = stockAtualQuery.eq('cliente_id', userClientId);
    stockPedidosQuery = stockPedidosQuery.eq('cliente_id', userClientId);
    saidasQuery = saidasQuery.eq('cliente_id', userClientId);
    faturacaoQuery = faturacaoQuery.eq('cliente_id', userClientId);
  }

  // Buscar todos os dados em paralelo
  const [
    { data: clients },
    { data: stockAtual },
    { data: stockPedidos },
    { data: pedidosRaw },
    { data: faturacao },
    { data: saidasRaw },
  ] = await Promise.all([
    clientsQuery,
    stockAtualQuery,
    stockPedidosQuery,
    pedidosQuery,
    faturacaoQuery,
    saidasQuery,
  ]);

  const finalPedidos = pedidosRaw || [];
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
        stockPedidos={stockPedidos || []}
        pedidos={finalPedidos}
        saidas={saidasRaw || []}
        faturacao={finalFaturacao}
        currentUserProfile={profile}
        isManagerOrAdmin={isManagerOrAdmin}
      />
    </div>
  );
}

