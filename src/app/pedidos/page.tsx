import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/app-header';
import NovoPedidoForm from './novo-pedido-form';
import { Client, StockPedido, UserProfile, Destino } from '@/lib/supabase/types';

export default async function PedidosPage() {
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

  let clientsQuery = supabase.from('clients').select('*').eq('ativo', true).order('name');
  let stockPedidosQuery = supabase.from('vw_stock_pedidos').select('*').order('cliente_sigla');
  let destinosQuery = supabase.from('destinos').select('*').eq('ativo', true).order('codigo');

  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
    stockPedidosQuery = stockPedidosQuery.eq('client_id', userClientId);
    destinosQuery = destinosQuery.eq('client_id', userClientId);
  }

  // Buscar dados em paralelo
  const [
    { data: clients },
    { data: stockPedidos },
    { data: destinos },
  ] = await Promise.all([
    clientsQuery,
    stockPedidosQuery,
    destinosQuery,
  ]);

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      {/* Header com Navegação e Seletor de Idioma */}
      <AppHeader
        userProfile={profile}
        userEmail={user.email}
        activeTab="pedidos"
      />

      {/* Main Content */}
      <NovoPedidoForm
        clients={(clients as Client[]) || []}
        stockPedidos={(stockPedidos as StockPedido[]) || []}
        destinos={(destinos as Destino[]) || []}
        currentUserProfile={(profile as UserProfile) || null}
      />
    </div>
  );
}

