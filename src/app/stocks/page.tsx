import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/app-header';
import StocksView from './stocks-view';
import { Client, StockAtual, StockPedido, UserProfile } from '@/lib/supabase/types';

export default async function StocksPage() {
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
  let stockAtualQuery = supabase.from('vw_stock_atual').select('*').order('cliente_sigla');
  let stockPedidosQuery = supabase.from('vw_stock_pedidos').select('*').order('cliente_sigla');

  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
    stockAtualQuery = stockAtualQuery.eq('client_id', userClientId);
    stockPedidosQuery = stockPedidosQuery.eq('client_id', userClientId);
  }

  // Buscar dados em paralelo
  const [
    { data: clients },
    { data: stockAtual },
    { data: stockPedidos },
  ] = await Promise.all([
    clientsQuery,
    stockAtualQuery,
    stockPedidosQuery,
  ]);

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      {/* Header com Navegação e Seletor de Idioma */}
      <AppHeader
        userProfile={profile}
        userEmail={user.email}
        activeTab="stocks"
      />

      {/* Main Content */}
      <StocksView
        stockAtual={(stockAtual as StockAtual[]) || []}
        stockPedidos={(stockPedidos as StockPedido[]) || []}
        clients={(clients as Client[]) || []}
        currentUserProfile={(profile as UserProfile) || null}
      />
    </div>
  );
}

