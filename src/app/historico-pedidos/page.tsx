import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/app-header';
import HistoricoPedidosView from './historico-pedidos-view';
import { Client, PedidoComLinhas, UserProfile } from '@/lib/supabase/types';

export default async function HistoricoPedidosPage() {
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
  let pedidosQuery = supabase
    .from('pedidos')
    .select('*, clients(id, name, sigla), destinos(id, codigo, nome), pedido_linhas(*)')
    .order('created_at', { ascending: false });

  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
    pedidosQuery = pedidosQuery.eq('client_id', userClientId);
  }

  // Buscar dados em paralelo
  const [{ data: clients }, { data: pedidos }] = await Promise.all([
    clientsQuery,
    pedidosQuery,
  ]);

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      {/* Header com Navegação e Seletor de Idioma */}
      <AppHeader
        userProfile={profile}
        userEmail={user.email}
        activeTab="historico-pedidos"
      />

      {/* Main Content */}
      <HistoricoPedidosView
        pedidos={(pedidos as PedidoComLinhas[]) || []}
        clients={(clients as Client[]) || []}
        currentUserProfile={(profile as UserProfile) || null}
      />
    </div>
  );
}

