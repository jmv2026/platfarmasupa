'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/context';
import { Language } from '@/lib/i18n/translations';

export default function LoginPage() {
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

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
        if (error.message.includes('Invalid login credentials')) {
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
        // Verificar se o utilizador está ativo na tabela public.users
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('ativo, role, full_name')
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

        setSuccessMessage(t.login.loginSuccess);
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      setErrorMessage(msg);
      setIsLoading(false);
    }
  };

  const languagesList: { code: Language; label: string; full: string }[] = [
    { code: 'pt', label: 'PT', full: t.nav.ptFull },
    { code: 'es', label: 'ES', full: t.nav.esFull },
    { code: 'en', label: 'EN', full: t.nav.enFull },
  ];

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

      {/* Language Switcher on Top Right of the Screen */}
      <div className="fixed top-4 right-4 z-20 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/20 shadow-lg">
        <span className="text-[11px] font-semibold text-white/80 mr-1 hidden sm:inline">
          {t.nav.languageLabel}
        </span>
        {languagesList.map((item) => {
          const isActive = language === item.code;
          return (
            <button
              key={item.code}
              type="button"
              onClick={() => setLanguage(item.code)}
              title={item.full}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer select-none ${
                isActive
                  ? 'bg-secondary text-on-secondary shadow-md scale-105'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{item.label}</span>
            </button>
          );
        })}
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
            </div>

            {/* Form Options */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center">
                <input
                  id="remember"
                  name="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-secondary border-outline-variant rounded focus:ring-secondary cursor-pointer"
                />
                <label
                  htmlFor="remember"
                  className="ml-2 text-sm text-on-surface-variant cursor-pointer select-none"
                >
                  {t.login.rememberMe}
                </label>
              </div>
              <a
                href="#recuperar-password"
                onClick={(e) => {
                  e.preventDefault();
                  alert(t.login.forgotPasswordAlert);
                }}
                className="text-sm font-semibold text-secondary hover:text-on-secondary-container transition-colors"
              >
                {t.login.forgotPassword}
              </a>
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
    </div>
  );
}
