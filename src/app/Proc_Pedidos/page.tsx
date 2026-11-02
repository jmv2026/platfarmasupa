import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/supabase/session';
import AppHeader from '@/components/navigation/app-header';
import ProcPedidosView from './proc-pedidos-view';
import { Artigo, Client, PedidoComLinhas, StockPedido, UserProfile } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export const metadata = {
  title: 'Processar Pedidos | PlatFarma',
};

export default async function ProcPedidosPage() {
  const { supabase, user, profile, isManagerOrAdmin: isGestorOrAdmin } = await getAuthContext();

  if (!user) {
    redirect('/login');
  }

  if (!isGestorOrAdmin) {
    redirect('/dashboard?error=unauthorized');
  }

  const [
    { data: clients },
    { data: pedidos },
    { data: stockPedidos },
    { data: artigos },
  ] = await Promise.all([
    supabase.from('clientes').select('*').eq('ativo', true).order('name'),
    supabase
      .from('pedidos')
      .select('*, clientes(id, name, sigla), destinos(id, codigo, nome), pedido_linhas(*)')
      .order('created_at', { ascending: false }),
    supabase
      .from('vw_stock_pedidos')
      .select('cliente_id, artigo_id, artigo_cli, descricao, lote, validade, stock')
      .gt('stock', 0)
      .order('artigo_id', { ascending: true }),
    supabase
      .from('artigos')
      .select('artigo_id, artigo_cli, descricao')
      .eq('ativo', true)
      .order('artigo_id', { ascending: true }),
  ]);

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      <AppHeader
        userProfile={profile as UserProfile}
        userEmail={user.email}
        activeTab="proc-pedidos"
      />

      <ProcPedidosView
        pedidos={(pedidos as PedidoComLinhas[]) || []}
        clients={(clients as Client[]) || []}
        stockPedidos={(stockPedidos as StockPedido[]) || []}
        artigos={(artigos as Artigo[]) || []}
      />
    </div>
  );
}
