import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from './sign-out-button';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-background text-on-background">
      {/* Header */}
      <header className="bg-surface-container-lowest border-b border-outline-variant/30 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary-container to-primary text-on-primary rounded-2xl p-6 sm:p-8 shadow-xl mb-8 relative overflow-hidden">
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold tracking-wide uppercase mb-3">
              Fase 1 Concluída
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline mb-2">
              Bem-vindo à Plataforma Farma, {profile?.full_name || 'Administrador'}!
            </h1>
            <p className="text-primary-fixed text-sm max-w-2xl">
              Autenticação segura via Supabase Auth configurada com sucesso para a empresa Sermail, Logística Integrada Lda.
            </p>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-secondary/10 pointer-events-none rounded-r-2xl"></div>
        </div>

        {/* User Card & System Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">account_circle</span>
              Dados do Utilizador
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-on-surface-variant font-medium">Email</dt>
                <dd className="text-on-surface font-semibold mt-0.5">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-on-surface-variant font-medium">Perfil / Função</dt>
                <dd className="text-secondary font-semibold mt-0.5 uppercase">{profile?.role || 'admin'}</dd>
              </div>
              <div>
                <dt className="text-xs text-on-surface-variant font-medium">Empresa</dt>
                <dd className="text-on-surface font-semibold mt-0.5">{profile?.empresa || 'Sermail, Logística Integrada Lda'}</dd>
              </div>
              <div>
                <dt className="text-xs text-on-surface-variant font-medium">Estado da Conta</dt>
                <dd className="text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Ativo
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">database</span>
              Estado da Base de Dados
            </h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-on-surface-variant font-medium">Backend</dt>
                <dd className="text-on-surface font-semibold mt-0.5">Supabase PostgreSQL</dd>
              </div>
              <div>
                <dt className="text-xs text-on-surface-variant font-medium">Limpeza de Tabelas</dt>
                <dd className="text-emerald-700 font-semibold mt-0.5">Executada com Sucesso</dd>
              </div>
              <div>
                <dt className="text-xs text-on-surface-variant font-medium">Conta de Teste</dt>
                <dd className="text-on-surface font-mono text-xs mt-0.5">admin@sermail.pt</dd>
              </div>
            </dl>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">checklist</span>
              Fases do Projeto
            </h2>
            <ul className="space-y-2.5 text-xs">
              <li className="flex items-center gap-2 text-emerald-800 font-medium">
                <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                Fase 1: Login & Autenticação Supabase
              </li>
              <li className="flex items-center gap-2 text-on-surface-variant/70">
                <span className="material-symbols-outlined text-outline text-base">radio_button_unchecked</span>
                Fase 2: Gestão de Clientes & Artigos
              </li>
              <li className="flex items-center gap-2 text-on-surface-variant/70">
                <span className="material-symbols-outlined text-outline text-base">radio_button_unchecked</span>
                Fase 3: Armazéns & Movimentos
              </li>
              <li className="flex items-center gap-2 text-on-surface-variant/70">
                <span className="material-symbols-outlined text-outline text-base">radio_button_unchecked</span>
                Fase 4: Pedidos & Expedição
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
