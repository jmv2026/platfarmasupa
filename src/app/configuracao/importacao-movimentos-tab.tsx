'use client';

import { useState, useMemo, useEffect } from 'react';
import { Client, Artigo, Armazem, Movimento, TipoMovimento } from '@/lib/supabase/types';
import { createClient } from '@/lib/supabase/client';
import {
  limparMovimentosAction,
  limparPlatMovimentosAction, 
  criarArtigosAPartirPlatMovimentosAction,
  transferirPlatMovimentosParaMovimentosAction,
} from './actions';

export type MovimentoWithDetails = Movimento & {
  cliente_nome?: string;
  cliente_sigla?: string;
  artigo_descricao?: string;
  entidade_nome?: string;
  pais?: string | null;
  EntidadeEntrega?: string | null;
  NomeEntrega?: string | null;
  MoradaEntrega?: string | null;
  LocalidadeEntrega?: string | null;
  CodPostalEntrega?: string | null;
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

  // Modo de visualização: Linhas (movimentos_linhas) ou Documentos (movimentos)
  const [viewMode, setViewMode] = useState<'linhas' | 'documentos'>('linhas');

  // Estados dos Modais
  const [clearingMovLoading, setClearingMovLoading] = useState(false);
  const [confirmClearMovModal, setConfirmClearMovModal] = useState(false);
  const [clearingPlatMovLoading, setClearingPlatMovLoading] = useState(false);
  const [confirmClearPlatMovModal, setConfirmClearPlatMovModal] = useState(false);
  const [transferringPlatMov, setTransferringPlatMov] = useState(false);
  const [creatingArtigosLoading, setCreatingArtigosLoading] = useState(false);
  const [selectedClientIdForArtigos, setSelectedClientIdForArtigos] = useState('');
  
  // Modal de Detalhes do Documento (Cabeçalho de movimentos)
  const [selectedDocModal, setSelectedDocModal] = useState<string | null>(null);


  // Lista local de Movimentos (linhas com detalhe do cabeçalho)
  const [movimentosList, setMovimentosList] = useState<MovimentoWithDetails[]>(initialMovimentos || []);
  const [loadingMovimentos, setLoadingMovimentos] = useState(false);
  const [movSearchTerm, setMovSearchTerm] = useState('');
  const [movFilterTipo, setMovFilterTipo] = useState<string>('todos');
  const [movFilterClient, setMovFilterClient] = useState<string>('todos');
  const [movFilterArtigo, setMovFilterArtigo] = useState<string>('todos');
  const [movFilterArmazem, setMovFilterArmazem] = useState<string>('todos');

  useEffect(() => {
    if (initialMovimentos && initialMovimentos.length > 0) {
      setMovimentosList(initialMovimentos);
      return;
    }

    let isMounted = true;
    async function carregarMovimentos() {
      setLoadingMovimentos(true);
      try {
        const supabase = createClient();
        const { data: rpcMovs, error: rpcErr } = await supabase.rpc('get_todos_movimentos_detalhe');
        if (!isMounted) return;

        if (!rpcErr && Array.isArray(rpcMovs) && rpcMovs.length > 0) {
          setMovimentosList(rpcMovs as MovimentoWithDetails[]);
        } else {
          const { data: fallbackMovs } = await supabase
            .from('vw_movimentos_detalhe')
            .select('*')
            .order('data_movimento', { ascending: false })
            .limit(10000);
          if (isMounted && fallbackMovs) {
            setMovimentosList(fallbackMovs as MovimentoWithDetails[]);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar movimentos em background:', err);
      } finally {
        if (isMounted) {
          setLoadingMovimentos(false);
        }
      }
    }

    carregarMovimentos();

    return () => {
      isMounted = false;
    };
  }, [initialMovimentos]);


  // Cliente selecionado no filtro de clientes
  const selectedClient = useMemo(() => {
    if (!movFilterClient || movFilterClient === 'todos') return null;
    return clientsList.find((c) => c.id === movFilterClient) || null;
  }, [clientsList, movFilterClient]);

  // Feedback global da aba
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Mapas rápidos para display
  const artigosMap = useMemo(() => {
    const map = new Map<string, string>();
    artigos.forEach((a) => {
      map.set(a.artigo_id, a.descricao);
    });
    return map;
  }, [artigos]);

  // Agrupamento dos movimentos por Documento (tabela movimentos - cabeçalhos)
  const documentosList = useMemo(() => {
    const map = new Map<string, {
      documento_ref: string;
      data_movimento: string;
      sigla: string;
      cliente_nome: string;
      cliente_id?: string;
      tipo_doc: string;
      entidade?: string;
      nome?: string;
      num_contribuinte?: string;
      requisicao?: string;
      morada?: string;
      localidade?: string;
      cod_postal?: string;
      pais?: string;
      EntidadeEntrega?: string;
      NomeEntrega?: string;
      MoradaEntrega?: string;
      LocalidadeEntrega?: string;
      CodPostalEntrega?: string;
      total_merc: number;
      total_iva: number;
      total_desc: number;
      total_outros: number;
      linhasCount: number;
      quantidadeTotal: number;
      linhas: MovimentoWithDetails[];
    }>();

    movimentosList.forEach((m) => {
      const docRef = m.documento_ref || 'SEM_DOC';
      let entry = map.get(docRef);
      if (!entry) {
        entry = {
          documento_ref: docRef,
          data_movimento: m.data_movimento,
          sigla: m.sigla || m.cliente_sigla || '',
          cliente_nome: m.cliente_nome || m.sigla || '',
          cliente_id: m.cliente_id,
          tipo_doc: m.tipo_doc || (m.documento_ref ? m.documento_ref.split(' ')[0] : '-'),
          entidade: m.entidade || undefined,
          nome: m.nome || undefined,
          num_contribuinte: m.num_contribuinte || undefined,
          requisicao: m.requisicao || undefined,
          morada: m.morada || undefined,
          localidade: m.localidade || undefined,
          cod_postal: m.cod_postal || undefined,
          pais: m.pais || undefined,
          EntidadeEntrega: (m as any).EntidadeEntrega || undefined,
          NomeEntrega: (m as any).NomeEntrega || undefined,
          MoradaEntrega: (m as any).MoradaEntrega || undefined,
          LocalidadeEntrega: (m as any).LocalidadeEntrega || undefined,
          CodPostalEntrega: (m as any).CodPostalEntrega || undefined,
          total_merc: Number(m.total_merc || 0),
          total_iva: Number(m.total_iva || 0),
          total_desc: Number(m.total_desc || 0),
          total_outros: Number(m.total_outros || 0),
          linhasCount: 0,
          quantidadeTotal: 0,
          linhas: [],
        };
        map.set(docRef, entry);
      }
      entry.linhasCount += 1;
      entry.quantidadeTotal += Number(m.quantidade || 0);
      entry.linhas.push(m);
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.data_movimento).getTime() - new Date(a.data_movimento).getTime()
    );
  }, [movimentosList]);

  // Documento selecionado para a janela modal
  const docParaModal = useMemo(() => {
    if (!selectedDocModal) return null;
    return documentosList.find((d) => d.documento_ref === selectedDocModal) || null;
  }, [selectedDocModal, documentosList]);
  // Ação de transferência de plat_movimentos para movimentos (1º Passo)
  const handleTransferirPlatMov = async () => {
    setTransferringPlatMov(true);
    setFeedback(null);
    try {
      const res = await transferirPlatMovimentosParaMovimentosAction();
      if (res.success) {
        setFeedback({ 
          type: 'success', 
          message: `Transferência concluída com sucesso! Foram transferidos ${res.documentos ?? 0} documentos para a tabela movimentos e ${res.linhas ?? res.count ?? 0} linhas para a tabela movimentos_linhas.` 
        });
        // Recarregar os movimentos atualizados da base de dados sem limite de 1000 registos
        const supabase = createClient();
        const { data: rpcMovs, error: rpcErr } = await supabase.rpc('get_todos_movimentos_detalhe');
        if (!rpcErr && Array.isArray(rpcMovs) && rpcMovs.length > 0) {
          setMovimentosList(rpcMovs as MovimentoWithDetails[]);
        } else {
          const { data: fallbackMovs } = await supabase
            .from('vw_movimentos_detalhe')
            .select('*')
            .order('data_movimento', { ascending: false })
            .limit(10000);
          if (fallbackMovs && fallbackMovs.length > 0) {
            setMovimentosList(fallbackMovs as MovimentoWithDetails[]);
          }
        }
        if (onRefresh) onRefresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro na transferência para a tabela movimentos.' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao transferir para movimentos';
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
        setFeedback({ type: 'success', message: `Foram criados/atualizados ${res.count} artigos com sucesso!` });
        if (onRefresh) onRefresh();
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
      const res = await limparMovimentosAction(movFilterClient);
      if (res.success) {
        if (!movFilterClient || movFilterClient === 'todos') {
          setMovimentosList([]);
          setFeedback({
            type: 'success',
            message: `Todas as tabelas de movimentos e movimentos_linhas foram limpas com sucesso (${res.count ?? 0} cabeçalhos eliminados).`,
          });
        } else {
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
          setFeedback({
            type: 'success',
            message: `Movimentos e linhas do cliente ${clientLabel} limpos com sucesso (${res.count ?? 0} cabeçalhos eliminados).`,
          });
        }
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

  // KPIs dos Movimentos filtrados pelo cliente selecionado
  const kpiMovimentosList = useMemo(() => {
    if (!movFilterClient || movFilterClient === 'todos') {
      return movimentosList;
    }
    return movimentosList.filter(
      (m) => m.cliente_id === movFilterClient || (selectedClient?.sigla && m.sigla === selectedClient.sigla)
    );
  }, [movimentosList, movFilterClient, selectedClient]);

  const totalLinhasCount = kpiMovimentosList.length;
  const totalDocsCount = useMemo(() => {
    return new Set(kpiMovimentosList.map((m) => m.documento_ref || '')).size;
  }, [kpiMovimentosList]);

  const countES = useMemo(
    () => kpiMovimentosList.filter((m) => (m.tipo_movimento || '').toLowerCase() === 'es').reduce((acc, m) => acc + Number(m.quantidade || 0), 0),
    [kpiMovimentosList]
  );
  const countSS = useMemo(
    () => kpiMovimentosList.filter((m) => (m.tipo_movimento || '').toLowerCase() === 'ss').reduce((acc, m) => acc + Number(m.quantidade || 0), 0),
    [kpiMovimentosList]
  );
  const countET = useMemo(
    () => kpiMovimentosList.filter((m) => (m.tipo_movimento || '').toLowerCase() === 'et').reduce((acc, m) => acc + Number(m.quantidade || 0), 0),
    [kpiMovimentosList]
  );
  const countST = useMemo(
    () => kpiMovimentosList.filter((m) => (m.tipo_movimento || '').toLowerCase() === 'st').reduce((acc, m) => acc + Number(m.quantidade || 0), 0),
    [kpiMovimentosList]
  );

  // Lista de artigos únicos disponíveis para filtro
  const availableArtigos = useMemo(() => {
    const map = new Map<string, string>();
    movimentosList.forEach((m) => {
      if (movFilterClient !== 'todos' && m.cliente_id !== movFilterClient && m.sigla !== movFilterClient) {
        return;
      }
      if (m.artigo_cli) {
        map.set(m.artigo_cli, m.artigo_descricao || artigosMap.get(m.artigo_cli) || m.artigo_cli);
      }
    });

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

  // Filtragem da Lista de Linhas de Movimento
  const filteredMovimentos = useMemo(() => {
    return movimentosList.filter((m) => {
      if (movFilterTipo !== 'todos' && m.tipo_movimento !== movFilterTipo) return false;
      if (movFilterClient !== 'todos' && m.cliente_id !== movFilterClient && m.sigla !== movFilterClient) return false;
      if (movFilterArtigo !== 'todos' && m.artigo_cli !== movFilterArtigo) return false;
      if (movFilterArmazem !== 'todos' && m.tipo_armazem !== movFilterArmazem) return false;

      if (movSearchTerm.trim()) {
        const q = movSearchTerm.toLowerCase();
        const matchArtigo = m.artigo_cli?.toLowerCase().includes(q);
        const matchDesc = m.artigo_descricao?.toLowerCase().includes(q);
        const matchLote = m.lote?.toLowerCase().includes(q);
        const matchDoc = m.documento_ref?.toLowerCase().includes(q);
        const matchSigla = m.sigla?.toLowerCase().includes(q);
        const matchCliente = m.cliente_nome?.toLowerCase().includes(q);
        const matchNome = m.nome?.toLowerCase().includes(q);
        return Boolean(matchArtigo || matchDesc || matchLote || matchDoc || matchSigla || matchCliente || matchNome);
      }

      return true;
    });
  }, [movimentosList, movFilterTipo, movFilterClient, movFilterArtigo, movFilterArmazem, movSearchTerm]);

  // Filtragem da Lista de Documentos
  const filteredDocumentos = useMemo(() => {
    return documentosList.filter((doc) => {
      if (movFilterClient !== 'todos' && doc.cliente_id !== movFilterClient && doc.sigla !== movFilterClient) {
        return false;
      }
      if (movFilterTipo !== 'todos') {
        const hasTipo = doc.linhas.some((l) => (l.tipo_movimento || '').toLowerCase() === movFilterTipo.toLowerCase());
        if (!hasTipo) return false;
      }
      if (movFilterArtigo !== 'todos') {
        const hasArtigo = doc.linhas.some((l) => l.artigo_cli === movFilterArtigo);
        if (!hasArtigo) return false;
      }
      if (movFilterArmazem !== 'todos') {
        const hasArmazem = doc.linhas.some((l) => l.tipo_armazem === movFilterArmazem);
        if (!hasArmazem) return false;
      }
      if (movSearchTerm.trim()) {
        const q = movSearchTerm.toLowerCase();
        const matchDoc = doc.documento_ref.toLowerCase().includes(q);
        const matchSigla = doc.sigla.toLowerCase().includes(q);
        const matchCliente = doc.cliente_nome.toLowerCase().includes(q);
        const matchNome = doc.nome?.toLowerCase().includes(q);
        const matchEntidade = doc.entidade?.toLowerCase().includes(q);
        const matchLinhas = doc.linhas.some((l) =>
          l.artigo_cli?.toLowerCase().includes(q) ||
          (l.artigo_descricao && l.artigo_descricao.toLowerCase().includes(q)) ||
          (l.lote && l.lote.toLowerCase().includes(q))
        );
        return Boolean(matchDoc || matchSigla || matchCliente || matchNome || matchEntidade || matchLinhas);
      }
      return true;
    });
  }, [documentosList, movFilterClient, movFilterTipo, movFilterArtigo, movFilterArmazem, movSearchTerm]);

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

      {/* ========================================================================= */}
      {/* TABELA DE MOVIMENTOS E MOVIMENTOS_LINHAS */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        {/* KPIs dos Movimentos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] font-medium text-on-surface-variant truncate">Documentos (movimentos)</p>
              {selectedClient && (
                <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded shrink-0">
                  {selectedClient.sigla || selectedClient.name}
                </span>
              )}
            </div>
            <p className="text-xl font-bold font-headline text-secondary mt-0.5">
              {totalDocsCount.toLocaleString('pt-PT')}
            </p>
            <p className="text-[10px] text-on-surface-variant/80 mt-0.5">
              {totalLinhasCount.toLocaleString('pt-PT')} linhas em movimentos_linhas
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-emerald-200/60 rounded-xl p-4 shadow-sm">
            <p className="text-[11px] font-medium text-emerald-800">Entradas (ES)</p>
            <p className="text-xl font-bold font-headline text-emerald-700 mt-0.5">
              {countES.toLocaleString('pt-PT')} <span className="text-xs font-normal">unid.</span>
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-rose-200/60 rounded-xl p-4 shadow-sm">
            <p className="text-[11px] font-medium text-rose-800">Saídas (SS)</p>
            <p className="text-xl font-bold font-headline text-rose-700 mt-0.5">
              {countSS.toLocaleString('pt-PT')} <span className="text-xs font-normal">unid.</span>
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-cyan-200/60 rounded-xl p-4 shadow-sm">
            <p className="text-[11px] font-medium text-cyan-800">Entr. Transf. (ET)</p>
            <p className="text-xl font-bold font-headline text-cyan-700 mt-0.5">
              {countET.toLocaleString('pt-PT')} <span className="text-xs font-normal">unid.</span>
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-amber-200/60 rounded-xl p-4 shadow-sm">
            <p className="text-[11px] font-medium text-amber-800">Saídas Transf. (ST)</p>
            <p className="text-xl font-bold font-headline text-amber-700 mt-0.5">
              {countST.toLocaleString('pt-PT')} <span className="text-xs font-normal">unid.</span>
            </p>
          </div>
        </div>

        {/* Barra de Filtros, Seletor de Modo & Ações */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold font-headline text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">database</span>
                  Dados de Movimentos
                </h3>
                {/* Seletor de Modo: Linhas vs Documentos */}
                <div className="inline-flex rounded-xl p-1 bg-surface-container border border-outline-variant/30">
                  <button
                    type="button"
                    onClick={() => setViewMode('linhas')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      viewMode === 'linhas'
                        ? 'bg-surface-container-lowest text-secondary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">view_list</span>
                    Linhas ({filteredMovimentos.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('documentos')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      viewMode === 'documentos'
                        ? 'bg-surface-container-lowest text-secondary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">receipt_long</span>
                    Documentos ({filteredDocumentos.length})
                  </button>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                Visualização integrada entre a tabela de cabeçalho (<strong>movimentos</strong>) e as linhas de detalhe (<strong>movimentos_linhas</strong>).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Criar Artigos */}
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedClientIdForArtigos}
                  onChange={(e) => setSelectedClientIdForArtigos(e.target.value)}
                  className="px-2 py-1.5 border border-outline-variant/50 rounded-lg text-xs outline-none focus:border-primary bg-surface"
                >
                  <option value="">Selecione o Cliente</option>
                  {clientsList.map((c) => (
                    <option key={c.id} value={c.id}>{c.sigla} - {c.name}</option>
                  ))}
                </select>
                
                <button
                  type="button"
                  onClick={handleCriarArtigosFromPlatMov}
                  disabled={creatingArtigosLoading || !selectedClientIdForArtigos}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Criar artigos pendentes a partir da plat_movimentos"
                >
                  <span className="material-symbols-outlined text-sm">add_box</span>
                  {creatingArtigosLoading ? 'A criar...' : 'Criar Artigos'}
                </button>
              </div>
              {/* Botão de Transferir plat_movimentos (1º Passo: movimentos) */}
              <button
                type="button"
                onClick={handleTransferirPlatMov}
                disabled={transferringPlatMov}
                className="px-3.5 py-1.5 bg-secondary hover:bg-secondary/90 text-on-secondary text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                title="Transferir dados de plat_movimentos para a tabela movimentos (1º Passo)"
              >
                {transferringPlatMov ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>A Transferir...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">move_down</span>
                    <span>Transferir plat_movimentos</span>
                  </>
                )}
              </button>
              {/* Limpar Tabela plat_movimentos */}
              <button
                type="button"
                onClick={() => setConfirmClearPlatMovModal(true)}
                disabled={clearingPlatMovLoading}
                className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">delete_sweep</span>
                Limpar plat_movimentos
              </button>

              {/* Limpar Tabela Movimentos & Linhas */}
              {movimentosList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmClearMovModal(true)}
                  disabled={clearingMovLoading}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                  title={
                    movFilterClient === 'todos'
                      ? 'Limpar todos os movimentos e linhas registadas'
                      : `Limpar movimentos de ${selectedClient?.name || 'cliente selecionado'}`
                  }
                >
                  <span className="material-symbols-outlined text-sm">delete_forever</span>
                  Limpar Movimentos {selectedClient?.sigla ? `(${selectedClient.sigla})` : '(Todos)'}
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
                placeholder="Pesquisar doc, artigo, lote, entidade..."
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

          {/* Barra de Filtros Ativos */}
          {(movFilterTipo !== 'todos' || movFilterClient !== 'todos' || movFilterArtigo !== 'todos' || movFilterArmazem !== 'todos' || !!movSearchTerm) && (
            <div className="flex items-center justify-between text-xs text-on-surface-variant bg-surface-container/40 px-3 py-1.5 rounded-lg border border-outline-variant/20">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-secondary">filter_alt</span>
                <span>
                  Filtros ativos ({viewMode === 'linhas' ? `${filteredMovimentos.length} linhas` : `${filteredDocumentos.length} documentos`})
                </span>
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

          {/* ================================================================= */}
          {/* TABELA: MODO LINHAS (movimentos_linhas - Chave Primária: doc_linha) */}
          {/* ================================================================= */}
          {viewMode === 'linhas' && (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-outline-variant/20 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container/80 sticky top-0 z-10 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Doc Linha (PK)</th>
                    <th className="py-2.5 px-3">Doc Ref</th>
                    <th className="py-2.5 px-3 text-center">Linha</th>
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Sigla</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Artigo</th>
                    <th className="py-2.5 px-3">Descrição</th>
                    <th className="py-2.5 px-3 text-right">Qtd</th>
                    <th className="py-2.5 px-3">Armazém</th>
                    <th className="py-2.5 px-3">Posição</th>
                    <th className="py-2.5 px-3">Lote</th>
                    <th className="py-2.5 px-3">Validade</th>
                    <th className="py-2.5 px-3 text-center">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-on-surface bg-surface-container-lowest">
                  {filteredMovimentos.length > 0 ? (
                    filteredMovimentos.map((m) => (
                      <tr key={m.doc_linha || m.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary px-2 py-0.5 rounded font-mono text-[11px] font-bold" title="Chave Primária de movimentos_linhas">
                            {m.doc_linha}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedDocModal(m.documento_ref || null)}
                            className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            title="Ver cabeçalho do documento na tabela movimentos"
                          >
                            <span className="material-symbols-outlined text-[13px]">receipt</span>
                            {m.documento_ref || '-'}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-on-surface-variant text-center whitespace-nowrap">
                          {m.num_linha ?? '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
                          {formatDateTimeDisplay(m.data_movimento)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-secondary whitespace-nowrap">
                          {m.sigla || m.cliente_sigla || '-'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{renderTipoMovBadge(m.tipo_movimento)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-on-surface whitespace-nowrap">{m.artigo_cli}</td>
                        <td className="py-2.5 px-3 truncate max-w-[180px]" title={m.artigo_descricao || ''}>
                          {m.artigo_descricao || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-on-surface whitespace-nowrap">
                          {Math.round(Number(m.quantidade || 0)).toLocaleString('pt-PT')}
                        </td>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                            {m.tipo_armazem}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">{m.posicao || '-'}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">{m.lote || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
                          {formatDateDisplay(m.validade)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedDocModal(m.documento_ref || null)}
                            className="p-1 rounded-md hover:bg-surface-container text-on-surface-variant hover:text-secondary cursor-pointer"
                            title="Ver Cabeçalho do Documento em movimentos"
                          >
                            <span className="material-symbols-outlined text-sm">visibility</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-on-surface-variant">
                        {loadingMovimentos ? (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-4xl text-sermail-green animate-spin">
                              progress_activity
                            </span>
                            <p className="text-xs font-bold text-slate-700">A carregar registos de movimentos em segundo plano...</p>
                          </div>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-4xl text-outline-variant mb-2 block">
                              swap_horiz
                            </span>
                            <p className="text-xs font-semibold">Nenhuma linha de movimento encontrada.</p>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ================================================================= */}
          {/* TABELA: MODO DOCUMENTOS (movimentos - Cabeçalhos) */}
          {/* ================================================================= */}
          {viewMode === 'documentos' && (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-outline-variant/20 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container/80 sticky top-0 z-10 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Sigla / Cliente</th>
                    <th className="py-2.5 px-3">Documento Ref</th>
                    <th className="py-2.5 px-3">Tipo Doc</th>
                    <th className="py-2.5 px-3">Entidade / Destinatário</th>
                    <th className="py-2.5 px-3 text-center">Linhas</th>
                    <th className="py-2.5 px-3 text-right">Qtd Total</th>
                    <th className="py-2.5 px-3 text-right">Total Merc.</th>
                    <th className="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-on-surface bg-surface-container-lowest">
                  {filteredDocumentos.length > 0 ? (
                    filteredDocumentos.map((doc) => (
                      <tr key={doc.documento_ref} className="hover:bg-surface-container/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
                          {formatDateTimeDisplay(doc.data_movimento)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-secondary whitespace-nowrap">
                          <span title={doc.cliente_nome}>{doc.sigla}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-on-surface whitespace-nowrap">
                          {doc.documento_ref}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/10 text-secondary">
                            {doc.tipo_doc}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 truncate max-w-[200px]" title={doc.nome || doc.entidade || ''}>
                          {doc.nome || doc.entidade || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-800">
                            {doc.linhasCount} {doc.linhasCount === 1 ? 'linha' : 'linhas'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-on-surface whitespace-nowrap">
                          {Math.round(doc.quantidadeTotal).toLocaleString('pt-PT')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-on-surface-variant whitespace-nowrap">
                          {doc.total_merc > 0 ? `€ ${doc.total_merc.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedDocModal(doc.documento_ref)}
                            className="px-2.5 py-1 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-lg font-semibold text-[11px] transition-all flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">visibility</span>
                            Ver Detalhes
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-4xl text-outline-variant mb-2 block">
                          receipt_long
                        </span>
                        <p className="text-xs font-semibold">Nenhum documento encontrado na tabela movimentos.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>



      {/* ========================================================================= */}
      {/* MODAL 2: DETALHES DO DOCUMENTO (CABEÇALHO EM MOVIMENTOS & LINHAS) */}
      {/* ========================================================================= */}
      {docParaModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 animate-in fade-in duration-200">
            {/* Header do Modal */}
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">receipt_long</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-on-surface font-mono">
                      {docParaModal.documento_ref}
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/10 text-secondary">
                      {docParaModal.tipo_doc}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                      {docParaModal.sigla}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Cliente: <strong>{docParaModal.cliente_nome || docParaModal.sigla}</strong> • Data:{' '}
                    {formatDateTimeDisplay(docParaModal.data_movimento)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDocModal(null)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Secção 1: Entidade & Destinatário */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-container/30 border border-outline-variant/20 rounded-xl p-3.5 text-xs space-y-1.5">
                <p className="font-bold text-on-surface flex items-center gap-1.5 text-secondary">
                  <span className="material-symbols-outlined text-sm">person</span>
                  Entidade / Faturação
                </p>
                <p><strong>Entidade:</strong> {docParaModal.entidade || '-'}</p>
                <p><strong>Nome:</strong> {docParaModal.nome || '-'}</p>
                <p><strong>NIF:</strong> {docParaModal.num_contribuinte || '-'}</p>
                <p><strong>Requisição:</strong> {docParaModal.requisicao || '-'}</p>
                <p className="pt-1 text-[11px] text-on-surface-variant">
                  {docParaModal.morada ? `${docParaModal.morada}, ${docParaModal.cod_postal || ''} ${docParaModal.localidade || ''}` : '-'}
                </p>
              </div>

              <div className="bg-surface-container/30 border border-outline-variant/20 rounded-xl p-3.5 text-xs space-y-1.5">
                <p className="font-bold text-on-surface flex items-center gap-1.5 text-secondary">
                  <span className="material-symbols-outlined text-sm">local_shipping</span>
                  Local de Entrega
                </p>
                <p><strong>Entidade Entrega:</strong> {docParaModal.EntidadeEntrega || '-'}</p>
                <p><strong>Nome Entrega:</strong> {docParaModal.NomeEntrega || '-'}</p>
                <p><strong>Morada:</strong> {docParaModal.MoradaEntrega || '-'}</p>
                <p><strong>Localidade:</strong> {docParaModal.LocalidadeEntrega || '-'}</p>
                <p><strong>Código Postal:</strong> {docParaModal.CodPostalEntrega || '-'}</p>
              </div>
            </div>

            {/* Secção 2: Totais Financeiros */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3">
                <p className="text-[10px] text-on-surface-variant">Total Mercadoria</p>
                <p className="text-sm font-bold font-mono text-on-surface mt-0.5">
                  € {docParaModal.total_merc.toFixed(2)}
                </p>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3">
                <p className="text-[10px] text-on-surface-variant">Total IVA</p>
                <p className="text-sm font-bold font-mono text-on-surface mt-0.5">
                  € {docParaModal.total_iva.toFixed(2)}
                </p>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3">
                <p className="text-[10px] text-on-surface-variant">Descontos</p>
                <p className="text-sm font-bold font-mono text-on-surface mt-0.5">
                  € {docParaModal.total_desc.toFixed(2)}
                </p>
              </div>
              <div className="bg-surface-container-lowest border border-secondary/30 bg-secondary/5 rounded-xl p-3">
                <p className="text-[10px] text-secondary font-semibold">Volume Total</p>
                <p className="text-sm font-bold font-mono text-secondary mt-0.5">
                  {Math.round(docParaModal.quantidadeTotal).toLocaleString('pt-PT')} unid.
                </p>
              </div>
            </div>

            {/* Secção 3: Tabela com as Linhas do Documento (movimentos_linhas) */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-on-surface flex items-center justify-between">
                <span>Linhas do Documento na tabela movimentos_linhas ({docParaModal.linhas.length})</span>
                <span className="text-[11px] text-on-surface-variant font-normal">
                  Chave FK: documento_ref = "{docParaModal.documento_ref}"
                </span>
              </h5>

              <div className="overflow-x-auto max-h-[300px] overflow-y-auto border border-outline-variant/20 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container/70 sticky top-0 text-[10px] uppercase font-semibold text-on-surface-variant">
                    <tr>
                      <th className="py-2 px-3">Linha</th>
                      <th className="py-2 px-3">Tipo</th>
                      <th className="py-2 px-3">Artigo</th>
                      <th className="py-2 px-3">Descrição</th>
                      <th className="py-2 px-3 text-right">Qtd</th>
                      <th className="py-2 px-3">Armazém</th>
                      <th className="py-2 px-3">Posição</th>
                      <th className="py-2 px-3">Lote</th>
                      <th className="py-2 px-3">Validade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 bg-surface-container-lowest text-on-surface">
                    {docParaModal.linhas.map((l) => (
                      <tr key={l.id || l.doc_linha} className="hover:bg-surface-container/30">
                        <td className="py-2 px-3 font-mono text-[11px] text-on-surface-variant">
                          {l.num_linha ?? '-'}
                        </td>
                        <td className="py-2 px-3">{renderTipoMovBadge(l.tipo_movimento)}</td>
                        <td className="py-2 px-3 font-mono font-bold">{l.artigo_cli}</td>
                        <td className="py-2 px-3 truncate max-w-[200px]" title={l.artigo_descricao || ''}>
                          {l.artigo_descricao || '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {Math.round(Number(l.quantidade || 0)).toLocaleString('pt-PT')}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">{l.tipo_armazem}</td>
                        <td className="py-2 px-3 font-mono text-[11px]">{l.posicao || '-'}</td>
                        <td className="py-2 px-3 font-mono font-semibold">{l.lote || '-'}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-on-surface-variant">
                          {formatDateDisplay(l.validade)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDocModal(null)}
                className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold rounded-xl cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: LIMPAR TABELA PLAT_MOVIMENTOS */}
      {/* ========================================================================= */}
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
              Tem a certeza de que deseja eliminar permanentemente todos os registos staging da tabela <code>plat_movimentos</code>?
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

      {/* ========================================================================= */}
      {/* MODAL 4: LIMPAR TABELAS MOVIMENTOS & MOVIMENTOS_LINHAS */}
      {/* ========================================================================= */}
      {confirmClearMovModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">warning</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-on-surface">
                  Limpar Movimentos {selectedClient?.sigla || selectedClient?.name || '(Todos os Clientes)'}?
                </h4>
                <p className="text-xs text-on-surface-variant mt-0.5">Eliminação permanente de dados relacionais.</p>
              </div>
            </div>

            <p className="text-xs text-on-surface leading-relaxed">
              {selectedClient ? (
                <>
                  Tem a certeza de que deseja eliminar os movimentos do cliente{' '}
                  <strong>{selectedClient.name}</strong> (<code className="font-mono text-primary font-bold">{selectedClient.sigla}</code>)?
                </>
              ) : (
                <>
                  Tem a certeza de que deseja eliminar <strong>TODOS</strong> os movimentos registados no sistema?
                </>
              )}
              <br /><br />
              <span className="text-on-surface-variant text-[11px] block">
                Esta ação elimina os registos da tabela <code>movimentos</code> e remove em cascata todas as linhas associadas na tabela <code>movimentos_linhas</code>. O saldo de stock nas views será recalculado.
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
                {clearingMovLoading ? 'A eliminar...' : 'Sim, Limpar Movimentos e Linhas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}