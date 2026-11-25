'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage, normalizeUserIdioma, SESSION_USER_LANG_INIT_KEY } from '@/lib/i18n/context';
import { translations } from '@/lib/i18n/translations';

export default function LoginPage() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // Recuperação de password por email (válida por 1 minuto)
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reason') === 'inactivity') {
        setErrorMessage(
          language === 'en'
            ? 'Your session was automatically closed due to inactivity. Please sign in again.'
            : language === 'es'
            ? 'Su sesión se cerró automáticamente por inactividad. Por favor, inicie sesión nuevamente.'
            : 'A sua sessão foi encerrada automaticamente por inatividade. Por favor, inicie sessão novamente.'
        );
      }
    }
  }, [language]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (lockoutTimer > 0) {
      setErrorMessage(
        language === 'en'
          ? `Too many failed attempts. Please wait ${lockoutTimer}s.`
          : language === 'es'
          ? `Demasiados intentos fallidos. Por favor espere ${lockoutTimer}s.`
          : `Demasiadas tentativas falhadas. Por favor, aguarde ${lockoutTimer}s.`
      );
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage(
        language === 'pt'
          ? 'Por favor, introduza o seu email e a palavra-passe.'
          : language === 'es'
          ? 'Por favor, introduzca su email y contraseña.'
          : 'Please enter your email and password.'
      );
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: password,
      });

      if (error) {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);

        if (nextFailed >= 5) {
          setLockoutTimer(30);
          setErrorMessage(
            language === 'en'
              ? 'Too many failed login attempts. Form locked for 30 seconds for security.'
              : language === 'es'
              ? 'Demasiados intentos fallidos. Formulario bloqueado durante 30 segundos por seguridad.'
              : 'Demasiadas tentativas falhadas. Formulário bloqueado durante 30 segundos por motivos de segurança.'
          );
        } else if (error.message.includes('Invalid login credentials')) {
          setErrorMessage(t.login.invalidCredentials);
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMessage(t.login.emailNotConfirmed);
        } else {
          setErrorMessage(error.message || t.common.error);
        }
        setIsLoading(false);
        return;
      }

      if (data?.user) {
        setFailedAttempts(0);
        setLockoutTimer(0);
        // Verificar se o utilizador está ativo e obter o idioma configurado na tabela public.users
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id, email, ativo, role, full_name, empresa, idioma, cliente_id')
          .eq('id', data.user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.warn('Perfil warning:', profileError);
        }

        if (profile && profile.ativo === false) {
          await supabase.auth.signOut();
          setErrorMessage(t.login.accountInactive);
          setIsLoading(false);
          return;
        }

        // Aplicar o idioma configurado do utilizador (PT, EN ou ES) ao iniciar a aplicação
        const userLang = normalizeUserIdioma(profile?.idioma);
        if (userLang) {
          setLanguage(userLang);
        }
        try {
          sessionStorage.setItem(SESSION_USER_LANG_INIT_KEY, data.user.id);
          if (profile) {
            sessionStorage.setItem(
              'platfarma_header_profile_cache_v1',
              JSON.stringify({ profile, email: data.user.email })
            );
          }
        } catch {
          // Ignorar se sessionStorage indisponível
        }

        // Registar movimento de LOGIN na tabela public.log de forma não bloqueante
        void supabase
          .rpc('registar_log_acesso', {
            p_tipo_movimento: 'LOGIN',
            p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            p_observacoes: null,
            p_user_id: data.user.id,
          })
          .then(({ error: logRpcErr }) => {
            if (logRpcErr) {
              console.warn('Erro RPC registar_log_acesso (login):', logRpcErr);
            }
          });

        const effectiveTrans = userLang ? translations[userLang] : t;
        setSuccessMessage(effectiveTrans.login.loginSuccess);
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      setErrorMessage(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-surface text-on-surface">
      {/* Background Layer with Image and Overlay */}
      <div className="fixed inset-0 z-0">
        <img
          alt=""
          className="w-full h-full object-cover"
          data-alt="Cinematic wide shot of a modern logistics warehouse interior with high shelves and soft morning light filtering through high windows"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBSL0YV5ELXv0cCNZdlinWNpKfN6Nxa6i-4ieSILsReoNYzglgwNO1-cjyPG6jjlEjLdnh8561dzBsde_0MdD0aPYbZV2UMzVBAYQ8vSkyJx1Payz1d5Nu7NsetwOoVhexIbtxHxuJZPbj5oltIdRMYTT95zQsyhPysbVqrjgIGzNGC8Z7i6gq1NTdG80tklyxIkORhPJaJKRSLe6IJC_T5dvdtA5WTL3t0NNLvDTvbuU2BSu5Zp4K2rBVSZCevXnlflW1xSuy7gg"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary-container/80 to-secondary/40"></div>
        {/* Subtle Pattern Overlay */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#8ff6d0 0.5px, transparent 0.5px)',
            backgroundSize: '24px 24px',
          }}
        ></div>
      </div>

      {/* Main Content Canvas */}
      <main className="relative z-10 w-full max-w-md px-6 py-12">
        <div className="glass-panel p-8 md:p-10 rounded-xl shadow-2xl transition-transform duration-300">
          {/* Brand Identity */}
          <div className="text-center mb-10">
            <div className="flex justify-center items-center mb-4">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCnkcXW31nD71g-vuvCogM_z_BQZYp3SeYlcPR9lObd0zi9HRBQLH095qBoZinA-Ox1WGs2p4GnbxdG6x_SyJacxhAEC8ePoOTFdVI_u8bi5Jz8urQ-1CGoQ-GLBrcYgguObeMYGS3nk6bnr3sz5sBFS2jgvNJ4q2dD3yvulEH__TQ89del8tYF83X-KLnVQ8LmQORLqrmMFqwy3hANJ47Ndo2MfkhLHNWlMpcIv_xjQCfIXFJ6ZrBmF-2FQOqHQLzu"
                alt="Sermail Logo"
                className="h-14 max-w-[210px] object-contain"
              />
            </div>
            <h1 className="text-secondary font-bold text-lg tracking-tight mb-1">
              {t.login.title}
            </h1>
            <p className="text-xs text-on-surface-variant font-medium">
              {t.login.welcome}
            </p>
          </div>

          {/* Alert Messages */}
          {errorMessage && (
            <div
              id="login-error-alert"
              className="mb-6 p-3.5 bg-error-container/80 border border-error/30 rounded-lg text-on-error-container text-xs flex items-center gap-2.5 animate-fadeIn"
            >
              <span className="material-symbols-outlined text-error text-lg flex-shrink-0">
                error
              </span>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              id="login-success-alert"
              className="mb-6 p-3.5 bg-secondary-container/80 border border-secondary/30 rounded-lg text-on-secondary-container text-xs flex items-center gap-2.5 animate-fadeIn"
            >
              <span className="material-symbols-outlined text-secondary text-lg flex-shrink-0">
                check_circle
              </span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form className="space-y-6" onSubmit={handleLogin}>
            {/* Username / Email Field */}
            <div className="space-y-1.5">
              <label
                className="block text-xs font-semibold uppercase tracking-widest text-on-surface-variant ml-1"
                htmlFor="username"
              >
                {t.login.userEmail}
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 select-none pointer-events-none"
                  data-icon="person"
                >
                  person
                </span>
                <input
                  id="username"
                  name="username"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@sermail.pt"
                  className="w-full pl-10 pr-4 py-3.5 bg-surface-variant/50 border-none rounded-lg focus:ring-2 focus:ring-secondary/40 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-on-surface-variant/40 text-sm"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label
                className="block text-xs font-semibold uppercase tracking-widest text-on-surface-variant ml-1"
                htmlFor="password"
              >
                {t.login.password}
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 select-none pointer-events-none"
                  data-icon="lock"
                >
                  lock
                </span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3.5 bg-surface-variant/50 border-none rounded-lg focus:ring-2 focus:ring-secondary/40 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-on-surface-variant/40 text-sm"
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email.trim());
                    setResetError(null);
                    setResetSuccess(null);
                    setIsForgotModalOpen(true);
                  }}
                  className="text-xs font-semibold text-primary hover:text-primary-container hover:underline transition-colors cursor-pointer"
                >
                  {language === 'en'
                    ? 'Forgot Password?'
                    : language === 'es'
                    ? '¿Olvidaste tu contraseña?'
                    : 'Esqueci-me da Password'}
                </button>
              </div>
            </div>

            {/* Primary Action */}
            <button
              type="submit"
              disabled={isLoading}
              className="group w-full py-4 bg-primary text-on-primary font-bold rounded-full shadow-lg shadow-primary/20 hover:scale-[1.02] hover:bg-primary-container transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>{t.login.authenticating}</span>
                </>
              ) : (
                <>
                  <span>{t.login.loginButton}</span>
                  <span
                    className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1"
                    data-icon="arrow_forward"
                  >
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Support & Footer Navigation */}
          <div className="mt-8 pt-8 border-t border-outline-variant/20">
            <div className="flex flex-col items-center gap-4">
              <a
                href="mailto:suporte@sermail.pt"
                className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-medium text-sm"
              >
                <span
                  className="material-symbols-outlined text-lg"
                  data-icon="contact_support"
                >
                  contact_support
                </span>
                <span>{t.login.support}</span>
              </a>
              <div className="flex items-center gap-4 text-xs text-on-surface-variant/60 mt-4">
                <a href="#privacidade" className="hover:underline">
                  {t.login.privacy}
                </a>
                <span>•</span>
                <a href="#termos" className="hover:underline">
                  {t.login.terms}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* System Message / Help */}
        <div className="mt-8 text-center text-on-primary/70 text-sm">
          <p>{t.login.copyright}</p>
        </div>
      </main>

      {/* Bottom Decorative Glow */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-secondary/20 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Modal: Esqueci-me da Password (Link válido por 1 minuto) */}
      {isForgotModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSendingReset) {
              setIsForgotModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-2xl text-primary">mail_lock</span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    {language === 'en'
                      ? 'Recover Password'
                      : language === 'es'
                      ? 'Recuperar Contraseña'
                      : 'Recuperar Password'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {language === 'en'
                      ? 'The reset link will be valid for 1 minute only.'
                      : language === 'es'
                      ? 'El enlace será válido durante solo 1 minuto.'
                      : 'O link de alteração será válido apenas por 1 minuto.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                disabled={isSendingReset}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setResetError(null);
                setResetSuccess(null);
                const trimmed = resetEmail.trim();
                if (!trimmed) {
                  setResetError('Por favor, introduza o seu email.');
                  return;
                }
                setIsSendingReset(true);
                try {
                  const expiresAt = Date.now() + 60 * 1000; // 1 minuto exacto
                  const redirectTo = `${window.location.origin}/reset-password?expiresAt=${expiresAt}`;
                  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
                    redirectTo,
                  });
                  if (error) {
                    setResetError(error.message);
                  } else {
                    setResetSuccess(
                      language === 'en'
                        ? 'Recovery email sent! Please check your inbox. You have 1 minute to complete the password change.'
                        : language === 'es'
                        ? '¡Correo enviado! Revise su bandeja de entrada. Dispone de 1 minuto para cambiar la contraseña.'
                        : 'Email de recuperação enviado! Verifique a sua caixa de entrada. Tem apenas 1 minuto para concluir a alteração da password.'
                    );
                  }
                } catch (err: any) {
                  setResetError(err?.message || 'Erro ao enviar email de recuperação.');
                } finally {
                  setIsSendingReset(false);
                }
              }}
              className="p-6 space-y-4"
            >
              {resetError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
                  <span className="material-symbols-outlined text-base text-rose-600 shrink-0">error</span>
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start gap-2">
                  <span className="material-symbols-outlined text-base text-emerald-600 shrink-0">check_circle</span>
                  <span>{resetSuccess}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="reset-email" className="block text-xs font-bold text-slate-700">
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="exemplo@sermail.pt"
                  disabled={isSendingReset}
                  className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  disabled={isSendingReset}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSendingReset}
                  className="px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-container rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-base">send</span>
                  <span>
                    {isSendingReset
                      ? 'A enviar...'
                      : language === 'en'
                      ? 'Send Recovery Email'
                      : language === 'es'
                      ? 'Enviar Correo'
                      : 'Enviar Email'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
