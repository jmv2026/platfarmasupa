import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from '../dashboard/sign-out-button';
import ConfiguracaoTabs from './configuracao-tabs';
import { UserProfile, Client, Artigo, Perfil } from '@/lib/supabase/types';

export default async function ConfiguracaoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Obter perfil do utilizador para controlo de acesso
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  // CONTROLO DE ACESSO RBAC: Apenas perfil 'admin' pode aceder à página de configuração
  if (profile?.role !== 'admin') {
    redirect('/dashboard?error=unauthorized');
  }

  // Carregar dados de Utilizadores, Clientes, Artigos e Perfis
  const [
    { data: usersList },
    { data: clientsList },
    { data: artigosList },
    { data: perfisList },
  ] = await Promise.all([
    supabase.from('users').select('*').order('created_at', { ascending: false }),
    supabase.from('clients').select('*').order('name'),
    supabase.from('artigos').select('*').order('artigo_id'),
    supabase.from('perfis').select('*').order('codigo'),
  ]);

  // Dados de Parametrização do Servidor de Email (.env.local)
  const resendApiKey = process.env.RESEND_API_KEY;
  const isKeyConfigured = !!(resendApiKey && !resendApiKey.startsWith('re_123456789') && resendApiKey !== 'YOUR_RESEND_API_KEY');
  const serverEmailConfig = {
    fromEmail: process.env.RESEND_FROM_EMAIL || 'Plataforma Farma <noreplay@platfarma.sermaildev.cloud>',
    apiKeyConfigured: isKeyConfigured,
    apiKeyMasked: isKeyConfigured
      ? `${resendApiKey!.substring(0, 8)}...${resendApiKey!.slice(-4)}`
      : 'Não configurada (Simulação)',
    notificationEmail: process.env.RESEND_NOTIFICATION_EMAIL || 'jccmmelo@gmail.com',
    supervisaoEmail: 'joao.melo@sermail.pt',
  };

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
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">local_shipping</span>
                Pedidos & Expedição
              </Link>
              <Link
                href="/historico-pedidos"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">receipt_long</span>
                Histórico Pedidos
              </Link>
              <Link
                href="/configuracao"
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-secondary bg-secondary/10 border border-secondary/20 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">settings</span>
                Configuração
              </Link>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block px-3 py-1 bg-secondary text-on-secondary rounded-full text-xs font-bold tracking-wide uppercase shadow-sm">
                Painel de Configuração
              </span>
              <span className="text-xs font-semibold text-primary-fixed flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Administração do Sistema
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline mb-2">
              Configuração & Administração do Sistema
            </h1>
            <p className="text-xs sm:text-sm text-primary-fixed max-w-2xl">
              Gestão centralizada de contas de utilizadores, parametrização de clientes (siglas ≤ 4 carateres) e cadastro de artigos com controlo de conservação e lote/série.
            </p>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-secondary/10 pointer-events-none rounded-r-2xl"></div>
        </div>

        {/* Abas de Configuração */}
        <ConfiguracaoTabs
          users={(usersList as UserProfile[]) || []}
          clients={(clientsList as Client[]) || []}
          artigos={(artigosList as Artigo[]) || []}
          perfis={(perfisList as Perfil[]) || []}
          serverEmailConfig={serverEmailConfig}
        />
      </main>
    </div>
  );
}
