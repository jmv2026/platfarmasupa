'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { Client, Artigo, Armazem, Movimento, TipoMovimento } from '@/lib/supabase/types';
import { createClient } from '@/lib/supabase/client';
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
  limparPlatMovimentosAction, 
  criarArtigosAPartirPlatMovimentosAction,
  transferirPlatMovimentosParaMovimentosAction,
} from './actions';

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
  const [clientsList, setClientsList] = useState<Client[]>(clients);

  useEffect(() => {
    if (clients && clients.length > 0) {
      setClientsList(clients);
    } else {
      const supabase = createClient();
      supabase
        .from('clientes')
        .select('*')
        .order('name')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setClientsList(data as Client[]);
          }
        });
    }
  }, [clients]);
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
  const [movFilterArtigo, setMovFilterArtigo] = useState<string>('todos');
  const [movFilterArmazem, setMovFilterArmazem] = useState<string>('todos');

  useEffect(() => {
    setMovimentosList(initialMovimentos);
  }, [initialMovimentos]);

  // Cliente selecionado no filtro de clientes
  const selectedClient = useMemo(() => {
    if (!movFilterClient || movFilterClient === 'todos') return null;
    return clientsList.find((c) => c.id === movFilterClient) || null;
  }, [clientsList, movFilterClient]);

  const selectedClientMovimentosCount = useMemo(() => {
    if (!selectedClient) return 0;
    return movimentosList.filter(
      (m) => m.cliente_id === selectedClient.id || (selectedClient.sigla && m.sigla === selectedClient.sigla)
    ).length;
  }, [movimentosList, selectedClient]);

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
    clientsList.forEach((c) => {
      if (c.sigla) map.set(c.sigla.toUpperCase(), c);
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [clientsList]);

  // =========================================================================
  // 1. MANIPULAÇÃO DO FICHEIRO DE MOVIMENTOS (.xlsx, .xls, .csv, .txt)
  // =========================================================================

  // Submeter a gravação dos movimentos na tabela movimentos



  const handleTransferirPlatMov = async () => {
    setTransferringPlatMov(true);
    try {
      const res = await transferirPlatMovimentosParaMovimentosAction();
      setConfirmTransferModal(false);
      if (res.success) {
        setFeedback({ type: 'success', message: 'Transferência concluída! ' + res.count + ' movimentos inseridos.' });
        if (onRefresh) onRefresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro na transferência.' });
      }
    } catch (err) {
      setConfirmTransferModal(false);
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
    if (!movFilterClient || movFilterClient === 'todos') {
      setFeedback({
        type: 'error',
        message: 'Por favor, selecione um cliente no filtro "Cliente" antes de limpar os movimentos.',
      });
      setConfirmClearMovModal(false);
      return;
    }

    setClearingMovLoading(true);
    try {
      const res = await limparMovimentosAction(movFilterClient);
      if (res.success) {
        setMovimentosList((prev) =>
          prev.filter(
            (m) =>
              m.cliente_id !== movFilterClient &&
              (!selectedClient?.sigla || m.sigla !== selectedClient.sigla)
          )
        );
        const clientLabel = selectedClient?.name
          ? `${selectedClient.name}${selectedClient.sigla ? ` (${selectedClient.sigla})` : ''}`
          : 'cliente selecionado';
        const countMsg = res.count !== undefined ? ` (${res.count} movimentos eliminados)` : '';
        setFeedback({
          type: 'success',
          message: `Movimentos do cliente ${clientLabel} limpos com sucesso.${countMsg}`,
        });
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

  // KPIs dos Movimentos filtrados pelo cliente selecionado
  const kpiMovimentosList = useMemo(() => {
    if (!movFilterClient || movFilterClient === 'todos') {
      return movimentosList;
    }
    return movimentosList.filter(
      (m) => m.cliente_id === movFilterClient || (selectedClient?.sigla && m.sigla === selectedClient.sigla)
    );
  }, [movimentosList, movFilterClient, selectedClient]);

  const totalMovimentosCount = kpiMovimentosList.length;
  const countES = useMemo(() => kpiMovimentosList.filter((m) => (m.tipo_movimento || '').toLowerCase() === 'es').reduce((acc, m) => acc + Number(m.quantidade || 0), 0), [kpiMovimentosList]);
  const countSS = useMemo(() => kpiMovimentosList.filter((m) => (m.tipo_movimento || '').toLowerCase() === 'ss').reduce((acc, m) => acc + Number(m.quantidade || 0), 0), [kpiMovimentosList]);
  const countET = useMemo(() => kpiMovimentosList.filter((m) => (m.tipo_movimento || '').toLowerCase() === 'et').reduce((acc, m) => acc + Number(m.quantidade || 0), 0), [kpiMovimentosList]);
  const countST = useMemo(() => kpiMovimentosList.filter((m) => (m.tipo_movimento || '').toLowerCase() === 'st').reduce((acc, m) => acc + Number(m.quantidade || 0), 0), [kpiMovimentosList]);
  const totalVolumeMovimentado = useMemo(
    () => kpiMovimentosList.reduce((acc, m) => acc + Number(m.quantidade || 0), 0),
    [kpiMovimentosList]
  );

  // Lista de artigos únicos disponíveis para filtro
  const availableArtigos = useMemo(() => {
    const map = new Map<string, string>();
    // 1. Extrair artigos dos movimentos existentes (respeitando cliente se selecionado)
    movimentosList.forEach((m) => {
      if (movFilterClient !== 'todos' && m.cliente_id !== movFilterClient && m.sigla !== movFilterClient) {
        return;
      }
      if (m.artigo_cli) {
        map.set(m.artigo_cli, m.artigo_descricao || artigosMap.get(m.artigo_cli) || m.artigo_cli);
      }
    });

    // 2. Se nenhum cliente selecionado, complementar com catálogo de artigos
    if (movFilterClient === 'todos') {
      artigos.forEach((a) => {
        if (a.artigo_id && !map.has(a.artigo_id)) {
          map.set(a.artigo_id, a.descricao || a.artigo_id);
        }
      });
    }

    return Array.from(map.entries())
      .map(([codigo, descricao]) => ({ codigo, descricao }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [movimentosList, movFilterClient, artigos, artigosMap]);

  // Filtragem da Lista de Movimentos
  const filteredMovimentos = useMemo(() => {
    return movimentosList.filter((m) => {
      if (movFilterTipo !== 'todos' && m.tipo_movimento !== movFilterTipo) return false;
      if (movFilterClient !== 'todos' && m.cliente_id !== movFilterClient && m.sigla !== movFilterClient) return false;
      if (movFilterArtigo !== 'todos' && m.artigo_cli !== movFilterArtigo) return false;
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
  }, [movimentosList, movFilterTipo, movFilterClient, movFilterArtigo, movFilterArmazem, movSearchTerm]);

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
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-medium text-on-surface-variant truncate">Total Movimentos</p>
                {selectedClient && (
                  <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded shrink-0">
                    {selectedClient.sigla || selectedClient.name}
                  </span>
                )}
              </div>
              <p className="text-xl font-bold font-headline text-secondary mt-0.5">{totalMovimentosCount.toLocaleString('pt-PT')}</p>
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
                      {clientsList.map(c => (
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
                    onClick={() => {
                      if (!movFilterClient || movFilterClient === 'todos') {
                        setFeedback({
                          type: 'error',
                          message: 'Por favor, selecione um cliente no filtro "Cliente" para limpar os respetivos movimentos.',
                        });
                        return;
                      }
                      setConfirmClearMovModal(true);
                    }}
                    disabled={clearingMovLoading}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                      movFilterClient === 'todos'
                        ? 'bg-rose-50/60 hover:bg-rose-50 text-rose-500 border border-rose-200/60'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-xs'
                    }`}
                    title={
                      movFilterClient === 'todos'
                        ? 'Selecione um cliente no filtro "Cliente" para limpar os movimentos'
                        : `Limpar movimentos de ${selectedClient?.name || 'cliente selecionado'}`
                    }
                  >
                    <span className="material-symbols-outlined text-sm">delete_sweep</span>
                    Limpar Movimentos {selectedClient?.sigla ? `(${selectedClient.sigla})` : ''}
                  </button>
                )}
              </div>
            </div>

            {/* Linha de Controlos de Filtro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-outline-variant/10">
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
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.sigla} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Artigo */}
              <div>
                <select
                  value={movFilterArtigo}
                  onChange={(e) => setMovFilterArtigo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                >
                  <option value="todos">Todos os Artigos ({availableArtigos.length})</option>
                  {availableArtigos.map((art) => (
                    <option key={art.codigo} value={art.codigo}>
                      {art.codigo} - {art.descricao}
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

            {/* Barra de Filtros Ativos / Botão de Limpar */}
            {(movFilterTipo !== 'todos' || movFilterClient !== 'todos' || movFilterArtigo !== 'todos' || movFilterArmazem !== 'todos' || !!movSearchTerm) && (
              <div className="flex items-center justify-between text-xs text-on-surface-variant bg-surface-container/40 px-3 py-1.5 rounded-lg border border-outline-variant/20">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-secondary">filter_alt</span>
                  <span>Filtros ativos ({filteredMovimentos.length} registos encontrados)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMovFilterTipo('todos');
                    setMovFilterClient('todos');
                    setMovFilterArtigo('todos');
                    setMovFilterArmazem('todos');
                    setMovSearchTerm('');
                  }}
                  className="font-semibold text-secondary hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                  Limpar filtros
                </button>
              </div>
            )}

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
                <h4 className="text-sm font-bold text-on-surface">
                  Limpar Movimentos de {selectedClient?.sigla || selectedClient?.name || 'Cliente'}?
                </h4>
                <p className="text-xs text-on-surface-variant mt-0.5">Esta ação não pode ser revertida.</p>
              </div>
            </div>

            <p className="text-xs text-on-surface leading-relaxed">
              Tem a certeza de que deseja eliminar permanentemente os movimentos do cliente{' '}
              <strong>{selectedClient?.name || 'selecionado'}</strong>
              {selectedClient?.sigla && (
                <> (<code className="font-mono text-primary font-bold">{selectedClient.sigla}</code>)</>
              )}{' '}
              da tabela <code>movimentos</code>?
              {selectedClientMovimentosCount > 0 && (
                <> Foram encontrados <strong>{selectedClientMovimentosCount} registos</strong> deste cliente na lista atual.</>
              )}
              <br />
              <span className="text-on-surface-variant text-[11px] mt-1 block">
                O saldo de stock nas views será recalculado após esta eliminação.
              </span>
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
                {clearingMovLoading ? 'A eliminar...' : `Sim, Limpar Movimentos (${selectedClient?.sigla || 'Cliente'})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}