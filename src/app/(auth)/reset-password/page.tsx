'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/context';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const supabase = createClient();

  const expiresAtParam = searchParams.get('expiresAt');
  const expiresAt = expiresAtParam ? Number(expiresAtParam) : 0;

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (!expiresAt || isNaN(expiresAt)) return 0;
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Temporizador em tempo real de 1 minuto
  useEffect(() => {
    if (!expiresAt || isNaN(expiresAt)) {
      setRemainingSeconds(0);
      return;
    }

    const updateCountdown = () => {
      const diff = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpired = remainingSeconds <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (Date.now() > expiresAt || isExpired) {
      setErrorMessage(
        'O tempo limite de 1 minuto expirou. Solicite um novo email de recuperação na página de login.'
      );
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('A nova password deve ter pelo menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('As passwords não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result?.error || 'Erro ao atualizar a password.');
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setIsLoading(false);

      // Terminar sessão de recuperação localmente (sem depender de pedido externo) e redirecionar para login
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Ignorar falha de rede no logout local
      }
      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro inesperado ao alterar a password.');
      setIsLoading(false);
    }
  };

  const formattedTime = `00:${String(remainingSeconds).padStart(2, '0')}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">lock_reset</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {language === 'en'
                  ? 'Set New Password'
                  : language === 'es'
                  ? 'Definir Nueva Contraseña'
                  : 'Definir Nova Password'}
              </h1>
              <p className="text-xs text-slate-500">PlatFarmaSupa — Sermail</p>
            </div>
          </div>

          {!isSuccess && (
            <div
              className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 border ${
                isExpired
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : remainingSeconds <= 15
                  ? 'bg-amber-50 text-amber-700 border-amber-300 animate-pulse'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
              title="Tempo restante para concluir a alteração"
            >
              <span className="material-symbols-outlined text-sm">timer</span>
              <span>{formattedTime}</span>
            </div>
          )}
        </div>

        <div className="p-6">
          {isSuccess ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Password alterada com sucesso!
              </h2>
              <p className="text-xs text-slate-600">
                A redirecionar para a página de login...
              </p>
            </div>
          ) : isExpired ? (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">timer_off</span>
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900">
                  Link Expirado (Limite de 1 Minuto)
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Por motivos de segurança, a janela de 1 minuto para alterar a password terminou.
                  Volte à página de login e solicite um novo email de recuperação.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                <span>Voltar ao Login</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
                  <span className="material-symbols-outlined text-base text-rose-600 shrink-0">error</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="reset-new-password" className="block text-xs font-bold text-slate-700">
                  Nova Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="reset-new-password"
                    type={showNew ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 pr-10 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showNew ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reset-confirm-password" className="block text-xs font-bold text-slate-700">
                  Confirmar Nova Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="reset-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Reintroduza a nova password"
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 pr-10 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showConfirm ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isExpired}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">check</span>
                <span>{isLoading ? 'A guardar...' : 'Guardar Nova Password'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-emerald-950 text-white text-sm">
          A carregar...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
