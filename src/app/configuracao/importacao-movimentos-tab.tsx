'use client';

import { useState, useMemo, useRef } from 'react';
import ExcelJS from 'exceljs';
import { Client, Artigo, Armazem, Movimento, TipoMovimento } from '@/lib/supabase/types';
import {
  MovimentoImportInput,
  parseTextMovimentosFile,
  generateMovimentosSampleCSV,
  normalizeMovimentoPosicao,
} from '@/lib/parse-movimentos-file';
import {
  importarMovimentosAction,
  limparMovimentosAction,
  limparImportacoesStockAction,
  limparPlatMovimentosAction, criarArtigosAPartirPlatMovimentosAction } from './actions';

export type MovimentoWithDetails = Movimento & {
  cliente_nome?: string;
  cliente_sigla?: string;
  artigo_descricao?: string;
};

interface ImportacaoMovimentosTabProps {
  initialMovimentos?: MovimentoWithDetails[];
  clients?: Client[];
  artigos?: Artigo[];
  armazens?: Armazem[];
  onRefresh?: () => void;
}

function formatDateDisplay(d: string | null | undefined): string {
  if (!d) return '-';
  const matchIso = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    return `${matchIso[3]}-${matchIso[2]}-${matchIso[1]}`;
  }
  const matchDmy = String(d).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (matchDmy) {
    const dStr = matchDmy[1].padStart(2, '0');
    const mStr = matchDmy[2].padStart(2, '0');
    const yStr = matchDmy[3].length === 2 ? '20' + matchDmy[3] : matchDmy[3];
    return `${dStr}-${mStr}-${yStr}`;
  }
  try {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch {
    // fallback
  }
  return d;
}

function formatDateTimeDisplay(d: string | null | undefined): string {
  if (!d) return '-';
  try {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    // fallback
  }
  return d;
}

