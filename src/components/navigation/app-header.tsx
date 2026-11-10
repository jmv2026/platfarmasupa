'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserProfile } from '@/lib/supabase/types';
import { useLanguage, normalizeUserIdioma, SESSION_USER_LANG_INIT_KEY } from '@/lib/i18n/context';
import SignOutButton from '@/app/dashboard/sign-out-button';

export type NavTab =
  | 'dashboard'
  | 'stocks'
  | 'pedidos'
  | 'historico-pedidos'
  | 'logistica-inversa'
  | 'proc-pedidos'
  | 'configuracao';

interface AppHeaderProps {
  userProfile: UserProfile | null;
  userEmail?: string;
  activeTab?: NavTab;
}

interface HeaderShellContextValue {
  isShellMounted: boolean;
  userProfile: UserProfile | null;
  userEmail?: string;
  syncHeaderState: (profile: UserProfile | null, email?: string) => void;
}

const SESSION_HEADER_CACHE_KEY = 'platfarma_header_profile_cache_v1';

const HeaderShellContext = createContext<HeaderShellContextValue>({
  isShellMounted: false,
  userProfile: null,
  userEmail: undefined,
  syncHeaderState: () => {},
});

function resolveTabFromPathname(pathname: string): NavTab {
  const lower = pathname.toLowerCase();
  if (lower.includes('/stocks')) return 'stocks';
  if (lower.includes('/proc_pedidos') || lower.includes('/proc-pedidos')) return 'proc-pedidos';
  if (lower.includes('/logistica-inversa') || lower.includes('/logistica_inversa')) return 'logistica-inversa';
  if (lower.includes('/historico-pedidos')) return 'historico-pedidos';
  if (lower.includes('/pedidos')) return 'pedidos';
  if (lower.includes('/configuracao')) return 'configuracao';
  return 'dashboard';
}

