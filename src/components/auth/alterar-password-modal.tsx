'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/context';

interface AlterarPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

export default function AlterarPasswordModal({
  isOpen,
  onClose,
  userEmail,
}: AlterarPasswordModalProps) {
  const { t } = useLanguage();
  const supabase = createClient();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Limpa o formulário ao abrir/fechar o modal
  const handleResetForm = useCallback(() => {
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setErrorMessage(null);
    setIsSuccess(false);
    setIsLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    handleResetForm();
    onClose();
  }, [handleResetForm, onClose]);

  // Fechar com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, handleClose]);

  // Validação das regras de segurança de password
  const hasMinLength = newPassword.length >= 8;
  const hasUpperLower = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // Cálculo da força da password (0 a 3)
  const strengthScore = useMemo(() => {
    if (!newPassword) return 0;
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (hasUpperLower) score++;
    if (hasNumber) score++;
    if (/[^a-zA-Z0-9]/.test(newPassword)) score++;
    return Math.min(score, 3);
  }, [newPassword, hasUpperLower, hasNumber]);

  const strengthLabel = useMemo(() => {
    if (strengthScore <= 1) return t.passwordModal.forcaFraca;
    if (strengthScore === 2) return t.passwordModal.forcaMedia;
    return t.passwordModal.forcaForte;
  }, [strengthScore, t]);

  const strengthColor = useMemo(() => {
    if (strengthScore <= 1) return 'bg-rose-500';
    if (strengthScore === 2) return 'bg-amber-500';
    return 'bg-emerald-500';
  }, [strengthScore]);

  const isFormValid = hasMinLength && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!hasMinLength) {
      setErrorMessage(t.passwordModal.erroCurta);
      return;
    }
    if (!passwordsMatch) {
      setErrorMessage(t.passwordModal.erroNaoCoincidem);
      return;
    }

    setIsLoading(true);

    try {
      // 1. Atualizar a palavra-passe no Supabase Auth
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMessage(error.message || t.passwordModal.erroGenerico);
        setIsLoading(false);
        return;
      }

      // 2. Registar evento de segurança no audit_logs
      try {
        const currentUser = data?.user;
        if (currentUser) {
          await supabase.from('audit_logs').insert({
            action: 'PASSWORD_CHANGE',
            entity: 'auth.users',
            entity_id: currentUser.id,
            user_id: currentUser.id,
            user_email: currentUser.email || userEmail,
            details: {
              source: 'dashboard_modal',
              timestamp: new Date().toISOString(),
              message: 'Palavra-passe alterada com sucesso pelo utilizador autenticado.',
            },
          });
        }
      } catch (auditErr) {
        // Log não-bloqueante
        console.warn('Aviso ao registar audit log de alteração de password:', auditErr);
      }

      setIsSuccess(true);
      setIsLoading(false);

      // Fecha automaticamente após 2.5 segundos de sucesso
      setTimeout(() => {
        handleClose();
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err?.message || t.passwordModal.erroGenerico);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alterar-password-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          handleClose();
        }
      }}
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden transform transition-all">
        {/* Cabeçalho do Modal */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sermail-green/10 text-sermail-green-dark border border-sermail-green/20 flex items-center justify-center shrink-0 shadow-2xs">
              <span className="material-symbols-outlined text-2xl">lock_reset</span>
            </div>
            <div>
              <h2
                id="alterar-password-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900 font-headline leading-tight"
              >
                {t.passwordModal.title}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                {t.passwordModal.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label={t.common.close}
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Conteúdo / Formulário */}
        <div className="p-5 sm:p-6">
          {/* Sucesso */}
          {isSuccess ? (
            <div className="py-6 flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center animate-bounce shadow-xs">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 font-headline">
                {t.passwordModal.sucessoTitulo}
              </h3>
              <p className="text-xs text-slate-600 max-w-xs">
                {t.passwordModal.sucessoDescricao}
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2 bg-sermail-green hover:bg-sermail-green-dark text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {t.passwordModal.btnFechar}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Alerta de Erro */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-base text-rose-600 shrink-0 mt-0.5">
                    error
                  </span>
                  <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
                </div>
              )}

              {/* Utilizador / Email informativo */}
              {userEmail && (
                <div className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs text-slate-600">
                  <span className="font-medium text-slate-500">Utilizador:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[220px]">
                    {userEmail}
                  </span>
                </div>
              )}

              {/* Campo: Nova Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="modal-new-password"
                  className="block text-xs font-bold text-slate-700"
                >
                  {t.passwordModal.novaPassword} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="modal-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t.passwordModal.placeholderNova}
                    disabled={isLoading}
                    autoComplete="new-password"
                    required
                    className="w-full px-3.5 py-2.5 pr-10 text-xs text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sermail-green focus:border-transparent transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition-colors cursor-pointer"
                    tabIndex={-1}
                    aria-label={showNewPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showNewPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>

                {/* Barra de Força da Password */}
                {newPassword.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Força da password:</span>
                      <span className="font-bold text-slate-700">{strengthLabel}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                      <div
                        className={`h-full flex-1 rounded-full transition-all ${
                          strengthScore >= 1 ? strengthColor : 'bg-transparent'
                        }`}
                      />
                      <div
                        className={`h-full flex-1 rounded-full transition-all ${
                          strengthScore >= 2 ? strengthColor : 'bg-transparent'
                        }`}
                      />
                      <div
                        className={`h-full flex-1 rounded-full transition-all ${
                          strengthScore >= 3 ? strengthColor : 'bg-transparent'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Campo: Confirmar Nova Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="modal-confirm-password"
                  className="block text-xs font-bold text-slate-700"
                >
                  {t.passwordModal.confirmarPassword} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="modal-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t.passwordModal.placeholderConfirmar}
                    disabled={isLoading}
                    autoComplete="new-password"
                    required
                    className={`w-full px-3.5 py-2.5 pr-10 text-xs text-slate-900 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-sermail-green focus:border-transparent transition-all placeholder:text-slate-400 ${
                      confirmPassword.length > 0 && !passwordsMatch
                        ? 'border-rose-400 ring-1 ring-rose-300'
                        : 'border-slate-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition-colors cursor-pointer"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showConfirmPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Lista de Requisitos de Segurança */}
              <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1.5 text-[11px]">
                <p className="font-bold text-slate-700 mb-1">Requisitos de segurança:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div
                    className={`flex items-center gap-1.5 ${
                      hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {hasMinLength ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span>{t.passwordModal.reqMinChars}</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 ${
                      hasUpperLower ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {hasUpperLower ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span>{t.passwordModal.reqCase}</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 ${
                      hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {hasNumber ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span>{t.passwordModal.reqNumber}</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 ${
                      passwordsMatch ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {passwordsMatch ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span>{t.passwordModal.reqMatch}</span>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {t.passwordModal.btnCancelar}
                </button>

                <button
                  type="submit"
                  disabled={isLoading || !isFormValid}
                  className="px-4 py-2 text-xs font-bold text-white bg-sermail-green hover:bg-sermail-green-dark border border-sermail-green disabled:bg-slate-300 disabled:border-slate-300 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>{t.passwordModal.btnAlterando}</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">check</span>
                      <span>{t.passwordModal.btnAlterar}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
