'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Language, Translations, translations } from './translations';
import { createClient } from '@/lib/supabase/client';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

export const STORAGE_KEY = 'sermail_platfarma_lang';
export const SESSION_USER_LANG_INIT_KEY = 'sermail_platfarma_lang_init_user';

export function normalizeUserIdioma(idioma?: string | null): Language | null {
  if (!idioma) return null;
  const norm = idioma.trim().toLowerCase();
  if (norm === 'pt' || norm === 'en' || norm === 'es') {
    return norm;
  }
  return null;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'pt',
  setLanguage: () => { },
  t: translations.pt,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('pt');

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch {
      // Ignorar caso falhe
    }
  }, []);

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (savedLang && (savedLang === 'pt' || savedLang === 'es' || savedLang === 'en')) {
        setLanguageState(savedLang);
        document.documentElement.lang = savedLang;
      }
    } catch {
      // Ignorar caso localStorage não esteja disponível
    }

    // Verificar o idioma configurado na tabela public.users para o utilizador autenticado ao iniciar a aplicação
    const checkUserIdiomaOnStart = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const initializedForUser = sessionStorage.getItem(SESSION_USER_LANG_INIT_KEY);
        if (initializedForUser === user.id) return;

        const { data: profile } = await supabase
          .from('users')
          .select('idioma')
          .eq('id', user.id)
          .single();

        const userLang = normalizeUserIdioma(profile?.idioma);
        if (userLang) {
          setLanguage(userLang);
        }
        sessionStorage.setItem(SESSION_USER_LANG_INIT_KEY, user.id);
      } catch {
        // Ignorar erros silenciosamente no arranque
      }
    };

    checkUserIdiomaOnStart();
  }, [setLanguage]);

  const t = useMemo(() => {
    return translations[language] || translations.pt;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage deve ser utilizado dentro de um LanguageProvider');
  }
  return context;
}

