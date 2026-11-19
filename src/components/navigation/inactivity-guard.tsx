'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SESSION_USER_LANG_INIT_KEY } from '@/lib/i18n/context';

const LAST_ACTIVITY_STORAGE_KEY = 'platfarma_last_activity_ts';
const INACTIVITY_MINUTES_STORAGE_KEY = 'platfarma_inactivity_minutes';
const FORCE_LOGOUT_STORAGE_KEY = 'platfarma_force_logout_ts';
const HEADER_CACHE_KEY = 'platfarma_header_profile_cache_v1';

interface InactivityGuardProps {
  initialMinutes?: number;
  userId?: string | null;
  enabled?: boolean;
}

export default function InactivityGuard({
  initialMinutes = 60,
  userId,
  enabled = true,
}: InactivityGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const normalizedInitial =
    Number.isFinite(initialMinutes) && initialMinutes >= 3 ? Math.round(initialMinutes) : 60;

  const [inactivityMinutes, setInactivityMinutes] = useState<number>(normalizedInitial);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(120);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  const lastActivityRef = useRef<number>(Date.now());
  const lastThrottleRef = useRef<number>(0);
  const isLoggingOutRef = useRef<boolean>(false);
  const showWarningRef = useRef<boolean>(false);

  // Sincronizar quando a prop vinda do servidor mudar
  useEffect(() => {
    const next =
      Number.isFinite(initialMinutes) && initialMinutes >= 3 ? Math.round(initialMinutes) : 60;
    setInactivityMinutes(next);
  }, [initialMinutes]);

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth');
  const isActive = enabled && !isAuthPage;

  const resetActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    lastThrottleRef.current = now;
    if (showWarningRef.current) {
      showWarningRef.current = false;
      setShowWarningModal(false);
    }
    try {
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
    } catch {
      // Ignorar caso localStorage esteja bloqueado
    }
  }, []);

  const performLogout = useCallback(
    async (reason: 'inactivity' | 'manual') => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;
      setIsLoggingOut(true);
      setShowWarningModal(false);
      showWarningRef.current = false;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const obs =
          reason === 'inactivity'
            ? `Sessão encerrada automaticamente por inatividade (${inactivityMinutes} min)`
            : 'Sessão encerrada pelo utilizador durante aviso de inatividade';

        await supabase.rpc('registar_log_acesso', {
          p_tipo_movimento: 'LOGOUT',
          p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          p_observacoes: obs,
          p_user_id: user?.id || userId || null,
        });
      } catch (err) {
        console.warn('Não foi possível registar log de logout por inatividade:', err);
      }

      try {
        sessionStorage.removeItem(SESSION_USER_LANG_INIT_KEY);
        sessionStorage.removeItem(HEADER_CACHE_KEY);
        localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
        localStorage.setItem(FORCE_LOGOUT_STORAGE_KEY, String(Date.now()));
      } catch {
        // Ignorar erros de storage
      }

      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Erro ao terminar sessão Supabase:', err);
      }

      // Tenta fechar o separador/janela caso tenha sido aberta como aplicação/popup
      try {
        window.close();
      } catch {
        // Ignorado pelo browser caso seja separador normal
      }

      const redirectUrl = reason === 'inactivity' ? '/login?reason=inactivity' : '/login';
      router.push(redirectUrl);
      router.refresh();
    },
    [inactivityMinutes, router, supabase, userId]
  );

  // Ouvir atualizações de configuração de tempo de inatividade (na própria aba ou noutras abas)
  useEffect(() => {
    const handleConfigEvent = (ev: Event) => {
      const customEv = ev as CustomEvent<{ minutes?: number }>;
      const mins = Number(customEv.detail?.minutes);
      if (Number.isFinite(mins) && mins >= 3) {
        setInactivityMinutes(Math.round(mins));
        resetActivity();
      }
    };

    const handleStorageEvent = (ev: StorageEvent) => {
      if (ev.key === LAST_ACTIVITY_STORAGE_KEY && ev.newValue) {
        const ts = Number(ev.newValue);
        if (Number.isFinite(ts) && ts > lastActivityRef.current) {
          lastActivityRef.current = ts;
          if (showWarningRef.current) {
            showWarningRef.current = false;
            setShowWarningModal(false);
          }
        }
      } else if (ev.key === INACTIVITY_MINUTES_STORAGE_KEY && ev.newValue) {
        const mins = Number(ev.newValue);
        if (Number.isFinite(mins) && mins >= 3) {
          setInactivityMinutes(Math.round(mins));
          resetActivity();
        }
      } else if (ev.key === FORCE_LOGOUT_STORAGE_KEY && ev.newValue && isActive) {
        if (!isLoggingOutRef.current) {
          isLoggingOutRef.current = true;
          try {
            window.close();
          } catch {
            // Ignorar
          }
          router.push('/login?reason=inactivity');
          router.refresh();
        }
      }
    };

    window.addEventListener('platfarma:inactivity-updated', handleConfigEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener('platfarma:inactivity-updated', handleConfigEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [isActive, resetActivity, router]);

  // Monitorizar eventos de atividade do utilizador e temporizador de 1s
  useEffect(() => {
    if (!isActive) return;

    // Inicializar timestamp ao montar/entrar na sessão
    const now = Date.now();
    lastActivityRef.current = now;
    isLoggingOutRef.current = false;
    setIsLoggingOut(false);
    try {
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
    } catch {
      // Ignorar
    }

    const handleUserActivity = () => {
      // Se o aviso já estiver visível, o utilizador deve clicar no botão "Continuar Sessão"
      // para evitar que um movimento acidental do rato feche o aviso sem dar conta.
      if (showWarningRef.current || isLoggingOutRef.current) return;

      const currentTs = Date.now();
      if (currentTs - lastThrottleRef.current >= 2000) {
        lastThrottleRef.current = currentTs;
        lastActivityRef.current = currentTs;
        try {
          localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(currentTs));
        } catch {
          // Ignorar
        }
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    const interval = setInterval(() => {
      if (isLoggingOutRef.current) return;

      const timeoutMs = inactivityMinutes * 60 * 1000;
      const warningLeadMs = 2 * 60 * 1000; // Aviso 2 minutos antes
      const warningMs = Math.max(timeoutMs - warningLeadMs, 60 * 1000);

      // Sincronizar com possível atividade mais recente de outro separador
      try {
        const storedTs = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
        if (Number.isFinite(storedTs) && storedTs > lastActivityRef.current) {
          lastActivityRef.current = storedTs;
          if (showWarningRef.current) {
            showWarningRef.current = false;
            setShowWarningModal(false);
          }
        }
      } catch {
        // Ignorar
      }

      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= timeoutMs) {
        performLogout('inactivity');
      } else if (elapsed >= warningMs) {
        const remSecs = Math.max(1, Math.ceil((timeoutMs - elapsed) / 1000));
        setRemainingSeconds(remSecs);
        if (!showWarningRef.current) {
          showWarningRef.current = true;
          setShowWarningModal(true);
        }
      } else if (showWarningRef.current) {
        showWarningRef.current = false;
        setShowWarningModal(false);
      }
    }, 1000);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      clearInterval(interval);
    };
  }, [inactivityMinutes, isActive, performLogout]);

  if (!isActive || !showWarningModal) {
    return null;
  }

  const minsDisplay = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const secsDisplay = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="inactivity-dialog-title"
      aria-describedby="inactivity-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn"
    >
      <div className="w-full max-w-md bg-white border-2 border-lime-400 rounded-2xl shadow-2xl overflow-hidden">
        {/* Cabeçalho de Alerta */}
        <div className="bg-gradient-to-r from-sermail-green-dark via-sermail-green to-[#005a46] px-5 py-4 text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/50 text-amber-300 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl animate-pulse" aria-hidden="true">
              timer
            </span>
          </div>
          <div>
            <h2 id="inactivity-dialog-title" className="text-base sm:text-lg font-bold font-headline text-white leading-tight">
              Sessão Prestes a Encerrar
            </h2>
            <p className="text-xs text-lime-200 font-medium">
              Controlo Automático de Inatividade ({inactivityMinutes} min)
            </p>
          </div>
        </div>

        {/* Corpo com Contagem Decrescente */}
        <div className="p-5 sm:p-6 space-y-4">
          <p id="inactivity-dialog-desc" className="text-sm text-slate-700 leading-relaxed">
            Não foi detetada atividade nos últimos minutos. Por motivos de segurança, a aplicação irá encerrar a sessão automaticamente dentro de:
          </p>

          <div className="flex items-center justify-center py-3 px-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950">
            <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-wider">
              {minsDisplay}:{secsDisplay}
            </span>
          </div>

          <p className="text-xs text-slate-500 text-center">
            Clique em <strong>Continuar Sessão</strong> para manter a aplicação aberta e reiniciar o contador.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => performLogout('manual')}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
            >
              Terminar Sessão Agora
            </button>
            <button
              type="button"
              autoFocus
              disabled={isLoggingOut}
              onClick={resetActivity}
              className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-sermail-green hover:bg-sermail-green-dark shadow-sm border border-lime-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base text-lime-300" aria-hidden="true">
                check_circle
              </span>
              Continuar Sessão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
