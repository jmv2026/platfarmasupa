'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/context';

export default function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { t } = useLanguage();
  const supabase = createClient();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-error bg-surface-container hover:bg-error-container/50 border border-lime-400/60 hover:border-lime-500 rounded-lg transition-colors cursor-pointer"
      title={t.nav.terminarSessao}
    >
      <span className="material-symbols-outlined text-base">logout</span>
      <span className="hidden sm:inline">{t.nav.terminarSessao}</span>
    </button>
  );
}

