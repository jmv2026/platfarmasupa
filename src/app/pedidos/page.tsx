import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from '../dashboard/sign-out-button';
import NovoPedidoForm from './novo-pedido-form';
import PedidosLista from './pedidos-lista';
import { Client, StockPedido, PedidoComLinhas } from '@/lib/supabase/types';

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

  // Buscar dados em paralelo
  const [
    { data: clients },
    { data: stockPedidos },
    { data: pedidos },
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('ativo', true).order('name'),
    supabase.from('vw_stock_pedidos').select('*').order('cliente_sigla'),
    supabase
      .from('pedidos')
      .select('*, clients(id, name, sigla), pedido_linhas(*)')
      .order('created_at', { ascending: false }),
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
                href="/pedidos"
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-secondary bg-secondary/10 border border-secondary/20 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">local_shipping</span>
                Pedidos & Expedição
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-on-surface">
                {profile?.full_name || user.email}
              </p>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-secondary-container text-on-secondary-container uppercase">
                  {profile?.role || 'admin'}
                </span>
                <span className="text-[11px] text-on-surface-variant/80">
                  {profile?.empresa || 'Sermail'}
                </span>
              </div>
            </div>

            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-secondary-container to-secondary text-on-secondary-container rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block px-3 py-1 bg-surface-container-lowest/80 text-secondary rounded-full text-xs font-bold tracking-wide uppercase">
                Fase 5 • Expedição Farma
              </span>
              <span className="text-xs font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Alocação FEFO & Débito em Tempo Real
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline mb-2 text-on-secondary">
              Gestão e Registo de Pedidos de Entrega
            </h1>
            <p className="text-xs sm:text-sm max-w-2xl opacity-90">
              Crie pedidos de entrega com seleção inteligente pelo critério <strong>FEFO (First Expired, First Out)</strong>. As linhas são sincronizadas em tempo real com a view <code>vw_stock_pedidos</code> e debitam automaticamente o stock via movimentos <strong>SS</strong>.
            </p>
          </div>
        </div>

        {/* Formulário de Criação de Pedido */}
        <NovoPedidoForm
          clients={(clients as Client[]) || []}
          stockPedidos={(stockPedidos as StockPedido[]) || []}
        />

        {/* Lista de Pedidos Existentes */}
        <PedidosLista pedidos={(pedidos as PedidoComLinhas[]) || []} />
      </main>
    </div>
  );
}
