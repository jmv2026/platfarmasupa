'use client';

import { useState, useMemo } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import {
  Artigo,
  CLASSIFICACOES_DESTINO,
  Client,
  Destino,
  MOTIVOS_RECOLHA,
  NovaLinhaRecolhaInput,
  PedidoRecolhaComLinhas,
  RececaoArmazem04,
  STATUS_RECOLHA_LABELS,
  StatusPedidoRecolha,
  UserProfile,
} from '@/lib/supabase/types';
import {
  atualizarEstadoPedidoRecolhaAction,
  criarPedidoRecolhaAction,
} from './actions';

interface LogisticaInversaViewProps {
  clients: Client[];
  destinos: Destino[];
  artigos: Artigo[];
  pedidosRecolha: PedidoRecolhaComLinhas[];
  rececoesArmazem04: RececaoArmazem04[];
  currentUserProfile: UserProfile | null;
}

type LogisticaTabType = 'lancar_recolha' | 'historico_recolhas' | 'rececoes_04';
type PeriodFilterType =
  | 'todos'
  | 'hoje'
  | '7dias'
  | '30dias'
  | 'este_mes'
  | 'este_ano'
  | 'personalizado';

export default function LogisticaInversaView({
  clients,
  destinos,
  artigos,
  pedidosRecolha: initialPedidosRecolha,
  rececoesArmazem04,
  currentUserProfile,
}: LogisticaInversaViewProps) {
  const { language } = useLanguage();

  const isManagerOrAdmin =
    currentUserProfile?.role === 'admin' ||
    currentUserProfile?.role === 'gestor' ||
    currentUserProfile?.email === 'admin@sermail.pt';

  const initialClientId = useMemo(() => {
    const userClienteId = currentUserProfile?.cliente_id;
    if (!isManagerOrAdmin && userClienteId) {
      return userClienteId;
    }
    return clients[0]?.id || '';
  }, [isManagerOrAdmin, currentUserProfile, clients]);

  const [activeTab, setActiveTab] = useState<LogisticaTabType>('lancar_recolha');
  const [localPedidosRecolha, setLocalPedidosRecolha] =
    useState<PedidoRecolhaComLinhas[]>(initialPedidosRecolha);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // ============================================================================
  // ESTADOS DA ABA 1: LANÇAR PEDIDO DE RECOLHA
  // ============================================================================
  const [formClientId, setFormClientId] = useState<string>(initialClientId);
  const [selectedDestinoId, setSelectedDestinoId] = useState<string>('');
  const [inputCodigoDestino, setInputCodigoDestino] = useState<string>('');
  const [codigoNotFound, setCodigoNotFound] = useState<boolean>(false);
  const [guardarNovoDestino, setGuardarNovoDestino] = useState<boolean>(false);

  const [classificaDestino, setClassificaDestino] = useState<string>('Farmácia');
  const [nomeOrigem, setNomeOrigem] = useState<string>('');
  const [morada, setMorada] = useState<string>('');
  const [codigoPostal, setCodigoPostal] = useState<string>('');
  const [localidade, setLocalidade] = useState<string>('');
  const [pais, setPais] = useState<string>('Portugal');
  const [contactoLocal, setContactoLocal] = useState<string>('');

  const dataPedidoHoje = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [dataRecolha, setDataRecolha] = useState<string>('');
  const [motivoRecolha, setMotivoRecolha] = useState<string>('Devolução Comercial');
  const [refDocumento, setRefDocumento] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');

  // Editor de linhas do pedido de recolha
  const [artigoFormSearch, setArtigoFormSearch] = useState<string>('');
  const [selectedArtigoId, setSelectedArtigoId] = useState<string>('');
  const [loteInput, setLoteInput] = useState<string>('');
  const [validadeInput, setValidadeInput] = useState<string>('');
  const [quantidadeInput, setQuantidadeInput] = useState<number>(1);
  const [motivoLinhaInput, setMotivoLinhaInput] = useState<string>('');
  const [linhasRecolha, setLinhasRecolha] = useState<NovaLinhaRecolhaInput[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Helpers para datas padrão do Mês Atual
  const getInitialFirstDayMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const getInitialToday = () => {
    return new Date().toISOString().split('T')[0];
  };

  // ============================================================================
  // ESTADOS DA ABA 2: HISTÓRICO DE PEDIDOS DE RECOLHA
  // ============================================================================
  const [histClientId, setHistClientId] = useState<string>('todos');
  const [histStatus, setHistStatus] = useState<string>('todos');
  const [histMotivo, setHistMotivo] = useState<string>('todos');
  const [histOrigem, setHistOrigem] = useState<string>('todos');
  const [histPeriod, setHistPeriod] = useState<PeriodFilterType>('este_mes');
  const [histSearch, setHistSearch] = useState<string>('');
  const [selectedModalRecolha, setSelectedModalRecolha] =
    useState<PedidoRecolhaComLinhas | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // ============================================================================
  // ESTADOS DA ABA 3: ARTIGOS RECECIONADOS (ENTRADAS ARMAZÉM 04)
  // ============================================================================
  const [recClientId, setRecClientId] = useState<string>('todos');
  const [recArtigoSearch, setRecArtigoSearch] = useState<string>('');
  const [recArtigoSelected, setRecArtigoSelected] = useState<string>('todos');
  const [recPeriod, setRecPeriod] = useState<PeriodFilterType>('este_mes');
  const [recDateFrom, setRecDateFrom] = useState<string>(getInitialFirstDayMonth);
  const [recDateTo, setRecDateTo] = useState<string>(getInitialToday);
  const [recDocLoteSearch, setRecDocLoteSearch] = useState<string>('');

  // ============================================================================
  // HELPERS E DADOS DERIVADOS DA ABA 1 (LANÇAR PEDIDO DE RECOLHA)
  // ============================================================================
  const selectedFormClient = useMemo(
    () => clients.find((c) => c.id === formClientId) || null,
    [clients, formClientId]
  );

  const clientSigla = selectedFormClient?.sigla?.trim().toUpperCase() || '';
  const armazemInversaCodigo = clientSigla ? `${clientSigla}04` : '04';

  const clientDestinos = useMemo(
    () => destinos.filter((d) => d.cliente_id === formClientId && d.ativo),
    [destinos, formClientId]
  );

  // Artigos pertencentes ao cliente selecionado no formulário
  const clientArtigosCatalog = useMemo(() => {
    if (!selectedFormClient) return [];
    const cliPrim = String(selectedFormClient.cli_primavera || '').trim();
    const sigla = String(selectedFormClient.sigla || '').trim().toUpperCase();

    const filtered = artigos.filter((a) => {
      const aCliPrim = String(a.cli_primavera || '').trim();
      const aCliCode = String(a.artigo_cli || '').trim().toUpperCase();
      if (cliPrim && (aCliPrim === cliPrim || aCliCode.startsWith(`${cliPrim}-`))) {
        return true;
      }
      if (sigla && aCliCode.startsWith(`${sigla}-`)) {
        return true;
      }
      return false;
    });

    const source = filtered.length > 0 ? filtered : artigos;
    const map = new Map<string, Artigo>();
    for (const a of source) {
      const code = String(a.artigo_id || '').trim();
      if (code && !map.has(code)) {
        map.set(code, a);
      }
    }

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return Array.from(map.values()).sort((a, b) =>
      collator.compare(a.artigo_id, b.artigo_id)
    );
  }, [artigos, selectedFormClient]);

  const filteredFormArtigos = useMemo(() => {
    const q = artigoFormSearch.trim().toLowerCase();
    if (!q) return clientArtigosCatalog;
    return clientArtigosCatalog.filter(
      (a) =>
        a.artigo_id.toLowerCase().includes(q) ||
        (a.descricao || '').toLowerCase().includes(q)
    );
  }, [clientArtigosCatalog, artigoFormSearch]);

  const handleFormClientChange = (newClientId: string) => {
    setFormClientId(newClientId);
    setSelectedDestinoId('');
    setInputCodigoDestino('');
    setCodigoNotFound(false);
    setNomeOrigem('');
    setMorada('');
    setCodigoPostal('');
    setLocalidade('');
    setPais('Portugal');
    setContactoLocal('');
    setSelectedArtigoId('');
    setLinhasRecolha([]);
  };

  const handleSelectDestino = (destinoId: string) => {
    setSelectedDestinoId(destinoId);
    setCodigoNotFound(false);
    if (!destinoId) {
      setInputCodigoDestino('');
      setClassificaDestino('Farmácia');
      setNomeOrigem('');
      setMorada('');
      setCodigoPostal('');
      setLocalidade('');
      setPais('Portugal');
      setContactoLocal('');
      return;
    }

    const dest = clientDestinos.find((d) => d.id === destinoId);
    if (dest) {
      setInputCodigoDestino(dest.codigo);
      setClassificaDestino(dest.classifica_destino || 'Farmácia');
      setNomeOrigem(dest.nome);
      setMorada(dest.morada);
      setCodigoPostal(dest.codigo_postal);
      setLocalidade(dest.localidade);
      setPais(dest.pais || 'Portugal');
      setContactoLocal(dest.telefone || dest.email || '');
      setGuardarNovoDestino(false);
    }
  };

  const handleSearchByCodigoDestino = (rawInput: string) => {
    setInputCodigoDestino(rawInput);
    const trimmed = rawInput.trim().toUpperCase();
    if (!trimmed) {
      setCodigoNotFound(false);
      return;
    }

    const exactOrFormatted = clientDestinos.find((d) => {
      const codeUpper = d.codigo.toUpperCase();
      if (codeUpper === trimmed) return true;
      if (/^\d+$/.test(trimmed) && clientSigla) {
        const padded = `${clientSigla}-${trimmed.padStart(4, '0')}`;
        return codeUpper === padded;
      }
      return false;
    });

    if (exactOrFormatted) {
      handleSelectDestino(exactOrFormatted.id);
    } else {
      setSelectedDestinoId('');
      setCodigoNotFound(true);
    }
  };

  const handleAddLinhaRecolha = () => {
    setFeedback(null);
    if (!selectedArtigoId) {
      setFeedback({
        type: 'error',
        message: 'Selecione um artigo do catálogo para adicionar ao pedido de recolha.',
      });
      return;
    }
    if (!quantidadeInput || quantidadeInput <= 0) {
      setFeedback({
        type: 'error',
        message: 'A quantidade a recolher deve ser superior a zero.',
      });
      return;
    }

    const artObj = clientArtigosCatalog.find((a) => a.artigo_id === selectedArtigoId);
    if (!artObj) return;

    const loteNorm = loteInput.trim() || 'S/LOTE';

    setLinhasRecolha((prev) => [
      ...prev,
      {
        artigo_id: artObj.artigo_id,
        artigo_cli: artObj.artigo_cli || artObj.artigo_id,
        descricao: artObj.descricao || artObj.artigo_id,
        lote: loteNorm,
        validade: validadeInput || null,
        quantidade: Number(quantidadeInput),
        motivo_linha: motivoLinhaInput.trim() || motivoRecolha,
      },
    ]);

    setSelectedArtigoId('');
    setLoteInput('');
    setValidadeInput('');
    setQuantidadeInput(1);
    setMotivoLinhaInput('');
  };

  const handleRemoveLinhaRecolha = (index: number) => {
    setLinhasRecolha((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitPedidoRecolha = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!formClientId) {
      setFeedback({ type: 'error', message: 'Selecione o cliente proprietário.' });
      return;
    }
    if (!nomeOrigem.trim() || !morada.trim() || !codigoPostal.trim() || !localidade.trim()) {
      setFeedback({
        type: 'error',
        message: 'Preencha todos os dados obrigatórios do local de recolha (Nome, Morada, Código Postal e Localidade).',
      });
      return;
    }
    if (linhasRecolha.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Adicione pelo menos um artigo à lista de recolha antes de submeter.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await criarPedidoRecolhaAction({
        cliente_id: formClientId,
        destino_id: selectedDestinoId || null,
        guardar_novo_destino: guardarNovoDestino,
        classifica_destino: classificaDestino,
        ref_documento: refDocumento,
        motivo_recolha: motivoRecolha,
        nome_origem: nomeOrigem,
        morada,
        codigo_postal: codigoPostal,
        localidade,
        pais,
        contacto_local: contactoLocal,
        data_pedido: dataPedidoHoje,
        data_recolha: dataRecolha || undefined,
        observacoes,
        linhas: linhasRecolha,
      });

      if (!res.success) {
        setFeedback({
          type: 'error',
          message: res.error || 'Erro ao registar pedido de recolha.',
        });
      } else {
        if (res.pedido) {
          setLocalPedidosRecolha((prev) => [res.pedido!, ...prev]);
        }
        setFeedback({
          type: 'success',
          message: `Pedido de Recolha ${res.sigla_pedido || res.nr_pedido} criado com sucesso! Destino previsto de entrada: Armazém ${res.armazem_destino} (Devoluções).`,
        });
        // Limpar formulário e mudar para aba de histórico para monitorização
        setLinhasRecolha([]);
        setRefDocumento('');
        setObservacoes('');
        setDataRecolha('');
        setActiveTab('historico_recolhas');
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Ocorreu um erro inesperado ao submeter o pedido de recolha.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // HELPERS E FILTRAGEM DA ABA 2 (HISTÓRICO DE PEDIDOS DE RECOLHA)
  // ============================================================================
  const formatDate = (dStr: string | null | undefined) => {
    if (!dStr) return '-';
    try {
      const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'pt-PT';
      return new Date(dStr).toLocaleDateString(locale);
    } catch {
      return dStr;
    }
  };

  const getDatePrefix = (dStr: string | null | undefined): string => {
    if (!dStr) return '';
    const clean = String(dStr).trim();
    if (clean.length >= 10 && clean[4] === '-' && clean[7] === '-') {
      return clean.slice(0, 10);
    }
    const d = new Date(clean);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  const availableOrigensHistorico = useMemo(() => {
    const set = new Set<string>();
    localPedidosRecolha.forEach((p) => {
      if (histClientId !== 'todos' && p.cliente_id !== histClientId) return;
      const orig = (p.nome_origem || p.destinos?.nome || '').trim();
      if (orig) set.add(orig);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-PT'));
  }, [localPedidosRecolha, histClientId]);

  const filteredPedidosRecolha = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const q = histSearch.trim().toLowerCase();

    return localPedidosRecolha.filter((p) => {
      if (histClientId !== 'todos' && p.cliente_id !== histClientId) return false;
      if (histStatus !== 'todos' && p.status !== histStatus) return false;
      if (histMotivo !== 'todos' && (p.motivo_recolha || '') !== histMotivo) return false;
      if (histOrigem !== 'todos') {
        const orig = (p.nome_origem || p.destinos?.nome || '').trim();
        if (orig !== histOrigem) return false;
      }

      if (histPeriod !== 'todos') {
        const dStr = getDatePrefix(p.data_pedido);
        if (histPeriod === 'hoje' && dStr !== todayStr) return false;
        const dObj = new Date(p.data_pedido);
        const ms = dObj.getTime();
        if (histPeriod === '7dias' && ms < sevenDaysAgoMs) return false;
        if (histPeriod === '30dias' && ms < thirtyDaysAgoMs) return false;
        if (
          histPeriod === 'este_mes' &&
          (dObj.getMonth() !== now.getMonth() || dObj.getFullYear() !== now.getFullYear())
        ) {
          return false;
        }
      }

      if (q) {
        const matchNr =
          p.nr_pedido?.toLowerCase().includes(q) ||
          p.sigla_pedido?.toLowerCase().includes(q);
        const matchOrig = p.nome_origem?.toLowerCase().includes(q);
        const matchLoc = p.localidade?.toLowerCase().includes(q);
        const matchRef = p.ref_documento?.toLowerCase().includes(q);
        const matchLinha = p.pedido_recolha_linhas?.some(
          (l) =>
            l.artigo_id?.toLowerCase().includes(q) ||
            l.descricao?.toLowerCase().includes(q) ||
            l.lote?.toLowerCase().includes(q)
        );
        if (!matchNr && !matchOrig && !matchLoc && !matchRef && !matchLinha) {
          return false;
        }
      }

      return true;
    });
  }, [
    localPedidosRecolha,
    histClientId,
    histStatus,
    histMotivo,
    histOrigem,
    histPeriod,
    histSearch,
  ]);

  const kpisHistoricoRecolhas = useMemo(() => {
    let pendentes = 0;
    let concluidos = 0;
    let totalUnidades = 0;

    filteredPedidosRecolha.forEach((p) => {
      if (p.status === 'rececionado' || p.status === 'recolhido') {
        concluidos++;
      } else if (p.status !== 'cancelado') {
        pendentes++;
      }
      const qtdPed =
        p.pedido_recolha_linhas?.reduce((acc, l) => acc + Number(l.quantidade || 0), 0) || 0;
      totalUnidades += qtdPed;
    });

    return {
      totalPedidos: filteredPedidosRecolha.length,
      pendentes,
      concluidos,
      totalUnidades,
    };
  }, [filteredPedidosRecolha]);

  const handleStatusChange = async (pedidoId: string, novoStatus: string) => {
    setUpdatingStatusId(pedidoId);
    setFeedback(null);
    const res = await atualizarEstadoPedidoRecolhaAction(pedidoId, novoStatus);
    setUpdatingStatusId(null);

    if (!res.success) {
      setFeedback({
        type: 'error',
        message: res.error || 'Não foi possível atualizar o estado do pedido de recolha.',
      });
      return;
    }

    setLocalPedidosRecolha((prev) =>
      prev.map((p) => (p.id === pedidoId ? { ...p, status: novoStatus } : p))
    );
    if (selectedModalRecolha?.id === pedidoId) {
      setSelectedModalRecolha((prev) => (prev ? { ...prev, status: novoStatus } : null));
    }
    setFeedback({
      type: 'success',
      message: `Estado do pedido de recolha atualizado para "${
        STATUS_RECOLHA_LABELS[novoStatus as StatusPedidoRecolha] || novoStatus
      }".`,
    });
  };

  // ============================================================================
  // HELPERS E FILTRAGEM DA ABA 3 (ARTIGOS RECECIONADOS - ARMAZÉM 04)
  // ============================================================================
  const availableArtigosArm04 = useMemo(() => {
    const map = new Map<string, string>();
    rececoesArmazem04.forEach((r) => {
      if (recClientId !== 'todos' && r.cliente_id !== recClientId) return;
      if (r.artigo_id && !map.has(r.artigo_id)) {
        map.set(r.artigo_id, r.descricao || r.artigo_id);
      }
    });
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return Array.from(map.entries())
      .map(([codigo, descricao]) => ({ codigo, descricao }))
      .sort((a, b) => collator.compare(a.codigo, b.codigo));
  }, [rececoesArmazem04, recClientId]);

  const filteredArtigosArm04Options = useMemo(() => {
    const q = recArtigoSearch.trim().toLowerCase();
    if (!q) return availableArtigosArm04;
    return availableArtigosArm04.filter(
      (a) => a.codigo.toLowerCase().includes(q) || a.descricao.toLowerCase().includes(q)
    );
  }, [availableArtigosArm04, recArtigoSearch]);

  const handleRecPeriodChange = (period: PeriodFilterType) => {
    setRecPeriod(period);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (period === 'todos') {
      setRecDateFrom('');
      setRecDateTo('');
    } else if (period === 'hoje') {
      setRecDateFrom(todayStr);
      setRecDateTo(todayStr);
    } else if (period === '7dias') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setRecDateFrom(d.toISOString().split('T')[0]);
      setRecDateTo(todayStr);
    } else if (period === '30dias') {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setRecDateFrom(d.toISOString().split('T')[0]);
      setRecDateTo(todayStr);
    } else if (period === 'este_mes') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setRecDateFrom(firstDay.toISOString().split('T')[0]);
      setRecDateTo(todayStr);
    } else if (period === 'este_ano') {
      const firstDayYear = new Date(now.getFullYear(), 0, 1);
      setRecDateFrom(firstDayYear.toISOString().split('T')[0]);
      setRecDateTo(todayStr);
    }
  };

  const { filteredRececoes04, resumoRececoes04 } = useMemo(() => {
    const qArt = recArtigoSearch.trim().toLowerCase();
    const qDoc = recDocLoteSearch.trim().toLowerCase();
    let totalUnidades = 0;
    const artigosSet = new Set<string>();
    const docsSet = new Set<string>();

    const rows = rececoesArmazem04.filter((r) => {
      if (recClientId !== 'todos' && r.cliente_id !== recClientId) return false;

      if (recArtigoSelected !== 'todos') {
        if (r.artigo_id !== recArtigoSelected) return false;
      } else if (qArt) {
        if (
          !r.artigo_id.toLowerCase().includes(qArt) &&
          !r.descricao.toLowerCase().includes(qArt)
        ) {
          return false;
        }
      }

      const dStr = getDatePrefix(r.data_movimento);
      if (recDateFrom && (!dStr || dStr < recDateFrom)) return false;
      if (recDateTo && (!dStr || dStr > recDateTo)) return false;

      if (qDoc) {
        const matchDoc = r.documento_ref.toLowerCase().includes(qDoc);
        const matchLote = r.lote.toLowerCase().includes(qDoc);
        const matchArm = r.armazem.toLowerCase().includes(qDoc);
        if (!matchDoc && !matchLote && !matchArm) return false;
      }

      totalUnidades += r.quantidade;
      if (r.artigo_id) artigosSet.add(r.artigo_id);
      if (r.documento_ref) docsSet.add(r.documento_ref);

      return true;
    });

    return {
      filteredRececoes04: rows,
      resumoRececoes04: {
        totalUnidades,
        totalLinhas: rows.length,
        totalArtigos: artigosSet.size,
        totalDocs: docsSet.size,
      },
    };
  }, [
    rececoesArmazem04,
    recClientId,
    recArtigoSelected,
    recArtigoSearch,
    recDateFrom,
    recDateTo,
    recDocLoteSearch,
  ]);

  const handleExportRececoes04CSV = () => {
    const sanitize = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'Documento',
      'Tipo Movimento',
      'Data Rececao',
      'Cliente',
      'Armazem (04)',
      'Codigo Artigo',
      'Descricao Artigo',
      'Lote',
      'Validade',
      'Quantidade Rececionada',
    ];
    const rows = [headers.join(',')];
    filteredRececoes04.forEach((r) => {
      rows.push(
        [
          sanitize(r.documento_ref),
          sanitize(r.tipo_movimento),
          sanitize(r.data_movimento),
          sanitize(r.cliente_sigla),
          sanitize(r.armazem),
          sanitize(r.artigo_id),
          sanitize(r.descricao),
          sanitize(r.lote),
          sanitize(r.validade || ''),
          r.quantidade,
        ].join(',')
      );
    });
    const csvString = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `logistica_inversa_armazem04_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'pendente':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'agendada':
        return 'bg-sky-100 text-sky-900 border-sky-300';
      case 'em_recolha':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      case 'recolhido':
        return 'bg-teal-100 text-teal-900 border-teal-300';
      case 'rececionado':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'cancelado':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <main className="w-full px-4 sm:px-6 pt-1 pb-6 space-y-4 sm:space-y-5">
      {/* Linha Topo: Janela do Título (1/2 do comprimento) + Botões de Seleção de Aba à direita */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Banner Topo Sermail (1/2 do comprimento em ecrãs largos, 48px / h-12) */}
        <div className="w-full lg:w-1/2 bg-gradient-to-r from-sermail-green-dark via-sermail-green to-[#005a46] text-white rounded-xl px-4 sm:px-6 h-12 flex items-center shadow-sm relative overflow-hidden border border-emerald-950/30">
          <div className="relative z-10 flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center text-sermail-lime-border shrink-0 border border-white/10">
                <span className="material-symbols-outlined text-base">assignment_return</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 min-w-0">
                <h1 className="text-sm sm:text-base font-bold font-headline leading-none text-white whitespace-nowrap shrink-0">
                  Logística Inversa
                </h1>
                <p className="text-xs sm:text-sm text-lime-300/90 font-medium leading-normal truncate">
                  Pedidos de recolha, monitorização e receções no Armazém 04 (Devoluções)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Botões de Seleção de Aba à Direita da Janela do Título */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-1 min-h-12 shadow-2xs flex flex-wrap items-center gap-1.5 shrink-0 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('lancar_recolha')}
            className={`h-10 px-3.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'lancar_recolha'
                ? 'bg-sermail-green text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span
              className={`material-symbols-outlined text-base ${
                activeTab === 'lancar_recolha' ? 'text-sermail-lime-border' : 'text-slate-400'
              }`}
            >
              local_shipping
            </span>
            <span>Lançar Pedido de Recolha</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historico_recolhas')}
            className={`h-10 px-3.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'historico_recolhas'
                ? 'bg-sermail-green text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span
              className={`material-symbols-outlined text-base ${
                activeTab === 'historico_recolhas' ? 'text-sermail-lime-border' : 'text-slate-400'
              }`}
            >
              history
            </span>
            <span>Histórico de Recolhas</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                activeTab === 'historico_recolhas'
                  ? 'bg-white/15 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {localPedidosRecolha.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rececoes_04')}
            className={`h-10 px-3.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'rececoes_04'
                ? 'bg-sermail-green text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span
              className={`material-symbols-outlined text-base ${
                activeTab === 'rececoes_04' ? 'text-sermail-lime-border' : 'text-slate-400'
              }`}
            >
              warehouse
            </span>
            <span>Artigos Rececionados (Arm. 04)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                activeTab === 'rececoes_04'
                  ? 'bg-white/15 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {rececoesArmazem04.length}
            </span>
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-sm transition-all animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              {feedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-500 hover:text-slate-800"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* ====================================================================
          ABA 1: LANÇAR PEDIDO DE RECOLHA
          ==================================================================== */}
      {activeTab === 'lancar_recolha' && (
        <form onSubmit={handleSubmitPedidoRecolha} className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Coluna Esquerda: Cliente, Local de Recolha e Dados da Recolha */}
            <div className="lg:col-span-5 space-y-5">
              {/* Card 1: Identificação do Cliente e Armazém de Destino 04 */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sermail-green text-lg">
                      business
                    </span>
                    <h2 className="text-sm font-bold text-slate-900">
                      1. Cliente Proprietário & Armazém de Logística Inversa
                    </h2>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-mono font-bold text-sermail-green">
                    Armazém: {armazemInversaCodigo} (Devoluções)
                  </span>
                </div>

                {isManagerOrAdmin ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cliente Proprietário *
                    </label>
                    <select
                      value={formClientId}
                      onChange={(e) => handleFormClientChange(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green cursor-pointer"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.sigla} - {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Cliente Associado:</span>
                    <span className="text-xs font-bold text-sermail-green">
                      {selectedFormClient
                        ? `${selectedFormClient.sigla} - ${selectedFormClient.name}`
                        : currentUserProfile?.empresa || 'Cliente'}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Motivo da Recolha *
                    </label>
                    <select
                      value={motivoRecolha}
                      onChange={(e) => setMotivoRecolha(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
                    >
                      {MOTIVOS_RECOLHA.map((mot) => (
                        <option key={mot} value={mot}>
                          {mot}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Data Pretendida de Recolha
                    </label>
                    <input
                      type="date"
                      value={dataRecolha}
                      onChange={(e) => setDataRecolha(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      N.º Guia / Referência Cliente
                    </label>
                    <input
                      type="text"
                      value={refDocumento}
                      onChange={(e) => setRefDocumento(e.target.value)}
                      placeholder="Ex: GD-2026/0012"
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contacto Local / Telefone
                    </label>
                    <input
                      type="text"
                      value={contactoLocal}
                      onChange={(e) => setContactoLocal(e.target.value)}
                      placeholder="Nome ou telefone no local..."
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Local de Recolha (Origem) */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sermail-green text-lg">
                      location_on
                    </span>
                    <h2 className="text-sm font-bold text-slate-900">
                      2. Local de Recolha (Origem dos Artigos)
                    </h2>
                  </div>
                </div>

                {/* Seleção Rápida de Local / Destino Arquivado */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Código ({clientSigla}-0001)
                    </label>
                    <input
                      type="text"
                      value={inputCodigoDestino}
                      onChange={(e) => handleSearchByCodigoDestino(e.target.value)}
                      placeholder={`Ex: ${clientSigla || 'CLI'}-0001`}
                      className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                    {codigoNotFound && (
                      <span className="text-[10px] text-amber-700 font-medium">
                        Código não encontrado
                      </span>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Selecionar Local Registado ({clientDestinos.length})
                    </label>
                    <select
                      value={selectedDestinoId}
                      onChange={(e) => handleSelectDestino(e.target.value)}
                      className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
                    >
                      <option value="">-- Preenchimento Manual ou Selecionar Local --</option>
                      {clientDestinos.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.codigo} - {d.nome} ({d.localidade})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Classificação
                    </label>
                    <select
                      value={classificaDestino}
                      onChange={(e) => setClassificaDestino(e.target.value)}
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
                    >
                      {CLASSIFICACOES_DESTINO.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Entidade / Local de Recolha *
                    </label>
                    <input
                      type="text"
                      required
                      value={nomeOrigem}
                      onChange={(e) => setNomeOrigem(e.target.value)}
                      placeholder="Nome da Farmácia, Hospital ou Entidade..."
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Morada de Recolha *
                  </label>
                  <input
                    type="text"
                    required
                    value={morada}
                    onChange={(e) => setMorada(e.target.value)}
                    placeholder="Rua, Avenida, N.º, Andar..."
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Código Postal *
                    </label>
                    <input
                      type="text"
                      required
                      value={codigoPostal}
                      onChange={(e) => setCodigoPostal(e.target.value)}
                      placeholder="0000-000"
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Localidade *
                    </label>
                    <input
                      type="text"
                      required
                      value={localidade}
                      onChange={(e) => setLocalidade(e.target.value)}
                      placeholder="Localidade"
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">País</label>
                    <input
                      type="text"
                      value={pais}
                      onChange={(e) => setPais(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                  </div>
                </div>

                {!selectedDestinoId && (
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={guardarNovoDestino}
                      onChange={(e) => setGuardarNovoDestino(e.target.checked)}
                      className="rounded border-slate-300 text-sermail-green focus:ring-sermail-green"
                    />
                    <span>Guardar este endereço na lista de locais habituais do cliente</span>
                  </label>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Observações / Instruções de Recolha
                  </label>
                  <textarea
                    rows={2}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Horário de recolha, número de volumes previstos, indicações adicionais..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                  />
                </div>
              </div>
            </div>

            {/* Coluna Direita: Seleção de Artigos a Recolher e Resumo do Pedido */}
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sermail-green text-lg">
                      inventory_2
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        3. Artigos a Recolher (Logística Inversa)
                      </h2>
                      <p className="text-xs text-slate-500">
                        Selecione os artigos, lotes e quantidades que serão recolhidos e rececionados no armazém{' '}
                        <strong className="font-mono text-sermail-green">
                          {armazemInversaCodigo}
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Linha de Adição de Artigo */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 items-end">
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Filtrar Catálogo
                    </label>
                    <input
                      type="text"
                      value={artigoFormSearch}
                      onChange={(e) => setArtigoFormSearch(e.target.value)}
                      placeholder="Pesquisar código ou nome..."
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                  </div>

                  <div className="sm:col-span-8">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Selecionar Artigo ({filteredFormArtigos.length}) *
                    </label>
                    <select
                      value={selectedArtigoId}
                      onChange={(e) => setSelectedArtigoId(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
                    >
                      <option value="">-- Escolha o Artigo a Recolher --</option>
                      {filteredFormArtigos.map((a) => (
                        <option key={a.artigo_id} value={a.artigo_id}>
                          {a.artigo_id} - {a.descricao}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Lote (opcional)
                    </label>
                    <input
                      type="text"
                      value={loteInput}
                      onChange={(e) => setLoteInput(e.target.value)}
                      placeholder="Ex: LOTE123"
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Validade (opcional)
                    </label>
                    <input
                      type="date"
                      value={validadeInput}
                      onChange={(e) => setValidadeInput(e.target.value)}
                      className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Quantidade *
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={quantidadeInput}
                      onChange={(e) => setQuantidadeInput(Math.max(1, Number(e.target.value)))}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <button
                      type="button"
                      onClick={handleAddLinhaRecolha}
                      className="w-full h-9 px-4 bg-sermail-green hover:bg-sermail-green-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm text-sermail-lime-border">
                        add_circle
                      </span>
                      Adicionar Artigo
                    </button>
                  </div>
                </div>

                {/* Tabela de Linhas Adicionadas ao Pedido de Recolha */}
                {linhasRecolha.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Artigo</th>
                          <th className="py-2.5 px-3">Descrição</th>
                          <th className="py-2.5 px-3">Lote</th>
                          <th className="py-2.5 px-3">Validade</th>
                          <th className="py-2.5 px-3 text-right">Qtd a Recolher</th>
                          <th className="py-2.5 px-3 text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {linhasRecolha.map((l, idx) => (
                          <tr key={idx} className="hover:bg-emerald-50/50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {l.artigo_id}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              {l.descricao}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-secondary font-semibold">
                              {l.lote || 'S/LOTE'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {formatDate(l.validade)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-sermail-green">
                              {l.quantidade.toLocaleString('pt-PT')} un
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLinhaRecolha(idx)}
                                className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 cursor-pointer"
                                title="Remover linha"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-emerald-50/80 border-t border-emerald-200 font-bold text-xs">
                        <tr>
                          <td colSpan={4} className="py-2.5 px-3 text-right text-emerald-950">
                            Total de Unidades a Recolher ({linhasRecolha.length} linha(s)):
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-sermail-green">
                            {linhasRecolha
                              .reduce((acc, l) => acc + Number(l.quantidade || 0), 0)
                              .toLocaleString('pt-PT')}{' '}
                            un
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="py-10 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    <span className="material-symbols-outlined text-3xl mb-1 block">
                      assignment_return
                    </span>
                    <p className="text-xs font-medium">
                      Nenhum artigo adicionado ao pedido de recolha. Utilize o seletor acima para adicionar artigos.
                    </p>
                  </div>
                )}

                {/* Botão de Submissão do Pedido de Recolha */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setLinhasRecolha([])}
                    disabled={linhasRecolha.length === 0 || submitting}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    Limpar Lista
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || linhasRecolha.length === 0}
                    className="px-6 py-2.5 rounded-xl bg-sermail-green hover:bg-sermail-green-dark text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer transition-all"
                  >
                    <span className="material-symbols-outlined text-base text-sermail-lime-border">
                      send
                    </span>
                    {submitting ? 'A registar Pedido de Recolha...' : 'Submeter Pedido de Recolha'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ====================================================================
          ABA 2: HISTÓRICO E MONITORIZAÇÃO DE PEDIDOS DE RECOLHA
          ==================================================================== */}
      {activeTab === 'historico_recolhas' && (
        <div className="space-y-5">
          {/* KPIs de Monitorização dos Pedidos de Recolha */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-500">
                Total Pedidos de Recolha
              </span>
              <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">
                {kpisHistoricoRecolhas.totalPedidos}
              </div>
            </div>

            <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-amber-700">
                Em Curso / Pendentes
              </span>
              <div className="text-2xl font-extrabold font-mono text-amber-800 mt-1">
                {kpisHistoricoRecolhas.pendentes}
              </div>
            </div>

            <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-emerald-700">
                Recolhidos / Rececionados
              </span>
              <div className="text-2xl font-extrabold font-mono text-sermail-green mt-1">
                {kpisHistoricoRecolhas.concluidos}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-500">
                Total Unidades Solicitadas
              </span>
              <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">
                {kpisHistoricoRecolhas.totalUnidades.toLocaleString('pt-PT')}{' '}
                <span className="text-xs font-normal text-slate-500">un</span>
              </div>
            </div>
          </div>

          {/* Filtros do Histórico de Pedidos de Recolha */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={histSearch}
                  onChange={(e) => setHistSearch(e.target.value)}
                  placeholder="Pesquisar por N.º Recolha (REC-...), local de recolha, artigo, lote ou guia..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300/80 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                />
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('lancar_recolha')}
                className="px-4 py-2 bg-sermail-green hover:bg-sermail-green-dark text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-sm text-sermail-lime-border">
                  add
                </span>
                Novo Pedido de Recolha
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-3 border-t border-slate-100">
              {isManagerOrAdmin ? (
                <div className="lg:col-span-3">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Cliente</label>
                  <select
                    value={histClientId}
                    onChange={(e) => setHistClientId(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 cursor-pointer"
                  >
                    <option value="todos">Todos os Clientes</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.sigla} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="lg:col-span-3">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Cliente</label>
                  <div className="h-9 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-sermail-green">
                    {currentUserProfile?.empresa || 'Cliente'}
                  </div>
                </div>
              )}

              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Estado</label>
                <select
                  value={histStatus}
                  onChange={(e) => setHistStatus(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 cursor-pointer"
                >
                  <option value="todos">Todos os Estados</option>
                  {Object.entries(STATUS_RECOLHA_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Motivo</label>
                <select
                  value={histMotivo}
                  onChange={(e) => setHistMotivo(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 cursor-pointer"
                >
                  <option value="todos">Todos os Motivos</option>
                  {MOTIVOS_RECOLHA.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Local de Recolha
                </label>
                <select
                  value={histOrigem}
                  onChange={(e) => setHistOrigem(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 cursor-pointer"
                >
                  <option value="todos">
                    Todos os Locais ({availableOrigensHistorico.length})
                  </option>
                  {availableOrigensHistorico.map((orig) => (
                    <option key={orig} value={orig}>
                      {orig}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Período</label>
                <select
                  value={histPeriod}
                  onChange={(e) => setHistPeriod(e.target.value as PeriodFilterType)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 cursor-pointer"
                >
                  <option value="todos">Todo o Período</option>
                  <option value="hoje">Hoje</option>
                  <option value="7dias">Últimos 7 dias</option>
                  <option value="30dias">Últimos 30 dias</option>
                  <option value="este_mes">Este Mês</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabela de Histórico de Pedidos de Recolha */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sermail-green">history</span>
                  Histórico e Monitorização de Pedidos de Recolha
                </h2>
                <p className="text-xs text-slate-500">
                  Clique no número do pedido de recolha para consultar as linhas de artigos e detalhes da recolha
                </p>
              </div>
            </div>

            {filteredPedidosRecolha.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">N.º Recolha</th>
                      <th className="py-2.5 px-3">Data Pedido</th>
                      <th className="py-2.5 px-3">Data Recolha</th>
                      {isManagerOrAdmin && <th className="py-2.5 px-3">Cliente</th>}
                      <th className="py-2.5 px-3">Armazém Dest.</th>
                      <th className="py-2.5 px-3">Local de Recolha (Origem)</th>
                      <th className="py-2.5 px-3">Localidade</th>
                      <th className="py-2.5 px-3">Motivo</th>
                      <th className="py-2.5 px-3">Guia / Ref.</th>
                      <th className="py-2.5 px-3 text-center">Linhas</th>
                      <th className="py-2.5 px-3 text-right">Total Qtd</th>
                      <th className="py-2.5 px-3 text-center rounded-r-lg">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPedidosRecolha.map((ped) => {
                      const totalQtd =
                        ped.pedido_recolha_linhas?.reduce(
                          (acc, l) => acc + Number(l.quantidade || 0),
                          0
                        ) || 0;
                      const cliSigla =
                        ped.clientes?.sigla || ped.clients?.sigla || '';

                      return (
                        <tr key={ped.id} className="hover:bg-emerald-50/60 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-sermail-green whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedModalRecolha(ped)}
                              className="hover:underline cursor-pointer"
                            >
                              {ped.sigla_pedido || ped.nr_pedido}
                            </button>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {formatDate(ped.data_pedido)}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {ped.data_recolha ? formatDate(ped.data_recolha) : 'A agendar'}
                          </td>
                          {isManagerOrAdmin && (
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-[10px]">
                                {cliSigla || '-'}
                              </span>
                            </td>
                          )}
                          <td className="py-3 px-3 font-mono font-bold text-emerald-800">
                            {ped.armazem_destino || (cliSigla ? `${cliSigla}04` : '04')}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {ped.nome_origem}
                          </td>
                          <td className="py-3 px-3 text-slate-600">{ped.localidade}</td>
                          <td className="py-3 px-3 text-slate-700">
                            {ped.motivo_recolha || '-'}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">
                            {ped.ref_documento || '-'}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {ped.pedido_recolha_linhas?.length || 0}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-sermail-green whitespace-nowrap">
                            {totalQtd.toLocaleString('pt-PT')} un
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isManagerOrAdmin ? (
                              <select
                                disabled={updatingStatusId === ped.id}
                                value={ped.status}
                                onChange={(e) => handleStatusChange(ped.id, e.target.value)}
                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${getStatusBadgeStyle(
                                  ped.status
                                )}`}
                              >
                                {Object.entries(STATUS_RECOLHA_LABELS).map(([k, label]) => (
                                  <option key={k} value={k}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`inline-block px-2.5 py-1 rounded-lg border text-[11px] font-bold ${getStatusBadgeStyle(
                                  ped.status
                                )}`}
                              >
                                {STATUS_RECOLHA_LABELS[ped.status as StatusPedidoRecolha] ||
                                  ped.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">
                  local_shipping
                </span>
                <p className="text-sm font-medium">
                  Ainda não existem pedidos de recolha para os filtros selecionados.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          ABA 3: ARTIGOS RECECIONADOS NO ARMAZÉM 04 (DEVOLUÇÕES)
          ==================================================================== */}
      {activeTab === 'rececoes_04' && (
        <div className="space-y-5">
          {/* Painel de Filtros Alinhados da Aba Artigos Rececionados (Armazém 04) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-sermail-green">
                  <span className="material-symbols-outlined text-lg">warehouse</span>
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    Artigos Rececionados em Logística Inversa (Entradas no Armazém 04)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Todos os artigos cuja entrada de stock foi efetuada no armazém com terminação{' '}
                    <strong className="font-mono text-sermail-green">04</strong> de cada cliente
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRecArtigoSearch('');
                    setRecArtigoSelected('todos');
                    setRecPeriod('todos');
                    setRecDateFrom('');
                    setRecDateTo('');
                    setRecDocLoteSearch('');
                    if (isManagerOrAdmin) setRecClientId('todos');
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={handleExportRececoes04CSV}
                  disabled={filteredRececoes04.length === 0}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 disabled:opacity-50 font-semibold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-sermail-green">
                    download
                  </span>
                  Exportar CSV
                </button>
              </div>
            </div>

            {isManagerOrAdmin && (
              <div className="pb-3 border-b border-slate-100">
                <div className="max-w-sm">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-sermail-green">
                      business
                    </span>
                    Cliente Proprietário (Armazém [SIGLA]04)
                  </label>
                  <select
                    value={recClientId}
                    onChange={(e) => setRecClientId(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 cursor-pointer"
                  >
                    <option value="todos">Todos os Clientes (Todos os Armazéns *04)</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.sigla}04 — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Linha Principal de Filtros Alinhados */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* 1. Filtro de Artigo */}
              <div className="md:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-sermail-green">
                      inventory_2
                    </span>
                    Artigo Rececionado
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    {filteredArtigosArm04Options.length} artigo(s)
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <div className="relative sm:col-span-2">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      search
                    </span>
                    <input
                      type="text"
                      value={recArtigoSearch}
                      onChange={(e) => setRecArtigoSearch(e.target.value)}
                      placeholder="Filtrar artigo..."
                      className="w-full h-9 pl-8 pr-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <select
                      value={recArtigoSelected}
                      onChange={(e) => setRecArtigoSelected(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 cursor-pointer"
                    >
                      <option value="todos">
                        -- Todos os Artigos ({filteredArtigosArm04Options.length}) --
                      </option>
                      {filteredArtigosArm04Options.map((art) => (
                        <option key={art.codigo} value={art.codigo}>
                          {art.codigo} - {art.descricao}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Filtro de Período Temporal */}
              <div className="md:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-sermail-green">
                    calendar_month
                  </span>
                  Período Temporal de Receção
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={recPeriod}
                    onChange={(e) => handleRecPeriodChange(e.target.value as PeriodFilterType)}
                    className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 cursor-pointer"
                  >
                    <option value="todos">Todo o Histórico</option>
                    <option value="hoje">Hoje</option>
                    <option value="7dias">Últimos 7 dias</option>
                    <option value="30dias">Últimos 30 dias</option>
                    <option value="este_mes">Este Mês</option>
                    <option value="este_ano">Este Ano</option>
                    <option value="personalizado">Personalizado</option>
                  </select>

                  <div className="relative">
                    <input
                      type="date"
                      value={recDateFrom}
                      onChange={(e) => {
                        setRecDateFrom(e.target.value);
                        setRecPeriod('personalizado');
                      }}
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                    />
                    <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold uppercase text-slate-400">
                      De
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="date"
                      value={recDateTo}
                      onChange={(e) => {
                        setRecDateTo(e.target.value);
                        setRecPeriod('personalizado');
                      }}
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
                    />
                    <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold uppercase text-slate-400">
                      Até
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Pesquisa Documento / Lote */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-sermail-green">
                    tag
                  </span>
                  Doc. / Lote
                </label>
                <input
                  type="text"
                  value={recDocLoteSearch}
                  onChange={(e) => setRecDocLoteSearch(e.target.value)}
                  placeholder="Ex: SER-VGR ou Lote..."
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Janela de Resumo dos Artigos Rececionados no Armazém 04 */}
          <div className="bg-gradient-to-br from-emerald-950 via-sermail-green-dark to-[#004d3b] text-white rounded-2xl p-5 sm:p-6 shadow-md border border-emerald-800/40">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-lime-400/20 text-lime-300 border border-lime-400/30">
                  Entradas no Armazém *04 (Devoluções / Logística Inversa)
                </span>
                <h3 className="text-base sm:text-xl font-bold font-headline text-white">
                  {recArtigoSelected !== 'todos'
                    ? `Artigo ${recArtigoSelected} — ${
                        availableArtigosArm04.find((a) => a.codigo === recArtigoSelected)
                          ?.descricao || ''
                      }`
                    : 'Total Consolidado de Artigos Rececionados no Armazém 04'}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                <div className="bg-white/15 backdrop-blur-md rounded-xl px-4 py-3 border border-lime-400/40">
                  <span className="block text-[10px] uppercase tracking-wider font-bold text-lime-300">
                    Total Rececionado (Arm. 04)
                  </span>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono text-white mt-0.5">
                    {resumoRececoes04.totalUnidades.toLocaleString('pt-PT')}{' '}
                    <span className="text-xs font-normal text-lime-200">un</span>
                  </div>
                  <span className="text-[10px] text-emerald-200">
                    {resumoRececoes04.totalLinhas} registo(s) de entrada
                  </span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-xl px-4 py-3 border border-white/10">
                  <span className="block text-[10px] uppercase tracking-wider font-semibold text-emerald-200">
                    Artigos Distintos
                  </span>
                  <div className="text-lg font-bold font-mono text-white mt-0.5">
                    {resumoRececoes04.totalArtigos}
                  </div>
                  <span className="text-[10px] text-emerald-200/80">Referências com entrada</span>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-xl px-4 py-3 border border-white/10">
                  <span className="block text-[10px] uppercase tracking-wider font-semibold text-sky-200">
                    Guias / Documentos
                  </span>
                  <div className="text-lg font-bold font-mono text-white mt-0.5">
                    {resumoRececoes04.totalDocs}
                  </div>
                  <span className="text-[10px] text-emerald-200/80">Documentos de receção</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Artigos Rececionados no Armazém 04 */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sermail-green">
                    assignment_returned
                  </span>
                  Listagem de Entradas no Armazém 04
                </h2>
                <p className="text-xs text-slate-500">
                  Registos de entrada de stock (`ES` / `ET`) nos armazéns de devoluções com terminação `04`
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
                {filteredRececoes04.length} entrada(s) •{' '}
                {resumoRececoes04.totalUnidades.toLocaleString('pt-PT')} un
              </span>
            </div>

            {filteredRececoes04.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Documento</th>
                      <th className="py-2.5 px-2.5 text-center">Mov.</th>
                      <th className="py-2.5 px-3">Data Receção</th>
                      {isManagerOrAdmin && <th className="py-2.5 px-2.5">Cliente</th>}
                      <th className="py-2.5 px-3">Armazém</th>
                      <th className="py-2.5 px-3">Artigo</th>
                      <th className="py-2.5 px-3">Descrição</th>
                      <th className="py-2.5 px-3">Lote</th>
                      <th className="py-2.5 px-3">Validade</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Qtd Rececionada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRececoes04.map((r) => (
                      <tr key={r.id} className="hover:bg-emerald-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {r.documento_ref}
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-700 text-white uppercase">
                            {r.tipo_movimento}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {formatDate(r.data_movimento)}
                        </td>
                        {isManagerOrAdmin && (
                          <td className="py-2.5 px-2.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800">
                              {r.cliente_sigla || '-'}
                            </span>
                          </td>
                        )}
                        <td className="py-2.5 px-3 font-mono font-bold text-sermail-green whitespace-nowrap">
                          {r.armazem}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setRecArtigoSelected(r.artigo_id)}
                            className="hover:text-sermail-green hover:underline cursor-pointer"
                            title="Filtrar este artigo"
                          >
                            {r.artigo_id}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800 max-w-[260px] truncate" title={r.descricao}>
                          {r.descricao}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-secondary whitespace-nowrap">
                          {r.lote}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {formatDate(r.validade)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-sermail-green whitespace-nowrap">
                          {r.quantidade.toLocaleString('pt-PT')} un
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-emerald-50/90 border-t-2 border-emerald-200 font-bold text-xs">
                    <tr>
                      <td
                        colSpan={isManagerOrAdmin ? 9 : 8}
                        className="py-3 px-3 text-right uppercase tracking-wider text-[11px] text-emerald-950"
                      >
                        Total Rececionado no Armazém 04 ({filteredRececoes04.length} entradas):
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-sm text-sermail-green whitespace-nowrap">
                        {resumoRececoes04.totalUnidades.toLocaleString('pt-PT')} un
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">
                  inventory_2
                </span>
                <p className="text-sm font-medium">
                  Nenhuma entrada no Armazém 04 encontrada para os filtros selecionados.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Detalhe do Pedido de Recolha */}
      {selectedModalRecolha && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedModalRecolha(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-6 space-y-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedModalRecolha(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-full p-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 bg-sermail-green text-white rounded-lg font-mono font-bold text-xs">
                  {selectedModalRecolha.sigla_pedido || selectedModalRecolha.nr_pedido}
                </span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-mono font-bold text-xs text-sermail-green">
                  Armazém: {selectedModalRecolha.armazem_destino || '04'}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded border text-xs font-bold ${getStatusBadgeStyle(
                    selectedModalRecolha.status
                  )}`}
                >
                  {STATUS_RECOLHA_LABELS[
                    selectedModalRecolha.status as StatusPedidoRecolha
                  ] || selectedModalRecolha.status}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Data do Pedido: {formatDate(selectedModalRecolha.data_pedido)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  Local de Recolha (Origem)
                </span>
                <p className="font-bold text-slate-900 mt-0.5">
                  {selectedModalRecolha.nome_origem}
                </p>
                <p className="text-slate-600">
                  {selectedModalRecolha.morada}, {selectedModalRecolha.codigo_postal}{' '}
                  {selectedModalRecolha.localidade} ({selectedModalRecolha.pais})
                </p>
                {selectedModalRecolha.contacto_local && (
                  <p className="text-slate-500 mt-1">
                    Contacto: {selectedModalRecolha.contacto_local}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Motivo da Recolha
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedModalRecolha.motivo_recolha || '-'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Data Pretendida de Recolha / N.º Guia
                  </span>
                  <span className="font-mono text-slate-700">
                    {selectedModalRecolha.data_recolha
                      ? formatDate(selectedModalRecolha.data_recolha)
                      : 'A agendar'}{' '}
                    • Ref: {selectedModalRecolha.ref_documento || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Artigo</th>
                    <th className="py-2 px-3">Descrição</th>
                    <th className="py-2 px-3">Lote</th>
                    <th className="py-2 px-3">Validade</th>
                    <th className="py-2 px-3 text-right">Quantidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedModalRecolha.pedido_recolha_linhas || []).map((l, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-mono font-bold">{l.artigo_id}</td>
                      <td className="py-2 px-3">{l.descricao}</td>
                      <td className="py-2 px-3 font-mono text-secondary font-semibold">
                        {l.lote || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono">{formatDate(l.validade)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-sermail-green">
                        {Number(l.quantidade).toLocaleString('pt-PT')} un
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedModalRecolha.observacoes && (
              <div className="text-xs text-slate-600 bg-amber-50/60 border border-amber-200/80 rounded-xl p-3">
                <strong>Observações:</strong> {selectedModalRecolha.observacoes}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

