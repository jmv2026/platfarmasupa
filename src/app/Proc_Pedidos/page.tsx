import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/app-header';
import ProcPedidosView from './proc-pedidos-view';
import { Artigo, Client, PedidoComLinhas, StockPedido, UserProfile } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProcPedidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Obter perfil do utilizador para controlo de acesso RBAC
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  // CONTROLO DE ACESSO RBAC: Apenas perfil 'gestor' ou 'admin' pode aceder à página Proc_Pedidos
  const isGestorOrAdmin =
    profile?.role === 'gestor' ||
    profile?.role === 'admin' ||
    user.email === 'admin@sermail.pt' ||
    user.user_metadata?.role === 'admin';

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
    supabase.from('vw_stock_pedidos').select('*').order('artigo_id', { ascending: true }),
    supabase.from('artigos').select('*').eq('ativo', true).order('artigo_id', { ascending: true }),
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
