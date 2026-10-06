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

  const isManagerOrAdmin = profile?.role === 'admin' || profile?.role === 'gestor';
  const userClientId = profile?.client_id;

  // Construir queries com isolamento por cliente caso o utilizador não seja admin ou gestor
  let clientsQuery = supabase.from('clients').select('*').eq('ativo', true).order('name');
  let stockAtualQuery = supabase.from('vw_stock_atual').select('artigo_id, artigo_codigo, artigo_descricao, validade, stock, client_id, tipo_artigo');
  let stockPedidosQuery = supabase.from('vw_stock_pedidos').select('stock, client_id');
  let pedidosQuery = supabase
    .from('pedidos')
    .select('id, client_id, data_pedido, created_at, pedido_linhas(id, artigo_codigo, descricao, quantidade)');
  let faturacaoQuery = supabase.from('vw_fact_mes').select('sigla_cliente, data, total_merc, total_iva, total_desc');

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
    { data: faturacao },
  ] = await Promise.all([
    clientsQuery,
    stockAtualQuery,
    stockPedidosQuery,
    pedidosQuery,
    faturacaoQuery,
  ]);

  let finalPedidos = pedidos || [];
  
  if (clients && clients.length > 0) {
    const cfClientIds = clients.filter((c: any) => c.tipo_cliente === 'CF' || c.tipo_cliente === 'cf').map((c: any) => c.id);
    
    if (cfClientIds.length > 0) {
      finalPedidos = finalPedidos.filter(p => !cfClientIds.includes(p.client_id));
      
      const { data: cfMovimentos } = await supabase
        .from('movimentos')
        .select('documento_ref, client_id, data_movimento, created_at, artigo_cli, quantidade')
        .in('tipo_movimento', ['ss', 'st', 'SS', 'ST'])
        .in('client_id', cfClientIds);
        
      if (cfMovimentos && cfMovimentos.length > 0) {
        const grouped = cfMovimentos.reduce((acc: any, mov: any) => {
          const docRef = mov.documento_ref || `SEM_REF_${mov.created_at}`;
          const key = `${mov.client_id}_${docRef}`;
          
          if (!acc[key]) {
            acc[key] = {
              id: key,
              client_id: mov.client_id,
              data_pedido: mov.data_movimento || mov.created_at,
              created_at: mov.created_at,
              pedido_linhas: []
            };
          }
          
          acc[key].pedido_linhas.push({
            id: `${key}_${mov.artigo_cli}`,
            artigo_codigo: mov.artigo_cli,
            descricao: mov.artigo_cli,
            quantidade: mov.quantidade || 0
          });
          
          return acc;
        }, {});
        
        const pseudoPedidos = Object.values(grouped);
        finalPedidos = [...finalPedidos, ...(pseudoPedidos as any)];
      }
    }
  }

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
        faturacao={faturacao || []}
        currentUserProfile={profile}
        isManagerOrAdmin={isManagerOrAdmin}
      />
    </div>
  );
}

