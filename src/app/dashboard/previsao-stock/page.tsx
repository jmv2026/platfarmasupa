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

  const isManagerOrAdmin = profile?.role === 'admin' || profile?.role === 'gestor';
  const userClientId = profile?.client_id;

  // Construir queries com isolamento por cliente caso o utilizador não seja admin ou gestor
  let clientsQuery = supabase.from('clients').select('*').eq('ativo', true).order('name');
  let stockAtualQuery = supabase.from('vw_stock_atual').select('artigo_id, validade, stock, client_id, tipo_artigo');
  let stockPedidosQuery = supabase.from('vw_stock_pedidos').select('stock, client_id');
  let pedidosQuery = supabase
    .from('pedidos')
    .select('id, client_id, data_pedido, created_at, pedido_linhas(id, artigo_codigo, descricao, quantidade)');

  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
    stockAtualQuery = stockAtualQuery.eq('client_id', userClientId);
    stockPedidosQuery = stockPedidosQuery.eq('client_id', userClientId);
    pedidosQuery = pedidosQuery.eq('client_id', userClientId);
  }

  // Buscar dados em paralelo
  const [
    { data: clients },
    { data: stockAtual },
    { data: stockPedidos },
    { data: pedidos },
  ] = await Promise.all([
    clientsQuery,
    stockAtualQuery,
    stockPedidosQuery,
    pedidosQuery,
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
          currentUserProfile={profile}
          isManagerOrAdmin={isManagerOrAdmin}
        />
      </Suspense>
    </div>
  );
}
