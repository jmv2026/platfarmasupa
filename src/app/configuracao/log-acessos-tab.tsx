'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { AcessoLog } from '@/lib/supabase/types';

interface LogAcessosTabProps {
  acessosLogs: AcessoLog[];
}

export default function LogAcessosTab({ acessosLogs }: LogAcessosTabProps) {
  const { t, language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter logs based on search term (email, action, or ip)
  const filteredLogs = acessosLogs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const email = log.users?.email?.toLowerCase() || '';
    const action = log.action?.toLowerCase() || '';
    const ip = log.ip_address?.toLowerCase() || '';
    return email.includes(term) || action.includes(term) || ip.includes(term);
  });

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-base font-bold font-headline text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">manage_search</span>
            Logs de Acesso ({acessosLogs.length})
          </h3>
          <p className="text-xs text-on-surface-variant mt-1">
            {language === 'pt' ? 'Histórico de autenticações (login, logout, etc.) dos utilizadores na plataforma.' : 'Authentication history (login, logout, etc.) of users on the platform.'}
          </p>
        </div>
        
        <div className="w-full sm:w-72">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
            </div>
            <input
              type="text"
              placeholder={language === 'pt' ? "Pesquisar por email, ação ou IP..." : "Search by email, action or IP..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/40 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-outline-variant/20">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-2.5 px-3">Data / Hora</th>
              <th className="py-2.5 px-3">Utilizador</th>
              <th className="py-2.5 px-3">Ação</th>
              <th className="py-2.5 px-3 text-right">Endereço IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10 text-on-surface">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-container/30 transition-colors">
                  <td className="py-3 px-3 font-mono text-on-surface-variant">
                    {new Date(log.created_at).toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')}
                  </td>
                  <td className="py-3 px-3 font-semibold">
                    {log.users?.email || 'Desconhecido'}
                    {log.users?.full_name && (
                      <span className="block text-[10px] text-on-surface-variant font-normal">
                        {log.users.full_name}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.action === 'login'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.action === 'logout'
                          ? 'bg-rose-100 text-rose-800'
                          : log.action === 'user_signedup'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-on-surface-variant">
                    {log.ip_address || '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-on-surface-variant italic">
                  Nenhum registo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
