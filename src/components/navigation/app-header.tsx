'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserProfile } from '@/lib/supabase/types';
import { useLanguage } from '@/lib/i18n/context';
import SignOutButton from '@/app/dashboard/sign-out-button';

interface AppHeaderProps {
  userProfile: UserProfile | null;
  userEmail?: string;
  activeTab?: 'dashboard' | 'stocks' | 'pedidos' | 'historico-pedidos' | 'configuracao';
}

export default function AppHeader({
  userProfile,
  userEmail,
  activeTab,
}: AppHeaderProps) {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();

  const currentTab =
    activeTab ||
    (pathname.includes('/stocks')
      ? 'stocks'
      : pathname.includes('/pedidos')
      ? 'pedidos'
      : pathname.includes('/historico-pedidos')
      ? 'historico-pedidos'
      : pathname.includes('/configuracao')
      ? 'configuracao'
      : 'dashboard');

  const languagesList = [
    { code: 'pt' as const, label: 'PT', full: t.nav.ptFull },
    { code: 'es' as const, label: 'ES', full: t.nav.esFull },
    { code: 'en' as const, label: 'EN', full: t.nav.enFull },
  ];

  return (
    <header className="bg-surface-container-lowest border-b border-outline-variant/30 shadow-sm sticky top-0 z-30">
      {/* Top Menu Row */}
      <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCnkcXW31nD71g-vuvCogM_z_BQZYp3SeYlcPR9lObd0zi9HRBQLH095qBoZinA-Ox1WGs2p4GnbxdG6x_SyJacxhAEC8ePoOTFdVI_u8bi5Jz8urQ-1CGoQ-GLBrcYgguObeMYGS3nk6bnr3sz5sBFS2jgvNJ4q2dD3yvulEH__TQ89del8tYF83X-KLnVQ8LmQORLqrmMFqwy3hANJ47Ndo2MfkhLHNWlMpcIv_xjQCfIXFJ6ZrBmF-2FQOqHQLzu"
              alt="Sermail Logo"
              className="h-9 max-w-[140px] object-contain"
            />
            <div className="h-6 w-px bg-outline-variant/50 hidden sm:block"></div>
            <span className="font-headline font-bold text-secondary text-sm hidden sm:inline-block">
              {t.nav.plataformaFarma}
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1.5" aria-label="Menu Principal">
            <Link
              href="/dashboard"
              className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 leading-none transition-colors ${
                currentTab === 'dashboard'
                  ? 'font-bold text-secondary bg-lime-100/60 border border-lime-500 shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-lime-50/50 border border-lime-400/60 hover:border-lime-500'
              }`}
            >
              <span className="material-symbols-outlined text-sm">dashboard</span>
              {t.nav.dashboard}
            </Link>

            <Link
              href="/stocks"
              className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 leading-none transition-colors ${
                currentTab === 'stocks'
                  ? 'font-bold text-secondary bg-lime-100/60 border border-lime-500 shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-lime-50/50 border border-lime-400/60 hover:border-lime-500'
              }`}
            >
              <span className="material-symbols-outlined text-sm">inventory_2</span>
              {t.nav.stocks}
            </Link>

            <Link
              href="/pedidos"
              className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 leading-none transition-colors ${
                currentTab === 'pedidos'
                  ? 'font-bold text-secondary bg-lime-100/60 border border-lime-500 shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-lime-50/50 border border-lime-400/60 hover:border-lime-500'
              }`}
            >
              <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
              {t.nav.criarPedido}
            </Link>

            <Link
              href="/historico-pedidos"
              className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 leading-none transition-colors ${
                currentTab === 'historico-pedidos'
                  ? 'font-bold text-secondary bg-lime-100/60 border border-lime-500 shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-lime-50/50 border border-lime-400/60 hover:border-lime-500'
              }`}
            >
              <span className="material-symbols-outlined text-sm">receipt_long</span>
              {t.nav.historicoPedidos}
            </Link>

            {userProfile?.role === 'admin' && (
              <Link
                href="/configuracao"
                className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 leading-none transition-colors ${
                  currentTab === 'configuracao'
                    ? 'font-bold text-secondary bg-lime-100/60 border border-lime-500 shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-lime-50/50 border border-lime-400/60 hover:border-lime-500'
                }`}
              >
                <span className="material-symbols-outlined text-sm">settings</span>
                {t.nav.configuracao}
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-on-surface">
              {userProfile?.full_name || userEmail}
            </p>
            <p className="text-[11px] text-on-surface-variant/80 mt-0.5">
              {userProfile?.empresa || 'Sermail'}
            </p>
          </div>

          <SignOutButton />
        </div>
      </div>

      {/* Sub-bar abaixo do menu de topo com os 3 botões de idioma */}
      <div className="bg-surface-container-low/70 border-t border-outline-variant/20 px-4 sm:px-6 py-1.5 transition-colors">
        <div className="w-full flex items-center justify-between gap-3">
          {/* Indicador de navegação contextual */}
          <div className="flex items-center gap-2 text-xs text-on-surface-variant/80">
            <span className="material-symbols-outlined text-xs text-secondary/80">domain</span>
            <span className="hidden sm:inline font-medium">Sermail Farma</span>
            <span className="text-outline-variant/70 hidden sm:inline">/</span>
            <span className="font-semibold text-on-surface">
              {currentTab === 'dashboard' && t.nav.dashboard}
              {currentTab === 'stocks' && t.nav.stocks}
              {currentTab === 'pedidos' && t.nav.criarPedido}
              {currentTab === 'historico-pedidos' && t.nav.historicoPedidos}
              {currentTab === 'configuracao' && t.nav.configuracao}
            </span>
          </div>

          {/* Grupo com os 3 pequenos botões de alteração de língua: PT, ES, EN */}
          <div className="flex items-center gap-1.5" role="group" aria-label="Seleção de Idioma">
            <span className="text-[11px] font-semibold text-on-surface-variant/90 mr-1 hidden xs:inline">
              {t.nav.languageLabel}
            </span>

            {languagesList.map((lang) => {
              const isActive = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  title={`${lang.full} (${lang.label})`}
                  className={`h-6 px-2 sm:px-2.5 rounded-md text-[11px] font-bold inline-flex items-center justify-center transition-all cursor-pointer select-none ${
                    isActive
                      ? 'bg-secondary text-white shadow-xs ring-1 ring-secondary/50 scale-105'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant/40 hover:border-secondary/40'
                  }`}
                >
                  <span className="tracking-wide">{lang.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
