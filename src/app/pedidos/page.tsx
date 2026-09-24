import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from '../dashboard/sign-out-button';
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
      {/* Header */}
      <header className="bg-surface-container-lowest border-b border-outline-variant/30 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCnkcXW31nD71g-vuvCogM_z_BQZYp3SeYlcPR9lObd0zi9HRBQLH095qBoZinA-Ox1WGs2p4GnbxdG6x_SyJacxhAEC8ePoOTFdVI_u8bi5Jz8urQ-1CGoQ-GLBrcYgguObeMYGS3nk6bnr3sz5sBFS2jgvNJ4q2dD3yvulEH__TQ89del8tYF83X-KLnVQ8LmQORLqrmMFqwy3hANJ47Ndo2MfkhLHNWlMpcIv_xjQCfIXFJ6ZrBmF-2FQOqHQLzu"
                alt="Sermail Logo"
                className="h-9 max-w-[140px] object-contain"
              />
              <div className="h-6 w-px bg-outline-variant/50 hidden sm:block"></div>
              <span className="font-headline font-bold text-secondary text-sm hidden sm:inline-block">
                Plataforma Farma
              </span>
            </div>

            {/* Navigation Links */}
            <nav className="flex items-center gap-1">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">dashboard</span>
                Dashboard
              </Link>
              <Link
                href="/stocks"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">inventory_2</span>
                Stocks
              </Link>
              <Link
                href="/pedidos"
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-secondary bg-secondary/10 border border-secondary/20 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                Criar Pedido
              </Link>
              <Link
                href="/historico-pedidos"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                Histórico Pedidos
              </Link>
              {profile?.role === 'admin' && (
                <Link
                  href="/configuracao"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">settings</span>
                  Configuração
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-on-surface">
                {profile?.full_name || user.email}
              </p>
              <p className="text-[11px] text-on-surface-variant/80 mt-0.5">
                {profile?.empresa || 'Sermail'}
              </p>
            </div>

            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Formulário de Criação de Pedido */}
        <NovoPedidoForm
          clients={(clients as Client[]) || []}
          stockPedidos={(stockPedidos as StockPedido[]) || []}
          destinos={(destinos as Destino[]) || []}
          currentUserProfile={(profile as UserProfile) || null}
        />
      </main>
    </div>
  );
}
