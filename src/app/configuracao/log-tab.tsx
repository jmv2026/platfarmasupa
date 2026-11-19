'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/context';
import { guardarConfiguracaoAction } from './actions';

export interface LogItem {
  id: string;
  user_id?: string | null;
  nome?: string | null;
  email?: string | null;
  role?: string | null;
  cliente_id?: string | null;
  cliente_sigla?: string | null;
  empresa?: string | null;
  tipo_movimento?: string | null;
  data?: string | null;
  hora?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  observacoes?: string | null;
  created_at?: string | null;
}

type DateFilterPeriod = 'todos' | 'hoje' | '7dias' | '30dias' | 'este_mes' | 'personalizado';

interface LogTabProps {
  logs: LogItem[];
  initialInactivityMinutes?: number;
}

export default function LogTab({ logs, initialInactivityMinutes = 60 }: LogTabProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'pt-PT';

  const [inactivityInput, setInactivityInput] = useState<string>(String(initialInactivityMinutes));
  const [savingInactivity, setSavingInactivity] = useState(false);
  const [inactivityFeedback, setInactivityFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [filterNome, setFilterNome] = useState<string>('todos');
  const [filterRole, setFilterRole] = useState<string>('todos');
  const [filterSigla, setFilterSigla] = useState<string>('todos');
  const [filterPeriod, setFilterPeriod] = useState<DateFilterPeriod>('todos');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<'data' | 'hora'>('data');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSortColumn = (col: 'data' | 'hora') => {
    if (sortBy === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDirection('desc');
    }
  };

  const getLogDateStr = (item: LogItem): string => {
    if (item.data) {
      const clean = String(item.data).trim();
      if (clean.length >= 10 && clean[4] === '-' && clean[7] === '-') {
        return clean.slice(0, 10);
      }
    }
    if (item.created_at) {
      const d = new Date(item.created_at);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
    return '';
  };

  const getLogHoraStr = (item: LogItem): string => {
    if (item.hora) {
      return String(item.hora).trim().slice(0, 8);
    }
    if (item.created_at) {
      const d = new Date(item.created_at);
      if (!isNaN(d.getTime())) {
        return d.toTimeString().slice(0, 8);
      }
    }
    return '';
  };

  // Opções únicas de Nome existentes nos logs
  const availableNomes = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.nome && l.nome.trim()) {
        set.add(l.nome.trim());
      }
    });
    const collator = new Intl.Collator('pt-PT', { sensitivity: 'base' });
    return Array.from(set).sort((a, b) => collator.compare(a, b));
  }, [logs]);

  // Opções únicas de Role existentes nos logs
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.role && l.role.trim()) {
        set.add(l.role.trim());
      }
    });
    return Array.from(set).sort();
  }, [logs]);

  // Opções únicas de Sigla existentes nos logs
  const availableSiglas = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.cliente_sigla && l.cliente_sigla.trim()) {
        set.add(l.cliente_sigla.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [logs]);

  const handlePeriodChange = (period: DateFilterPeriod) => {
    setFilterPeriod(period);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (period === 'todos') {
      setDateFrom('');
      setDateTo('');
    } else if (period === 'hoje') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (period === '7dias') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDateFrom(d.toISOString().split('T')[0]);
      setDateTo(todayStr);
    } else if (period === '30dias') {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setDateFrom(d.toISOString().split('T')[0]);
      setDateTo(todayStr);
    } else if (period === 'este_mes') {
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setDateFrom(firstDay);
      setDateTo(todayStr);
    }
  };

  // Filtragem e ordenação dos registos
  const filteredLogs = useMemo(() => {
    const filtered = logs.filter((item) => {
      // 1. Filtro por Nome
      if (filterNome !== 'todos') {
        if ((item.nome || '').trim().toLowerCase() !== filterNome.toLowerCase()) {
          return false;
        }
      }

      // 2. Filtro por Role
      if (filterRole !== 'todos') {
        if ((item.role || '').trim().toLowerCase() !== filterRole.toLowerCase()) {
          return false;
        }
      }

      // 3. Filtro por Sigla
      if (filterSigla !== 'todos') {
        if ((item.cliente_sigla || '').trim().toUpperCase() !== filterSigla.toUpperCase()) {
          return false;
        }
      }

      // 4. Filtro por Data (De / Até)
      const itemDate = getLogDateStr(item);
      if (dateFrom && (!itemDate || itemDate < dateFrom)) {
        return false;
      }
      if (dateTo && (!itemDate || itemDate > dateTo)) {
        return false;
      }

      return true;
    });

    const factor = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'data') {
        const da = getLogDateStr(a);
        const db = getLogDateStr(b);
        if (da !== db) return da.localeCompare(db) * factor;
        const ha = getLogHoraStr(a);
        const hb = getLogHoraStr(b);
        if (ha !== hb) return ha.localeCompare(hb) * factor;
        return (a.created_at || '').localeCompare(b.created_at || '') * factor;
      } else {
        const ha = getLogHoraStr(a);
        const hb = getLogHoraStr(b);
        if (ha !== hb) return ha.localeCompare(hb) * factor;
        const da = getLogDateStr(a);
        const db = getLogDateStr(b);
        return da.localeCompare(db) * factor;
      }
    });
  }, [logs, filterNome, filterRole, filterSigla, dateFrom, dateTo, sortBy, sortDirection]);

  // Métricas rápidas
  const metrics = useMemo(() => {
    let logins = 0;
    let logouts = 0;
    const distinctUsers = new Set<string>();

    filteredLogs.forEach((l) => {
      const tipo = (l.tipo_movimento || '').toUpperCase();
      if (tipo === 'LOGIN') logins++;
      else if (tipo === 'LOGOUT') logouts++;

      const userKey = l.user_id || l.email || l.nome;
      if (userKey) distinctUsers.add(userKey);
    });

    return {
      total: filteredLogs.length,
      logins,
      logouts,
      distinctUsers: distinctUsers.size,
    };
  }, [filteredLogs]);

  const hasActiveFilters =
    filterNome !== 'todos' ||
    filterRole !== 'todos' ||
    filterSigla !== 'todos' ||
    filterPeriod !== 'todos' ||
    dateFrom !== '' ||
    dateTo !== '';

  const handleClearFilters = () => {
    setFilterNome('todos');
    setFilterRole('todos');
    setFilterSigla('todos');
    setFilterPeriod('todos');
    setDateFrom('');
    setDateTo('');
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleExportCSV = () => {
    const sanitize = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'Data',
      'Hora',
      'Tipo Movimento',
      'Nome',
      'Email',
      'Role',
      'Sigla',
      'Empresa',
      'IP',
      'Observacoes',
    ];
    const rows = [headers.join(',')];

    filteredLogs.forEach((l) => {
      rows.push(
        [
          sanitize(getLogDateStr(l)),
          sanitize(l.hora || ''),
          sanitize(l.tipo_movimento || ''),
          sanitize(l.nome || ''),
          sanitize(l.email || ''),
          sanitize(l.role || ''),
          sanitize(l.cliente_sigla || ''),
          sanitize(l.empresa || ''),
          sanitize(l.ip_address || ''),
          sanitize(l.observacoes || l.user_agent || ''),
        ].join(',')
      );
    });

    const csv = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs_acesso_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDisplayDate = (item: LogItem) => {
    const dStr = getLogDateStr(item);
    if (!dStr) return '—';
    try {
      return new Date(`${dStr}T00:00:00`).toLocaleDateString(locale);
    } catch {
      return dStr;
    }
  };

  const formatDisplayHora = (item: LogItem) => {
    if (item.hora) {
      return String(item.hora).slice(0, 8);
    }
    if (item.created_at) {
      try {
        return new Date(item.created_at).toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      } catch {
        return '—';
      }
    }
    return '—';
  };

  const getRoleBadgeClass = (role: string | null | undefined) => {
    const r = (role || '').toLowerCase();
    if (r === 'admin') return 'bg-purple-100 text-purple-900 border-purple-200';
    if (r === 'gestor') return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    if (r === 'user1' || r === 'user2' || r === 'user3') {
      return 'bg-sky-100 text-sky-900 border-sky-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const parsedInactivityNum = Number(inactivityInput);
  const isValidInactivity =
    Number.isInteger(parsedInactivityNum) && parsedInactivityNum >= 1 && parsedInactivityNum <= 1440;
  const warningAtMinutes = isValidInactivity
    ? Math.max(parsedInactivityNum - 1, 0)
    : Math.max(initialInactivityMinutes - 1, 0);

  const handleSaveInactivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setInactivityFeedback(null);

    if (!isValidInactivity) {
      setInactivityFeedback({
        type: 'error',
        message: 'Indique um valor inteiro entre 1 e 1440 minutos.',
      });
      return;
    }

    setSavingInactivity(true);
    try {
      const res = await guardarConfiguracaoAction(
        'tempo_inatividade_minutos',
        String(parsedInactivityNum)
      );

      if (res.success) {
        try {
          localStorage.setItem('platfarma_inactivity_minutes', String(parsedInactivityNum));
          window.dispatchEvent(
            new CustomEvent('platfarma:inactivity-updated', {
              detail: { minutes: parsedInactivityNum },
            })
          );
        } catch {
          // Ignorar
        }
        setInactivityFeedback({
          type: 'success',
          message: `Tempo de inatividade atualizado para ${parsedInactivityNum} ${
            parsedInactivityNum === 1 ? 'minuto' : 'minutos'
          } (aviso aos ${Math.max(parsedInactivityNum - 1, 0)} min — 1 min antes).`,
        });
        router.refresh();
      } else {
        setInactivityFeedback({
          type: 'error',
          message: res.error || 'Erro ao guardar tempo de inatividade.',
        });
      }
    } catch (err: unknown) {
      setInactivityFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao guardar tempo de inatividade.',
      });
    } finally {
      setSavingInactivity(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Janela de Configuração: Tempo Máximo de Inatividade */}
      <form
        onSubmit={handleSaveInactivity}
        className="bg-surface-container-lowest border border-lime-400/70 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-200/90 border border-lime-400 text-slate-950 flex items-center justify-center shadow-2xs shrink-0">
              <span className="material-symbols-outlined text-xl">timer</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold font-headline text-on-surface">
                Controlo Automático de Inatividade
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Define o tempo máximo sem atividade no browser antes de encerrar a sessão e registar <strong>LOGOUT</strong> automático. O utilizador recebe um aviso <strong>1 minuto antes</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
              <label htmlFor="log-inactivity-minutes" className="text-xs font-bold text-slate-700 whitespace-nowrap">
                Tempo (min):
              </label>
              <input
                id="log-inactivity-minutes"
                type="number"
                min={1}
                max={1440}
                step={1}
                value={inactivityInput}
                onChange={(e) => setInactivityInput(e.target.value)}
                className="w-20 h-8 px-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
              />
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-lime-100/90 border border-lime-400 text-xs font-semibold text-slate-900">
              Aviso aos <strong>{warningAtMinutes} min</strong> (1 min antes)
            </div>

            <button
              type="submit"
              disabled={savingInactivity || !isValidInactivity}
              className="px-4 py-2 bg-sermail-green hover:bg-sermail-green-dark disabled:opacity-50 text-white text-xs font-bold rounded-xl border border-lime-400 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-lime-300">save</span>
              {savingInactivity ? 'A guardar...' : 'Guardar Tempo'}
            </button>
          </div>
        </div>

        {inactivityFeedback && (
          <div
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              inactivityFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {inactivityFeedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{inactivityFeedback.message}</span>
          </div>
        )}
      </form>

      {/* Cabeçalho e KPIs */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sermail-green-dark via-sermail-green to-emerald-600 text-lime-300 flex items-center justify-center shadow-xs shrink-0">
              <span className="material-symbols-outlined text-xl">history_edu</span>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-headline text-on-surface">
                Registo de Auditoria de Acessos (Log)
              </h2>
              <p className="text-xs text-on-surface-variant">
                Histórico de entradas (LOGIN) e saídas (LOGOUT) dos utilizadores da plataforma
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-lime-400 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                Limpar Filtros
              </button>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-lime-400 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className={`material-symbols-outlined text-sm text-sermail-green ${isRefreshing ? 'animate-spin' : ''}`}>
                refresh
              </span>
              Atualizar
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 border border-lime-400 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-sermail-green">download</span>
              Exportar CSV
            </button>
          </div>
        </div>

        {/* 4 Cartões de Métricas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
              Total de Registos
            </span>
            <div className="text-xl font-extrabold font-headline text-slate-900 mt-0.5">
              {metrics.total}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70">
            <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider">
              Entradas (LOGIN)
            </span>
            <div className="text-xl font-extrabold font-headline text-emerald-950 mt-0.5">
              {metrics.logins}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70">
            <span className="text-[10px] font-bold uppercase text-amber-800 tracking-wider">
              Saídas (LOGOUT)
            </span>
            <div className="text-xl font-extrabold font-headline text-amber-950 mt-0.5">
              {metrics.logouts}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-lime-50/80 border border-lime-300/70">
            <span className="text-[10px] font-bold uppercase text-lime-900 tracking-wider">
              Utilizadores Distintos
            </span>
            <div className="text-xl font-extrabold font-headline text-emerald-950 mt-0.5">
              {metrics.distinctUsers}
            </div>
          </div>
        </div>

        {/* Painel de Filtros: Nome, Role, Sigla e Data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-3 border-t border-outline-variant/20 items-end">
          {/* 1. Filtro por Nome */}
          <div className="lg:col-span-3">
            <label htmlFor="log-filter-nome" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-sermail-green">person</span>
              Nome
            </label>
            <select
              id="log-filter-nome"
              value={filterNome}
              onChange={(e) => setFilterNome(e.target.value)}
              className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
            >
              <option value="todos">Todos os Nomes ({availableNomes.length})</option>
              {availableNomes.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Filtro por Role */}
          <div className="lg:col-span-2">
            <label htmlFor="log-filter-role" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-sermail-green">badge</span>
              Role
            </label>
            <select
              id="log-filter-role"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
            >
              <option value="todos">Todas as Roles</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Filtro por Sigla */}
          <div className="lg:col-span-2">
            <label htmlFor="log-filter-sigla" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-sermail-green">business</span>
              Sigla
            </label>
            <select
              id="log-filter-sigla"
              value={filterSigla}
              onChange={(e) => setFilterSigla(e.target.value)}
              className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
            >
              <option value="todos">Todas as Siglas</option>
              {availableSiglas.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Filtro por Data (Período + De / Até) */}
          <div className="sm:col-span-2 lg:col-span-5">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-sermail-green">calendar_month</span>
              Data
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={filterPeriod}
                onChange={(e) => handlePeriodChange(e.target.value as DateFilterPeriod)}
                aria-label="Período temporal do log"
                className={`w-full h-9 px-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                  filterPeriod !== 'todos'
                    ? 'bg-lime-200/90 border border-lime-400 text-slate-950 font-bold shadow-2xs'
                    : 'bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green'
                }`}
              >
                <option value="todos">Todas as Datas</option>
                <option value="hoje">Hoje</option>
                <option value="7dias">Últimos 7 dias</option>
                <option value="30dias">Últimos 30 dias</option>
                <option value="este_mes">Este Mês</option>
                <option value="personalizado">Personalizado</option>
              </select>

              <div className="relative">
                <input
                  type="date"
                  value={dateFrom}
                  aria-label="Data inicial"
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setFilterPeriod('personalizado');
                  }}
                  className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                />
                <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold uppercase text-slate-400">
                  De
                </span>
              </div>

              <div className="relative">
                <input
                  type="date"
                  value={dateTo}
                  aria-label="Data final"
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setFilterPeriod('personalizado');
                  }}
                  className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                />
                <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold uppercase text-slate-400">
                  Até
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Registos de Log */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-6 shadow-sm">
        {filteredLogs.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar" tabIndex={0} role="region" aria-label="Tabela de Registos de Log">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th
                    className="py-2.5 px-3 rounded-l-lg"
                    aria-sort={sortBy === 'data' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => handleSortColumn('data')}
                      title="Ordenar por Data (Ascendente / Descendente)"
                      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider cursor-pointer transition-colors ${
                        sortBy === 'data' ? 'text-sermail-green-dark font-bold' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span>Data</span>
                      <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">
                        {sortBy === 'data'
                          ? sortDirection === 'asc'
                            ? 'arrow_upward'
                            : 'arrow_downward'
                          : 'unfold_more'}
                      </span>
                    </button>
                  </th>
                  <th
                    className="py-2.5 px-2.5"
                    aria-sort={sortBy === 'hora' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => handleSortColumn('hora')}
                      title="Ordenar por Hora (Ascendente / Descendente)"
                      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider cursor-pointer transition-colors ${
                        sortBy === 'hora' ? 'text-sermail-green-dark font-bold' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      <span>Hora</span>
                      <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">
                        {sortBy === 'hora'
                          ? sortDirection === 'asc'
                            ? 'arrow_upward'
                            : 'arrow_downward'
                          : 'unfold_more'}
                      </span>
                    </button>
                  </th>
                  <th className="py-2.5 px-2.5 text-center">Evento</th>
                  <th className="py-2.5 px-3">Nome / Email</th>
                  <th className="py-2.5 px-2.5">Role</th>
                  <th className="py-2.5 px-2.5">Sigla</th>
                  <th className="py-2.5 px-3">Empresa</th>
                  <th className="py-2.5 px-2.5">IP</th>
                  <th className="py-2.5 px-3 rounded-r-lg">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {filteredLogs.map((item) => {
                  const tipoUpper = (item.tipo_movimento || '').toUpperCase();
                  const isLogin = tipoUpper === 'LOGIN';
                  const isLogout = tipoUpper === 'LOGOUT';

                  return (
                    <tr key={item.id} className="hover:bg-emerald-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {formatDisplayDate(item)}
                      </td>
                      <td className="py-2.5 px-2.5 font-mono text-slate-600 whitespace-nowrap">
                        {formatDisplayHora(item)}
                      </td>
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isLogin
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : isLogout
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                            {isLogin ? 'login' : isLogout ? 'logout' : 'info'}
                          </span>
                          {tipoUpper || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{item.nome || '—'}</div>
                        {item.email && (
                          <div className="text-[11px] text-slate-500">{item.email}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        {item.role ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRoleBadgeClass(
                              item.role
                            )}`}
                          >
                            {item.role}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        {item.cliente_sigla ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-lime-100 text-lime-950 border border-lime-300">
                            {item.cliente_sigla}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 max-w-[180px] truncate" title={item.empresa || ''}>
                        {item.empresa || '—'}
                      </td>
                      <td className="py-2.5 px-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {item.ip_address || '—'}
                      </td>
                      <td
                        className="py-2.5 px-3 text-slate-600 max-w-[220px] truncate"
                        title={item.observacoes || item.user_agent || ''}
                      >
                        {item.observacoes || item.user_agent || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">
              manage_search
            </span>
            <p className="text-sm font-semibold text-slate-700">
              Nenhum registo encontrado na tabela de log
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Ajuste os filtros de nome, role, sigla ou data para consultar outros registos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