function HeaderBarUI({
  userProfile,
  userEmail,
  activeTab,
}: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const [optimisticTab, setOptimisticTab] = useState<NavTab | null>(null);
  const [prefetchedRoutes, setPrefetchedRoutes] = useState<Set<string>>(() => new Set());

  const officialTab = activeTab || resolveTabFromPathname(pathname);

  // Limpa o estado otimista assim que o pathname oficial alcança o destino
  useEffect(() => {
    setOptimisticTab(null);
  }, [pathname]);

  // Ao iniciar a sessão / aplicação, aplicar o idioma predefinido do utilizador (tabela public.users.idioma)
  useEffect(() => {
    if (!userProfile?.id) return;
    try {
      const initializedForUser = sessionStorage.getItem(SESSION_USER_LANG_INIT_KEY);
      if (initializedForUser !== userProfile.id) {
        const userLang = normalizeUserIdioma(userProfile.idioma);
        if (userLang) {
          setLanguage(userLang);
        }
        sessionStorage.setItem(SESSION_USER_LANG_INIT_KEY, userProfile.id);
      }
    } catch {
      // Ignorar caso sessionStorage não esteja disponível
    }
  }, [userProfile?.id, userProfile?.idioma, setLanguage]);

  // Prefetch inteligente por intenção (hover/focus/touch) para evitar congestionar a BD com 6 rotas em simultâneo
  const handleIntentPrefetch = useCallback(
    (href: string) => {
      if (prefetchedRoutes.has(href)) return;
      setPrefetchedRoutes((prev) => {
        const next = new Set(prev);
        next.add(href);
        return next;
      });
      router.prefetch(href);
    },
    [prefetchedRoutes, router]
  );

  const currentTab = optimisticTab || officialTab;
  const isTransitioning = optimisticTab !== null && optimisticTab !== officialTab;

  const languagesList = [
    { code: 'pt' as const, label: 'PT', full: t.nav.ptFull },
    { code: 'es' as const, label: 'ES', full: t.nav.esFull },
    { code: 'en' as const, label: 'EN', full: t.nav.enFull },
  ];

  const canSeeProcPedidos =
    userProfile?.role === 'gestor' ||
    userProfile?.role === 'admin' ||
    userProfile?.email === 'admin@sermail.pt' ||
    userEmail === 'admin@sermail.pt';

  const canSeeConfiguracao =
    userProfile?.role === 'admin' ||
    userProfile?.email === 'admin@sermail.pt' ||
    userEmail === 'admin@sermail.pt';

  const navItems: Array<{
    tab: NavTab;
    href: string;
    icon: string;
    label: string;
    visible: boolean;
  }> = [
    {
      tab: 'dashboard',
      href: '/dashboard',
      icon: 'dashboard',
      label: t.nav.dashboard,
      visible: true,
    },
    {
      tab: 'stocks',
      href: '/stocks',
      icon: 'inventory_2',
      label: t.nav.stocks,
      visible: true,
    },
    {
      tab: 'pedidos',
      href: '/pedidos',
      icon: 'add_shopping_cart',
      label: t.nav.criarPedido,
      visible: true,
    },
    {
      tab: 'historico-pedidos',
      href: '/historico-pedidos',
      icon: 'receipt_long',
      label: t.nav.historicoPedidos,
      visible: true,
    },
    {
      tab: 'logistica-inversa',
      href: '/logistica-inversa',
      icon: 'assignment_return',
      label: t.nav.logisticaInversa,
      visible: true,
    },
    {
      tab: 'proc-pedidos',
      href: '/Proc_Pedidos',
      icon: 'fact_check',
      label: t.nav.procPedidos,
      visible: canSeeProcPedidos,
    },
    {
      tab: 'configuracao',
      href: '/configuracao',
      icon: 'settings',
      label: t.nav.configuracao,
      visible: canSeeConfiguracao,
    },
  ];

  return (
    <header className="bg-white border-b border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,40,30,0.03)] sticky top-0 z-30 transition-all">
      {/* Top Menu Row */}
      <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCnkcXW31nD71g-vuvCogM_z_BQZYp3SeYlcPR9lObd0zi9HRBQLH095qBoZinA-Ox1WGs2p4GnbxdG6x_SyJacxhAEC8ePoOTFdVI_u8bi5Jz8urQ-1CGoQ-GLBrcYgguObeMYGS3nk6bnr3sz5sBFS2jgvNJ4q2dD3yvulEH__TQ89del8tYF83X-KLnVQ8LmQORLqrmMFqwy3hANJ47Ndo2MfkhLHNWlMpcIv_xjQCfIXFJ6ZrBmF-2FQOqHQLzu"
              alt="Sermail Logo"
              className="h-9 max-w-[140px] object-contain"
            />
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-headline font-bold text-sermail-green-dark text-sm tracking-tight">
                {t.nav.plataformaFarma}
              </span>
              <span
                className="w-2 h-2 rounded-full bg-sermail-lime-vibrant animate-pulse"
                title="Sistema Online"
              ></span>
            </div>
          </div>

          {/* Navigation Links com feedback visual instantâneo e prefetch por intenção */}
          <nav className="flex items-center gap-1.5" aria-label="Menu Principal">
            {navItems
              .filter((item) => item.visible)
              .map((item) => {
                const isActive = currentTab === item.tab;
                const isLoadingThisTab = isTransitioning && optimisticTab === item.tab;
                return (
                  <Link
                    key={item.tab}
                    href={item.href}
                    prefetch="auto"
                    onMouseEnter={() => handleIntentPrefetch(item.href)}
                    onFocus={() => handleIntentPrefetch(item.href)}
                    onTouchStart={() => handleIntentPrefetch(item.href)}
                    onClick={() => {
                      if (officialTab !== item.tab) {
                        setOptimisticTab(item.tab);
                      }
                    }}
                    className={`h-8 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 leading-none transition-all ${
                      isActive
                        ? 'bg-sermail-green text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-sermail-green-dark hover:bg-slate-100/90 font-medium'
                    }`}
                  >
                    {isLoadingThisTab ? (
                      <span
                        className="w-3.5 h-3.5 border-2 border-sermail-lime-border border-t-transparent rounded-full animate-spin shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className={`material-symbols-outlined text-sm ${
                          isActive ? 'text-sermail-lime-border' : 'text-slate-400'
                        }`}
                      >
                        {item.icon}
                      </span>
                    )}
                    {item.label}
                  </Link>
                );
              })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-900 leading-tight">
              {userProfile?.full_name || userEmail}
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {userProfile?.empresa || 'Sermail'}
            </p>
          </div>

          <SignOutButton />
        </div>
      </div>

      {/* Sub-bar abaixo do menu de topo com os 3 botões de idioma */}
      <div className="bg-slate-50/90 border-t border-slate-200/60 px-4 sm:px-6 py-1.5 transition-colors">
        <div className="w-full flex items-center justify-between gap-3">
          {/* Indicador de navegação contextual */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="material-symbols-outlined text-xs text-sermail-green">domain</span>
            <span className="hidden sm:inline font-medium">Sermail Farma</span>
            <span className="text-slate-300 hidden sm:inline">/</span>
            <span className="font-semibold text-slate-900">
              {currentTab === 'dashboard' && t.nav.dashboard}
              {currentTab === 'stocks' && t.nav.stocks}
              {currentTab === 'pedidos' && t.nav.criarPedido}
              {currentTab === 'historico-pedidos' && t.nav.historicoPedidos}
              {currentTab === 'logistica-inversa' && t.nav.logisticaInversa}
              {currentTab === 'proc-pedidos' && t.nav.procPedidos}
              {currentTab === 'configuracao' && t.nav.configuracao}
            </span>
          </div>

          {/* Grupo com os 3 botões de alteração de língua: PT, ES, EN */}
          <div className="flex items-center gap-1.5" role="group" aria-label="Seleção de Idioma">
            <span className="text-[11px] font-semibold text-slate-500 mr-1 hidden xs:inline">
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
                  className={`h-6 px-2.5 rounded-md text-[11px] font-bold inline-flex items-center justify-center transition-all cursor-pointer select-none ${
                    isActive
                      ? 'bg-sermail-green text-white shadow-xs scale-105'
                      : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
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

/**
 * Shell persistente montado no RootLayout: mantém a barra de navegação viva e interativa
 * durante todas as transições de página (incluindo durante a exibição de loading.tsx).
 */
export function PersistentAppShell({
  initialProfile,
  initialEmail,
  children,
}: {
  initialProfile: UserProfile | null;
  initialEmail?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(initialProfile);
  const [userEmail, setUserEmail] = useState<string | undefined>(initialEmail);

  // Sincronizar quando as props do servidor mudam (ex: após login/refresh)
  useEffect(() => {
    if (initialProfile) {
      setUserProfile(initialProfile);
    }
    if (initialEmail) {
      setUserEmail(initialEmail);
    }
  }, [initialProfile, initialEmail]);

  // Restaurar cache de sessão se necessário durante transições rápidas após login
  useEffect(() => {
    if (userProfile || typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(SESSION_HEADER_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.profile) setUserProfile(parsed.profile);
        if (parsed?.email) setUserEmail(parsed.email);
      }
    } catch {
      // Ignorar
    }
  }, [userProfile]);

  const syncHeaderState = useCallback((profile: UserProfile | null, email?: string) => {
    if (profile) {
      setUserProfile((prev) => {
        if (
          prev?.id === profile.id &&
          prev?.role === profile.role &&
          prev?.full_name === profile.full_name &&
          prev?.empresa === profile.empresa &&
          prev?.idioma === profile.idioma
        ) {
          return prev;
        }
        return profile;
      });
    }
    if (email) {
      setUserEmail((prev) => (prev === email ? prev : email));
    }
    try {
      if (profile || email) {
        sessionStorage.setItem(
          SESSION_HEADER_CACHE_KEY,
          JSON.stringify({ profile, email })
        );
      }
    } catch {
      // Ignorar
    }
  }, []);

  const isLoginRoute = pathname.startsWith('/login');

  return (
    <HeaderShellContext.Provider
      value={{
        isShellMounted: true,
        userProfile,
        userEmail,
        syncHeaderState,
      }}
    >
      {!isLoginRoute && (
        <HeaderBarUI userProfile={userProfile} userEmail={userEmail} />
      )}
      {children}
    </HeaderShellContext.Provider>
  );
}

/**
 * Componente usado pelas páginas: se o PersistentAppShell estiver ativo no RootLayout,
 * apenas sincroniza os dados de perfil sem duplicar o <header> dentro do limite de <Suspense>.
 */
export default function AppHeader({
  userProfile,
  userEmail,
  activeTab,
}: AppHeaderProps) {
  const { isShellMounted, syncHeaderState } = useContext(HeaderShellContext);

  useEffect(() => {
    if (isShellMounted && (userProfile || userEmail)) {
      syncHeaderState(userProfile, userEmail);
    }
  }, [isShellMounted, userProfile, userEmail, syncHeaderState]);

  if (isShellMounted) {
    return null;
  }

  return (
    <HeaderBarUI
      userProfile={userProfile}
      userEmail={userEmail}
      activeTab={activeTab}
    />
  );
}