export default function ImportacaoMovimentosTab({
  initialMovimentos = [],
  clients = [],
  artigos = [],
  armazens = [],
  onRefresh,
}: ImportacaoMovimentosTabProps) {
  // Sub-abas dentro da aba Movimentos

  // Estados para Importação de Movimentos
  const [clearingMovLoading, setClearingMovLoading] = useState(false);
  const [confirmClearMovModal, setConfirmClearMovModal] = useState(false);
  const [clearingPlatMovLoading, setClearingPlatMovLoading] = useState(false);
  const [confirmClearPlatMovModal, setConfirmClearPlatMovModal] = useState(false);
  const [transferringPlatMov, setTransferringPlatMov] = useState(false);
  const [confirmTransferModal, setConfirmTransferModal] = useState(false);
  const [creatingArtigosLoading, setCreatingArtigosLoading] = useState(false);
  const [selectedClientIdForArtigos, setSelectedClientIdForArtigos] = useState('');

  // Lista local de Movimentos
  const [movimentosList, setMovimentosList] = useState<MovimentoWithDetails[]>(initialMovimentos);
  const [movSearchTerm, setMovSearchTerm] = useState('');
  const [movFilterTipo, setMovFilterTipo] = useState<string>('todos');
  const [movFilterClient, setMovFilterClient] = useState<string>('todos');
  const [movFilterArmazem, setMovFilterArmazem] = useState<string>('todos');

  // Estados para imp_stk (Legado / Inventários Brutos)

  // Feedback global da aba
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);


  // Mapas rápidos para validação e display
  const artigosMap = useMemo(() => {
    const map = new Map<string, string>();
    artigos.forEach((a) => {
      map.set(a.artigo_id, a.descricao);
    });
    return map;
  }, [artigos]);

  const clientsSiglaMap = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((c) => {
      if (c.sigla) map.set(c.sigla.toUpperCase(), c);
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [clients]);

  // =========================================================================
  // 1. MANIPULAÇÃO DO FICHEIRO DE MOVIMENTOS (.xlsx, .xls, .csv, .txt)
  // =========================================================================

  // Submeter a gravação dos movimentos na tabela movimentos



  const handleTransferirPlatMov = async () => {
    setTransferringPlatMov(true);
    try {
      const { transferirPlatMovimentosParaMovimentosAction } = require('./actions');
      const res = await transferirPlatMovimentosParaMovimentosAction();
      if (res.success) {
        setFeedback({ type: 'success', message: 'Transferência concluída! ' + res.count + ' movimentos inseridos.' });
        setConfirmTransferModal(false);
        if (onRefresh) onRefresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro na transferência.' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao transferir';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setTransferringPlatMov(false);
    }
  };


    const handleCriarArtigosFromPlatMov = async () => {
    if (!selectedClientIdForArtigos) {
      setFeedback({ type: 'error', message: 'Selecione um cliente primeiro.' });
      return;
    }
    setCreatingArtigosLoading(true);
    try {
      const res = await criarArtigosAPartirPlatMovimentosAction(selectedClientIdForArtigos);
      if (res.success) {
        setFeedback({ type: 'success', message: "Foram criados/atualizados " + res.count + " artigos com sucesso!" });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao criar artigos.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar artigos';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setCreatingArtigosLoading(false);
    }
  };

  const handleClearPlatMovimentosTable = async () => {
    setClearingPlatMovLoading(true);
    try {
      const res = await limparPlatMovimentosAction();
      if (res.success) {
        setFeedback({ type: 'success', message: 'Tabela plat_movimentos limpa com sucesso.' });
        setConfirmClearPlatMovModal(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao limpar plat_movimentos.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao limpar';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setClearingPlatMovLoading(false);
    }
  };

  const handleClearMovimentosTable = async () => {
    setClearingMovLoading(true);
    try {
      const res = await limparMovimentosAction();
      if (res.success) {
        setMovimentosList([]);
        setFeedback({ type: 'success', message: 'Tabela de movimentos limpa com sucesso.' });
        setConfirmClearMovModal(false);
        if (onRefresh) onRefresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao limpar movimentos.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao limpar';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setClearingMovLoading(false);
    }
  };

  // Download do Modelo CSV de Movimentos

  // Download do Modelo Excel (.xlsx) de Movimentos

  // Exportar Movimentos Registados em CSV

  // KPIs dos Movimentos
  const totalMovimentosCount = movimentosList.length;
  const countES = useMemo(() => movimentosList.filter((m) => (m.tipo_movimento || '').toLowerCase() === 'es').reduce((acc, m) => acc + Number(m.quantidade || 0), 0), [movimentosList]);
  const countSS = useMemo(() => movimentosList.filter((m) => (m.tipo_movimento || '').toLowerCase() === 'ss').reduce((acc, m) => acc + Number(m.quantidade || 0), 0), [movimentosList]);
  const countET = useMemo(() => movimentosList.filter((m) => (m.tipo_movimento || '').toLowerCase() === 'et').reduce((acc, m) => acc + Number(m.quantidade || 0), 0), [movimentosList]);
  const countST = useMemo(() => movimentosList.filter((m) => (m.tipo_movimento || '').toLowerCase() === 'st').reduce((acc, m) => acc + Number(m.quantidade || 0), 0), [movimentosList]);
  const totalVolumeMovimentado = useMemo(
    () => movimentosList.reduce((acc, m) => acc + Number(m.quantidade || 0), 0),
    [movimentosList]
  );

  // Filtragem da Lista de Movimentos
  const filteredMovimentos = useMemo(() => {
    return movimentosList.filter((m) => {
      if (movFilterTipo !== 'todos' && m.tipo_movimento !== movFilterTipo) return false;
      if (movFilterClient !== 'todos' && m.client_id !== movFilterClient && m.sigla !== movFilterClient) return false;
      if (movFilterArmazem !== 'todos' && m.tipo_armazem !== movFilterArmazem) return false;

      if (movSearchTerm.trim()) {
        const q = movSearchTerm.toLowerCase();
        const matchArtigo = m.artigo_cli.toLowerCase().includes(q);
        const matchDesc = m.artigo_descricao?.toLowerCase().includes(q);
        const matchLote = m.lote?.toLowerCase().includes(q);
        const matchDoc = m.documento_ref?.toLowerCase().includes(q);
        const matchSigla = m.sigla?.toLowerCase().includes(q);
        const matchCliente = m.cliente_nome?.toLowerCase().includes(q);
        return Boolean(matchArtigo || matchDesc || matchLote || matchDoc || matchSigla || matchCliente);
      }

      return true;
    });
  }, [movimentosList, movFilterTipo, movFilterClient, movFilterArmazem, movSearchTerm]);

  // =========================================================================
  // 2. MANIPULAÇÃO DO FICHEIRO DE STOCKS BRUTOS (imp_stk)
  // =========================================================================




  // Renderizador de Badge por Tipo de Movimento
  const renderTipoMovBadge = (tipo: TipoMovimento | string) => {
    const t = String(tipo).toLowerCase();
    switch (t) {
      case 'es':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            ES (Entrada)
          </span>
        );
      case 'ss':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
            SS (Saída)
          </span>
        );
      case 'et':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
            ET (Entr. Transf)
          </span>
        );
      case 'st':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            ST (Saída Transf)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
            {tipo.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between gap-2.5 transition-all shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              {feedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-current hover:opacity-75 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

      )}
      {/* Removed Tabs */}

      {/* ========================================================================= */}

      {/* ========================================================================= */}
      {/* 2. SUB-ABA: TABELA DE MOVIMENTOS (REGISTOS NA BASE DE DADOS) */}
      {/* ========================================================================= */}
        <div className="space-y-6">
          {/* KPIs dos Movimentos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 shadow-sm">
              <p className="text-[11px] font-medium text-on-surface-variant">Total Movimentos</p>
              <p className="text-xl font-bold font-headline text-secondary mt-0.5">{totalMovimentosCount}</p>
            </div>

            <div className="bg-surface-container-lowest border border-emerald-200/60 rounded-xl p-4 shadow-sm">
              <p className="text-[11px] font-medium text-emerald-800">Entradas (ES)</p>
              <p className="text-xl font-bold font-headline text-emerald-700 mt-0.5">{countES.toLocaleString('pt-PT')}</p>
            </div>

            <div className="bg-surface-container-lowest border border-rose-200/60 rounded-xl p-4 shadow-sm">
              <p className="text-[11px] font-medium text-rose-800">Saídas (SS)</p>
              <p className="text-xl font-bold font-headline text-rose-700 mt-0.5">{countSS.toLocaleString('pt-PT')}</p>
            </div>

            <div className="bg-surface-container-lowest border border-cyan-200/60 rounded-xl p-4 shadow-sm">
              <p className="text-[11px] font-medium text-cyan-800">Entradas Transf. (ET)</p>
              <p className="text-xl font-bold font-headline text-cyan-700 mt-0.5">{countET.toLocaleString('pt-PT')}</p>
            </div>

            <div className="bg-surface-container-lowest border border-amber-200/60 rounded-xl p-4 shadow-sm">
              <p className="text-[11px] font-medium text-amber-800">Saídas Transf. (ST)</p>
              <p className="text-xl font-bold font-headline text-amber-700 mt-0.5">{countST.toLocaleString('pt-PT')}</p>
            </div>
          </div>

          {/* Barra de Filtros & Ações */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold font-headline text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">receipt_long</span>
                  Registos na Tabela movimentos ({filteredMovimentos.length})
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Consulta detalhada com isolamento transacional de entradas, saídas e transferências entre armazéns.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Exportar CSV */}

                                  {/* Criar Artigos */}
                  <div className="flex items-center gap-2 mr-2">
                    <select
                      value={selectedClientIdForArtigos}
                      onChange={(e) => setSelectedClientIdForArtigos(e.target.value)}
                      className="px-2 py-1.5 border border-outline/50 rounded-lg text-xs outline-hidden focus:border-primary bg-surface"
                    >
                      <option value="">Selecione o Cliente</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.sigla} - {c.name}</option>
                      ))}
                    </select>
                    
                    <button
                      type="button"
                      onClick={handleCriarArtigosFromPlatMov}
                      disabled={creatingArtigosLoading || !selectedClientIdForArtigos}
                      className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-sm">add_box</span>
                      {creatingArtigosLoading ? 'A criar...' : 'Criar Artigos'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setConfirmTransferModal(true)}
                  disabled={transferringPlatMov}
                  className="px-3 py-1.5 bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">move_down</span>
                  Transferir plat_movimentos
                </button>
                
                {/* Limpar Tabela plat_movimentos */}
                <button
                  type="button"
                  onClick={() => setConfirmClearPlatMovModal(true)}
                  disabled={clearingPlatMovLoading}
                  className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">delete_sweep</span>
                  Limpar plat-movimentos
                </button>

                {/* Limpar Tabela */}
                {movimentosList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearMovModal(true)}
                    disabled={clearingMovLoading}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">delete_sweep</span>
                    Limpar Movimentos
                  </button>
                )}
              </div>
            </div>

            {/* Linha de Controlos de Filtro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-outline-variant/10">
              {/* Pesquisa */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                  search
                </span>
                <input
                  type="text"
                  value={movSearchTerm}
                  onChange={(e) => setMovSearchTerm(e.target.value)}
                  placeholder="Pesquisar artigo, lote, doc..."
                  className="w-full pl-9 pr-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>

              {/* Filtro Tipo de Movimento */}
              <div>
                <select
                  value={movFilterTipo}
                  onChange={(e) => setMovFilterTipo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                >
                  <option value="todos">Todos os Tipos de Movimento</option>
                  <option value="es">ES - Entrada de Stock</option>
                  <option value="ss">SS - Saída de Stock</option>
                  <option value="et">ET - Entrada por Transferência</option>
                  <option value="st">ST - Saída por Transferência</option>
                </select>
              </div>

              {/* Filtro Cliente */}
              <div>
                <select
                  value={movFilterClient}
                  onChange={(e) => setMovFilterClient(e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                >
                  <option value="todos">Todos os Clientes</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.sigla} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Armazém */}
              <div>
                <select
                  value={movFilterArmazem}
                  onChange={(e) => setMovFilterArmazem(e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                >
                  <option value="todos">Todos os Armazéns</option>
                  {armazens.map((arm) => (
                    <option key={arm.tipo_armazem} value={arm.tipo_armazem}>
                      {arm.tipo_armazem} - {arm.descricao}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tabela de Dados */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-outline-variant/20 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container/80 sticky top-0 z-10 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Sigla</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Artigo</th>
                    <th className="py-2.5 px-3">Descrição</th>
                    <th className="py-2.5 px-3 text-right">Qtd</th>
                    <th className="py-2.5 px-3">Armazém</th>
                    <th className="py-2.5 px-3">Localização</th>
                    <th className="py-2.5 px-3">Posição</th>
                    <th className="py-2.5 px-3">Lote</th>
                    <th className="py-2.5 px-3">Validade</th>
                    <th className="py-2.5 px-3">Doc Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-on-surface bg-surface-container-lowest">
                  {filteredMovimentos.length > 0 ? (
                    filteredMovimentos.map((m) => (
                      <tr key={m.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-on-surface-variant">
                          {formatDateTimeDisplay(m.data_movimento)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-secondary">
                          {m.sigla || m.cliente_sigla || '-'}
                        </td>
                        <td className="py-2.5 px-3">{renderTipoMovBadge(m.tipo_movimento)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-on-surface">{m.artigo_cli}</td>
                        <td className="py-2.5 px-3 truncate max-w-[180px]" title={m.artigo_descricao || ''}>
                          {m.artigo_descricao || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-on-surface">
                          {Math.round(Number(m.quantidade || 0)).toLocaleString('pt-PT')}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                            {m.tipo_armazem}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">{m.armazem_loc || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">{m.posicao || '-'}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold">{m.lote || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-on-surface-variant">
                          {formatDateDisplay(m.validade)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] truncate max-w-[120px]" title={m.documento_ref || ''}>
                          {m.documento_ref || '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-4xl text-outline-variant mb-2 block">
                          swap_horiz
                        </span>
                        <p className="text-xs font-semibold">Nenhum movimento encontrado na tabela.</p>
                        <p className="text-[11px] text-on-surface-variant/80 mt-1">
                          Aceda à aba "Importar Ficheiro de Movimentos" para carregar novas transações.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      {/* ========================================================================= */}

      {confirmTransferModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">move_down</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-on-surface">Transferir plat_movimentos</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">Mover dados para a tabela principal.</p>
              </div>
            </div>
            <p className="text-xs text-on-surface leading-relaxed">
              Tem a certeza de que deseja executar a transferência da tabela <code>plat_movimentos</code> para a tabela <code>movimentos</code>? 
              <br/><br/>
              Apenas os movimentos novos (cujo <code>doc_linha</code> não exista) serão importados.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmTransferModal(false)}
                disabled={transferringPlatMov}
                className="px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleTransferirPlatMov}
                disabled={transferringPlatMov}
                className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">check</span>
                {transferringPlatMov ? 'A Transferir...' : 'Sim, Transferir'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {confirmClearPlatMovModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">warning</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-on-surface">Limpar Tabela plat_movimentos?</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">Esta ação não pode ser revertida.</p>
              </div>
            </div>

            <p className="text-xs text-on-surface leading-relaxed">
              Tem a certeza de que deseja eliminar permanentemente todos os registos da tabela <code>plat_movimentos</code>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearPlatMovModal(false)}
                className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container/60 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearPlatMovimentosTable}
                disabled={clearingPlatMovLoading}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">delete_forever</span>
                {clearingPlatMovLoading ? 'A eliminar...' : 'Sim, Limpar plat_movimentos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Limpeza de Movimentos */}
      {confirmClearMovModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">warning</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-on-surface">Limpar Tabela de Movimentos?</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">Esta ação não pode ser revertida.</p>
              </div>
            </div>

            <p className="text-xs text-on-surface leading-relaxed">
              Tem a certeza de que deseja eliminar permanentemente todos os <strong>{totalMovimentosCount} registos</strong> da tabela <code>movimentos</code>? O saldo de stock nas views será recalculado.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearMovModal(false)}
                className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container/60 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearMovimentosTable}
                disabled={clearingMovLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">delete_forever</span>
                {clearingMovLoading ? 'A eliminar...' : 'Sim, Limpar Movimentos'}
              </button>
            </div>
          </div>
        </div>

      )}
    </div>
  );
}