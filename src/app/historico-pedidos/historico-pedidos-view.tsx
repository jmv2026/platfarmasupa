'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PedidoComLinhas,
  Client,
  STATUS_PEDIDO_LABELS,
  StatusPedido,
  UserProfile,
} from '@/lib/supabase/types';
import { useLanguage } from '@/lib/i18n/context';
import { createClient } from '@/lib/supabase/client';
import { apagarMovimentoAction } from './actions';

export interface HistoricoFaturaItem {
  documento_ref: string;
  data?: string | null;
  entidade?: string | null;
  tipo_doc?: string | null;
  num_doc?: string | null;
  documento?: string | null;
  requisicao?: string | null;
  num_contribuinte?: string | null;
  total_iva?: number | string | null;
  total_merc?: number | string | null;
  total_outros?: number | string | null;
  total_desc?: number | string | null;
  nome?: string | null;
  morada?: string | null;
  localidade?: string | null;
  cod_postal?: string | null;
  cod_postal_localidade?: string | null;
  pais?: string | null;
  nome_entrega?: string | null;
  morada_entrega?: string | null;
  cod_postal_localidade_entrega?: string | null;
  cod_postal_entrega?: string | null;
  localidade_entrega?: string | null;
  entidade_entrega?: string | null;
  cli_primavera?: string | null;
  sigla?: string | null;
  cliente_ser?: string | null;
  cliente_id?: string | null;
  cliente_sigla?: string | null;
  cliente_nome?: string | null;
}

interface HistoricoPedidosViewProps {
  pedidos: PedidoComLinhas[];
  faturas?: HistoricoFaturaItem[];
  clients: Client[];
  currentUserProfile: UserProfile | null;
}

type DateFilterType = 'todos' | 'hoje' | '7dias' | '30dias' | 'este_mes' | 'este_ano' | 'personalizado';
type ViewModeType = 'detalhado' | 'tabela';
type HistoricoTabType = 'movimentos' | 'por_artigo' | 'faturacao';


export default function HistoricoPedidosView({
  pedidos,
  faturas = [],
  clients,
  currentUserProfile,
}: HistoricoPedidosViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const { t, language } = useLanguage();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Estados para eliminação de movimento (Apenas Admin / Gestor)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [pedidoToDelete, setPedidoToDelete] = useState<PedidoComLinhas | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const activePedidos = useMemo(() => {
    if (deletedIds.size === 0) return pedidos;
    return pedidos.filter((p) => !deletedIds.has(p.id));
  }, [pedidos, deletedIds]);

  // Estado e cache para o visualizador do comprovativo
  const [comprovativoImage, setComprovativoImage] = useState<string | null>(null);
  const [comprovativoName, setComprovativoName] = useState<string>('comprovativo.png');
  const [isLoadingComprovativo, setIsLoadingComprovativo] = useState<boolean>(false);
  const comprovativoCacheRef = useRef<Map<string, string>>(new Map());

  const [activeTab, setActiveTab] = useState<HistoricoTabType>('movimentos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedTipoMov, setSelectedTipoMov] = useState<string>('todos');
  const [selectedDestino, setSelectedDestino] = useState<string>('todos');
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterType>('todos');
  const [selectedModalPedido, setSelectedModalPedido] = useState<PedidoComLinhas | null>(null);
  const [viewMode, setViewMode] = useState<ViewModeType>('tabela');

  // Estados específicos da aba "Listagem por Artigo"
  const [artigoSearchQuery, setArtigoSearchQuery] = useState<string>('');
  const [tabArtigoSelected, setTabArtigoSelected] = useState<string>('todos');
  const [tabArtigoPeriod, setTabArtigoPeriod] = useState<DateFilterType>('todos');
  const [tabArtigoDateFrom, setTabArtigoDateFrom] = useState<string>('');
  const [tabArtigoDateTo, setTabArtigoDateTo] = useState<string>('');
  const [tabArtigoTipoMov, setTabArtigoTipoMov] = useState<string>('todos');

  // Estados específicos da aba "Faturação" (Apenas Clientes CF)
  const [faturaSearchQuery, setFaturaSearchQuery] = useState<string>('');
  const [faturaTipoDoc, setFaturaTipoDoc] = useState<string>('todos');
  const [faturaPeriod, setFaturaPeriod] = useState<DateFilterType>('todos');
  const [faturaDateFrom, setFaturaDateFrom] = useState<string>('');
  const [faturaDateTo, setFaturaDateTo] = useState<string>('');
  const [selectedModalFatura, setSelectedModalFatura] = useState<HistoricoFaturaItem | null>(null);

  const isManagerOrAdmin =
    currentUserProfile?.role === 'admin' ||
    currentUserProfile?.role === 'gestor' ||
    currentUserProfile?.email === 'admin@sermail.pt';

  // Clientes com Faturação (CF) e visibilidade da aba "Faturação"
  const cfClients = useMemo(() => {
    return clients.filter((c) => c.tipo_cliente === 'CF');
  }, [clients]);

  const effectiveClientObj = useMemo(() => {
    if (isManagerOrAdmin) {
      return selectedClientId === 'todos'
        ? null
        : clients.find((c) => c.id === selectedClientId) || null;
    }
    return (
      clients.find((c) => c.id === currentUserProfile?.cliente_id) ||
      clients[0] ||
      null
    );
  }, [isManagerOrAdmin, selectedClientId, clients, currentUserProfile]);

  const showFaturacaoTab = useMemo(() => {
    if (isManagerOrAdmin) {
      return selectedClientId === 'todos'
        ? cfClients.length > 0
        : effectiveClientObj?.tipo_cliente === 'CF';
    }
    return effectiveClientObj?.tipo_cliente === 'CF';
  }, [isManagerOrAdmin, selectedClientId, cfClients, effectiveClientObj]);

  useEffect(() => {
    if (activeTab === 'faturacao' && !showFaturacaoTab) {
      setActiveTab('movimentos');
    }
  }, [activeTab, showFaturacaoTab]);


  const getStatusLabel = (status: StatusPedido | string) => {
    switch (status) {
      case 'pendente':
        return t.historico.statusPendente;
      case 'confirmado':
        return t.historico.statusConfirmado;
      case 'em_preparacao':
        return t.historico.statusPreparacao;
      case 'expedido':
        return t.historico.statusExpedido;
      case 'entregue':
        return t.historico.statusEntregue;
      case 'cancelado':
        return t.historico.statusCancelado;
      case 'rececionado':
        return 'Rececionado';
      case 'transfer':
        return 'Transfer';
      default:
        return STATUS_PEDIDO_LABELS[status as StatusPedido] || status;
    }
  };

  const formatDate = (dStr: string | null | undefined) => {
    if (!dStr) return '-';
    try {
      const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'pt-PT';
      return new Date(dStr).toLocaleDateString(locale);
    } catch {
      return dStr;
    }
  };



  const handleViewComprovativo = async (url_comprovativo: string, ref_ser: string) => {
    try {
      setFeedback(null);
      const safeName = (ref_ser || 'comprovativo').replace(/[^a-z0-9]/gi, '_');
      setComprovativoName(`${safeName}.png`);

      const cachedDataUrl = comprovativoCacheRef.current.get(url_comprovativo);
      if (cachedDataUrl) {
        setComprovativoImage(cachedDataUrl);
        return;
      }

      setIsLoadingComprovativo(true);

      const { data: signedUrlData, error: signedError } = await supabase.storage
        .from('comprovativos_ttir')
        .createSignedUrl(url_comprovativo, 60, { download: false });

      if (signedError || !signedUrlData) {
        setIsLoadingComprovativo(false);
        setFeedback({ type: 'error', message: 'Comprovativo não encontrado ou indisponível.' });
        return;
      }

      // Buscar o ficheiro como ArrayBuffer
      const response = await fetch(signedUrlData.signedUrl);
      if (!response.ok) throw new Error('Falha ao descarregar a imagem');
      const buffer = await response.arrayBuffer();

      // Processar com UTIF (import dinâmico sob demanda)
      const UTIF = (await import('utif')).default;
      const ifds = UTIF.decode(buffer);
      UTIF.decodeImage(buffer, ifds[0]);
      const rgba = UTIF.toRGBA8(ifds[0]);

      // Converter para Canvas e depois para DataURL PNG
      const canvas = document.createElement('canvas');
      canvas.width = ifds[0].width;
      canvas.height = ifds[0].height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        imageData.data.set(rgba);
        ctx.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        comprovativoCacheRef.current.set(url_comprovativo, dataUrl);
        setComprovativoImage(dataUrl);
      }

      setIsLoadingComprovativo(false);
    } catch (error) {
      console.error('Erro ao abrir comprovativo:', error);
      setIsLoadingComprovativo(false);
      setFeedback({ type: 'error', message: 'Ocorreu um erro ao tentar processar o comprovativo TIFF.' });
    }
  };

  const getPedidoDateStr = (dStr: string | null | undefined): string => {
    if (!dStr) return '';
    const clean = String(dStr).trim();
    if (clean.length >= 10 && clean[4] === '-' && clean[7] === '-') {
      return clean.slice(0, 10);
    }
    const d = new Date(clean);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  const handleConfirmDeleteMovimento = async () => {
    if (!pedidoToDelete) return;
    setIsDeleting(true);
    setFeedback(null);

    try {
      const res = await apagarMovimentoAction({
        id: pedidoToDelete.id,
        nr_pedido: pedidoToDelete.nr_pedido,
        sigla_pedido: pedidoToDelete.sigla_pedido,
        cliente_id: pedidoToDelete.cliente_id,
        cliente_sigla: pedidoToDelete.clients?.sigla || pedidoToDelete.clientes?.sigla,
      });

      if (res.success) {
        const deletedId = pedidoToDelete.id;
        const deletedDoc = pedidoToDelete.nr_pedido;
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.add(deletedId);
          return next;
        });
        if (selectedModalPedido?.id === deletedId) {
          setSelectedModalPedido(null);
        }
        setPedidoToDelete(null);
        setFeedback({
          type: 'success',
          message:
            language === 'pt'
              ? `Movimento ${deletedDoc} e respetivas linhas apagados com sucesso.`
              : language === 'es'
                ? `Movimiento ${deletedDoc} y sus líneas eliminados con éxito.`
                : `Movement ${deletedDoc} and its associated lines deleted successfully.`,
        });
        router.refresh();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Erro ao apagar o movimento.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao apagar o movimento.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  // Estados disponíveis para filtro (únicos e em ordem alfabética)
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    activePedidos.forEach((ped) => {
      if (ped.status) {
        statuses.add(ped.status);
      }
    });
    return Array.from(statuses).sort();
  }, [activePedidos]);

  // Destinos disponíveis para filtro na aba "Histórico de Movimentos"
  const availableDestinos = useMemo(() => {
    const destinosSet = new Set<string>();
    activePedidos.forEach((ped) => {
      if (ped.processado) return;
      if (selectedClientId !== 'todos' && ped.cliente_id !== selectedClientId) return;
      const destNome = (ped.nome_destinatario || ped.destinos?.nome || '').trim();
      if (destNome) {
        destinosSet.add(destNome);
      }
    });
    const collator = new Intl.Collator('pt-PT', { sensitivity: 'base' });
    return Array.from(destinosSet).sort((a, b) => collator.compare(a, b));
  }, [activePedidos, selectedClientId]);

  // Artigos disponíveis para filtro nos pedidos / movimentos (indexados por artigo_id)
  const availableArtigos = useMemo(() => {
    const map = new Map<string, string>();
    activePedidos.forEach((ped) => {
      if (ped.processado) return;
      if (selectedClientId !== 'todos' && ped.cliente_id !== selectedClientId) return;
      ped.pedido_linhas?.forEach((l) => {
        const artCod = String(l.artigo_id || l.artigo_cli || l.artigo_codigo || '').trim();
        if (artCod) {
          if (!map.has(artCod) || map.get(artCod) === artCod) {
            map.set(artCod, l.descricao || artCod);
          }
        }
      });
    });
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return Array.from(map.entries())
      .map(([codigo, descricao]) => ({ codigo, descricao }))
      .sort((a, b) => collator.compare(a.codigo, b.codigo));
  }, [activePedidos, selectedClientId]);

  // Opções de artigos filtradas pela pesquisa rápida na aba "Por Artigo"
  const filteredArtigosOptions = useMemo(() => {
    const q = artigoSearchQuery.trim().toLowerCase();
    if (!q) return availableArtigos;
    return availableArtigos.filter(
      (a) => a.codigo.toLowerCase().includes(q) || a.descricao.toLowerCase().includes(q)
    );
  }, [availableArtigos, artigoSearchQuery]);

  // Handler para atalhos de período temporal na aba "Por Artigo"
  const handleTabArtigoPeriodChange = (period: DateFilterType) => {
    setTabArtigoPeriod(period);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (period === 'todos') {
      setTabArtigoDateFrom('');
      setTabArtigoDateTo('');
    } else if (period === 'hoje') {
      setTabArtigoDateFrom(todayStr);
      setTabArtigoDateTo(todayStr);
    } else if (period === '7dias') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setTabArtigoDateFrom(d.toISOString().split('T')[0]);
      setTabArtigoDateTo(todayStr);
    } else if (period === '30dias') {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setTabArtigoDateFrom(d.toISOString().split('T')[0]);
      setTabArtigoDateTo(todayStr);
    } else if (period === 'este_mes') {
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setTabArtigoDateFrom(firstDay);
      setTabArtigoDateTo(todayStr);
    } else if (period === 'este_ano') {
      const firstDayYear = `${now.getFullYear()}-01-01`;
      setTabArtigoDateFrom(firstDayYear);
      setTabArtigoDateTo(todayStr);
    }
  };

  // Listagem de movimentos e resumo do artigo selecionado no período temporal (Aba "Por Artigo")
  const { artigoMovimentosList, artigoResumoTotais, selectedArtigoInfo } = useMemo(() => {
    const rows: Array<{
      id: string;
      pedido: PedidoComLinhas;
      nr_pedido: string;
      data_pedido: string;
      dateStr: string;
      tipo_movimento: string;
      cliente_sigla: string;
      destinatario: string;
      localidade: string;
      requisicao: string;
      status: string;
      url_comprovativo?: string;
      ref_ser?: string;
      artigo_id: string;
      descricao: string;
      lote: string;
      validade: string | null;
      quantidade: number;
    }> = [];

    let totalUnidades = 0;
    let totalSaidas = 0;
    let totalEntradas = 0;
    let totalTransferencias = 0;
    const docsSet = new Set<string>();
    const lotesSet = new Set<string>();
    const qArt = artigoSearchQuery.trim().toLowerCase();

    for (let i = 0; i < activePedidos.length; i++) {
      const ped = activePedidos[i];
      if (ped.processado) continue;
      if (selectedClientId !== 'todos' && ped.cliente_id !== selectedClientId) continue;

      const movTipo = (ped.tipo_movimento || 'SS').toUpperCase();
      if (tabArtigoTipoMov !== 'todos' && movTipo.toLowerCase() !== tabArtigoTipoMov) continue;

      const dateStr = getPedidoDateStr(ped.data_pedido);
      if (tabArtigoDateFrom && (!dateStr || dateStr < tabArtigoDateFrom)) continue;
      if (tabArtigoDateTo && (!dateStr || dateStr > tabArtigoDateTo)) continue;

      const linhas = ped.pedido_linhas || [];
      for (let j = 0; j < linhas.length; j++) {
        const l = linhas[j];
        const artId = String(l.artigo_id || l.artigo_cli || l.artigo_codigo || '').trim();
        const desc = String(l.descricao || '').trim();

        if (tabArtigoSelected !== 'todos') {
          if (artId !== tabArtigoSelected && l.artigo_cli !== tabArtigoSelected && l.artigo_codigo !== tabArtigoSelected) {
            continue;
          }
        } else if (qArt) {
          if (!artId.toLowerCase().includes(qArt) && !desc.toLowerCase().includes(qArt)) {
            continue;
          }
        }

        const qtd = Math.abs(Number(l.quantidade || 0));
        totalUnidades += qtd;
        if (movTipo === 'ES') {
          totalEntradas += qtd;
        } else if (movTipo === 'ET' || movTipo === 'ST') {
          totalTransferencias += qtd;
        } else {
          totalSaidas += qtd;
        }

        if (ped.nr_pedido) docsSet.add(ped.nr_pedido);
        if (l.lote) lotesSet.add(l.lote);

        rows.push({
          id: `${ped.id}_${j}`,
          pedido: ped,
          nr_pedido: ped.nr_pedido,
          data_pedido: ped.data_pedido,
          dateStr,
          tipo_movimento: movTipo,
          cliente_sigla: ped.clients?.sigla || '',
          destinatario: ped.nome_destinatario || ped.destinos?.nome || '-',
          localidade: ped.cod_postal_localidade || ped.localidade || '-',
          requisicao: ped.requisicao || ped.ref_documento || '-',
          status: ped.status,
          url_comprovativo: (ped as any).url_comprovativo,
          ref_ser: (ped as any).ref_ser,
          artigo_id: artId,
          descricao: desc || '-',
          lote: l.lote || '-',
          validade: l.validade || null,
          quantidade: qtd,
        });
      }
    }

    const foundArt =
      tabArtigoSelected !== 'todos'
        ? availableArtigos.find((a) => a.codigo === tabArtigoSelected) || {
          codigo: tabArtigoSelected,
          descricao: rows[0]?.descricao || tabArtigoSelected,
        }
        : null;

    return {
      artigoMovimentosList: rows,
      artigoResumoTotais: {
        totalUnidades,
        totalSaidas,
        totalEntradas,
        totalTransferencias,
        numMovimentos: rows.length,
        numDocumentos: docsSet.size,
        numLotes: lotesSet.size,
      },
      selectedArtigoInfo: foundArt,
    };
  }, [
    activePedidos,
    selectedClientId,
    tabArtigoSelected,
    artigoSearchQuery,
    tabArtigoDateFrom,
    tabArtigoDateTo,
    tabArtigoTipoMov,
    availableArtigos,
  ]);

  // Filtragem
  const filteredPedidos = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const nowMonth = now.getMonth();
    const nowYear = now.getFullYear();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;
    const query = searchTerm.trim().toLowerCase();

    return activePedidos.filter((ped) => {
      // REGRA: Pedidos cujo campo processado esteja selecionado não devem ser apresentados no histórico de movimentos
      if (ped.processado) {
        return false;
      }

      // Filtro de Cliente
      if (selectedClientId !== 'todos' && ped.cliente_id !== selectedClientId) {
        return false;
      }

      // Filtro Tipo Movimento
      if (selectedTipoMov !== 'todos' && ped.tipo_movimento?.toLowerCase() !== selectedTipoMov) {
        return false;
      }

      // Filtro de Destino
      if (selectedDestino !== 'todos') {
        const destNome = (ped.nome_destinatario || ped.destinos?.nome || '').trim();
        if (destNome !== selectedDestino) return false;
      }

      // Filtro de Estado
      if (selectedStatus !== 'todos' && ped.status !== selectedStatus) {
        return false;
      }

      // Filtro de Data
      if (selectedDateFilter !== 'todos') {
        const pedDateOnly = getPedidoDateStr(ped.data_pedido);
        if (selectedDateFilter === 'hoje') {
          if (pedDateOnly !== todayStr) return false;
        } else {
          const pedDate = new Date(ped.data_pedido);
          const pedTime = pedDate.getTime();
          if (selectedDateFilter === '7dias') {
            if (pedTime < sevenDaysAgoMs) return false;
          } else if (selectedDateFilter === '30dias') {
            if (pedTime < thirtyDaysAgoMs) return false;
          } else if (selectedDateFilter === 'este_mes') {
            if (pedDate.getMonth() !== nowMonth || pedDate.getFullYear() !== nowYear) {
              return false;
            }
          }
        }
      }

      // Filtro de Pesquisa Textual
      if (query) {
        const matchNr = ped.nr_pedido?.toLowerCase().includes(query);
        const matchDest = (ped.nome_destinatario || ped.destinos?.nome || '')?.toLowerCase().includes(query);
        const matchMorada = ped.morada?.toLowerCase().includes(query);
        const matchLoc = ped.localidade?.toLowerCase().includes(query);
        const matchCP = ped.codigo_postal?.toLowerCase().includes(query);
        const matchRef = (ped.requisicao || ped.ref_documento)?.toLowerCase().includes(query);
        const matchObs = ped.observacoes?.toLowerCase().includes(query);
        const matchCli =
          ped.clients?.sigla?.toLowerCase().includes(query) ||
          ped.clients?.name?.toLowerCase().includes(query);

        // Pesquisa também nas linhas de artigos
        const matchLinha = ped.pedido_linhas?.some(
          (l) =>
            String(l.artigo_id || '')?.toLowerCase().includes(query) ||
            (l.artigo_cli || l.artigo_codigo)?.toLowerCase().includes(query) ||
            l.descricao?.toLowerCase().includes(query) ||
            l.lote?.toLowerCase().includes(query)
        );

        if (
          !matchNr &&
          !matchDest &&
          !matchMorada &&
          !matchLoc &&
          !matchCP &&
          !matchRef &&
          !matchObs &&
          !matchCli &&
          !matchLinha
        ) {
          return false;
        }
      }

      return true;
    });
  }, [activePedidos, selectedClientId, selectedStatus, selectedTipoMov, selectedDestino, selectedDateFilter, searchTerm]);

  // Total de unidades filtradas
  const totalUnidadesFiltradas = useMemo(() => {
    return filteredPedidos.reduce((acc, ped) => {
      const pedTotal =
        ped.pedido_linhas?.reduce((lAcc, l) => lAcc + Number(l.quantidade || 0), 0) || 0;
      return acc + pedTotal;
    }, 0);
  }, [filteredPedidos]);

  // Handler para atalhos de período temporal na aba "Faturação"
  const handleFaturaPeriodChange = (period: DateFilterType) => {
    setFaturaPeriod(period);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (period === 'todos') {
      setFaturaDateFrom('');
      setFaturaDateTo('');
    } else if (period === 'hoje') {
      setFaturaDateFrom(todayStr);
      setFaturaDateTo(todayStr);
    } else if (period === '7dias') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setFaturaDateFrom(d.toISOString().split('T')[0]);
      setFaturaDateTo(todayStr);
    } else if (period === '30dias') {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setFaturaDateFrom(d.toISOString().split('T')[0]);
      setFaturaDateTo(todayStr);
    } else if (period === 'este_mes') {
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setFaturaDateFrom(firstDay);
      setFaturaDateTo(todayStr);
    } else if (period === 'este_ano') {
      const firstDayYear = `${now.getFullYear()}-01-01`;
      setFaturaDateFrom(firstDayYear);
      setFaturaDateTo(todayStr);
    }
  };

  // Tipos de documento disponíveis na tabela faturas
  const availableFaturaTipoDocs = useMemo(() => {
    const set = new Set<string>();
    faturas.forEach((f) => {
      const td = (f.tipo_doc || '').toString().trim().toUpperCase();
      if (td) set.add(td);
    });
    return Array.from(set).sort();
  }, [faturas]);

  // Filtragem e totais da aba "Faturação"
  const { filteredFaturas, faturasResumoTotais } = useMemo(() => {
    const q = faturaSearchQuery.trim().toLowerCase();
    const selClient = selectedClientId !== 'todos' ? clients.find((c) => c.id === selectedClientId) : null;

    const list = faturas.filter((f) => {
      // Filtro por cliente
      if (isManagerOrAdmin && selectedClientId !== 'todos') {
        const matchId = f.cliente_id === selectedClientId;
        const matchSigla =
          selClient?.sigla &&
          (String(f.sigla || '').trim().toUpperCase() === selClient.sigla.trim().toUpperCase() ||
            String(f.cliente_sigla || '').trim().toUpperCase() === selClient.sigla.trim().toUpperCase());
        const matchPrim =
          selClient?.cli_primavera &&
          String(f.cli_primavera || '').trim() === selClient.cli_primavera.trim();
        if (!matchId && !matchSigla && !matchPrim) return false;
      }

      // Filtro por tipo de documento
      if (faturaTipoDoc !== 'todos') {
        const td = String(f.tipo_doc || '').trim().toUpperCase();
        if (td !== faturaTipoDoc.toUpperCase()) return false;
      }

      // Filtro por intervalo de datas
      const fDateStr = getPedidoDateStr(f.data);
      if (faturaDateFrom && (!fDateStr || fDateStr < faturaDateFrom)) return false;
      if (faturaDateTo && (!fDateStr || fDateStr > faturaDateTo)) return false;

      // Pesquisa livre
      if (q) {
        const matchDocRef = String(f.documento_ref || '').toLowerCase().includes(q);
        const matchDoc = String(f.documento || '').toLowerCase().includes(q);
        const matchNumDoc = String(f.num_doc || '').toLowerCase().includes(q);
        const matchEntidade = String(f.entidade || '').toLowerCase().includes(q);
        const matchNome = String(f.nome || f.nome_entrega || '').toLowerCase().includes(q);
        const matchNif = String(f.num_contribuinte || '').toLowerCase().includes(q);
        const matchReq = String(f.requisicao || '').toLowerCase().includes(q);
        const matchLoc = String(f.localidade || f.cod_postal_localidade || f.localidade_entrega || '')
          .toLowerCase()
          .includes(q);
        const matchCli = String(f.cliente_sigla || f.sigla || f.cliente_ser || '')
          .toLowerCase()
          .includes(q);

        if (
          !matchDocRef &&
          !matchDoc &&
          !matchNumDoc &&
          !matchEntidade &&
          !matchNome &&
          !matchNif &&
          !matchReq &&
          !matchLoc &&
          !matchCli
        ) {
          return false;
        }
      }

      return true;
    });

    let totalMerc = 0;
    let totalDesc = 0;
    let totalIva = 0;
    let totalOutros = 0;
    let totalLiquido = 0;

    list.forEach((f) => {
      const merc = Number(f.total_merc) || 0;
      const desc = Number(f.total_desc) || 0;
      const iva = Number(f.total_iva) || 0;
      const outros = Number(f.total_outros) || 0;
      const liq = merc - iva - desc;

      totalMerc += merc;
      totalDesc += desc;
      totalIva += iva;
      totalOutros += outros;
      totalLiquido += liq;
    });

    return {
      filteredFaturas: list,
      faturasResumoTotais: {
        totalDocs: list.length,
        totalMerc,
        totalDesc,
        totalIva,
        totalOutros,
        totalLiquido,
      },
    };
  }, [
    faturas,
    isManagerOrAdmin,
    selectedClientId,
    clients,
    faturaTipoDoc,
    faturaDateFrom,
    faturaDateTo,
    faturaSearchQuery,
  ]);

  const handleClearFaturaFilters = () => {
    setFaturaSearchQuery('');
    setFaturaTipoDoc('todos');
    setFaturaPeriod('todos');
    setFaturaDateFrom('');
    setFaturaDateTo('');
    if (isManagerOrAdmin) {
      setSelectedClientId('todos');
    }
  };

  const hasFaturaActiveFilters =
    faturaSearchQuery !== '' ||
    faturaTipoDoc !== 'todos' ||
    faturaPeriod !== 'todos' ||
    faturaDateFrom !== '' ||
    faturaDateTo !== '' ||
    selectedClientId !== 'todos';

  const formatCurrency = (val: number | string | null | undefined) => {
    const num = Number(val) || 0;
    const loc = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'pt-PT';
    return `${num.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  };

  // Exportar CSV
  const handleExportCSV = () => {
    try {
      const sanitize = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;

      if (activeTab === 'faturacao') {
        const headers = [
          'Ref Documento',
          'Documento',
          'Tipo Doc',
          'Num Doc',
          'Data',
          'Cliente',
          'Entidade',
          'Nome / Destinatario',
          'NIF',
          'Morada',
          'Codigo Postal',
          'Localidade',
          'Requisicao',
          'Total Mercadoria (EUR)',
          'Total Desconto (EUR)',
          'Total IVA (EUR)',
          'Total Liquido (EUR)',
        ];

        const rows: string[] = [headers.join(',')];

        filteredFaturas.forEach((f) => {
          const merc = Number(f.total_merc) || 0;
          const desc = Number(f.total_desc) || 0;
          const iva = Number(f.total_iva) || 0;
          const liq = merc - iva - desc;

          const rowParts = [
            sanitize(f.documento_ref),
            sanitize(f.documento || ''),
            sanitize(f.tipo_doc || ''),
            sanitize(f.num_doc || ''),
            sanitize(f.data || ''),
            sanitize(f.cliente_sigla || f.sigla || ''),
            sanitize(f.entidade || ''),
            sanitize(f.nome || f.nome_entrega || ''),
            sanitize(f.num_contribuinte || ''),
            sanitize(f.morada || f.morada_entrega || ''),
            sanitize(f.cod_postal || f.cod_postal_entrega || ''),
            sanitize(f.localidade || f.cod_postal_localidade || f.localidade_entrega || ''),
            sanitize(f.requisicao || ''),
            merc.toFixed(2),
            desc.toFixed(2),
            iva.toFixed(2),
            liq.toFixed(2),
          ];
          rows.push(rowParts.join(','));
        });

        const csvString = '\uFEFF' + rows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `faturacao_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      if (activeTab === 'por_artigo') {
        const headers = [
          'Nr Pedido / Documento',
          'Tipo Movimento',
          'Data Movimento',
          'Estado',
          'Cliente',
          'Codigo Artigo',
          'Descricao Artigo',
          'Lote',
          'Validade',
          'Destinatario',
          'Localidade',
          'Requisicao',
          'Quantidade',
        ];

        const rows: string[] = [headers.join(',')];

        artigoMovimentosList.forEach((row) => {
          const statusLabel = getStatusLabel(row.status);
          const rowParts = [
            sanitize(row.nr_pedido),
            sanitize((row.tipo_movimento || '').toUpperCase()),
            sanitize(row.data_pedido),
            sanitize(statusLabel),
            sanitize(row.cliente_sigla || ''),
            sanitize(row.artigo_id),
            sanitize(row.descricao),
            sanitize(row.lote || ''),
            sanitize(row.validade || ''),
            sanitize(row.destinatario || ''),
            sanitize(row.localidade || ''),
            sanitize(row.requisicao || ''),
            row.quantidade,
          ];
          rows.push(rowParts.join(','));
        });

        const csvString = '\uFEFF' + rows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const artSlug = tabArtigoSelected !== 'todos' ? `_${tabArtigoSelected}` : '';
        link.setAttribute('download', `movimentos_artigo${artSlug}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      const headers = [
        'Nr Pedido',
        'Data Pedido',
        'Data Entrega',
        'Estado',
        'Cliente',
        'Destinatario',
        'Classificacao Destino',
        'Morada',
        'Codigo Postal',
        'Localidade',
        'Pais',
        'Ref Documento',
        'Observacoes',
        'Codigo Artigo',
        'Descricao Artigo',
        'Lote',
        'Validade',
        'Quantidade',
      ];

      const rows: string[] = [headers.join(',')];

      filteredPedidos.forEach((ped) => {
        const statusLabel = getStatusLabel(ped.status);
        const classif = ped.classifica_destino || ped.destinos?.classifica_destino || '';

        const baseParts = [
          sanitize(ped.nr_pedido),
          sanitize(ped.data_pedido),
          sanitize(ped.data_entrega || ''),
          sanitize(statusLabel),
          sanitize(ped.clients?.sigla || ''),
          sanitize(ped.nome_destinatario || ped.destinos?.nome || ''),
          sanitize(classif),
          sanitize(ped.morada || ''),
          sanitize(ped.codigo_postal || ped.cod_postal || ''),
          sanitize(ped.localidade || ped.cod_postal_localidade || ''),
          sanitize(ped.pais || 'Portugal'),
          sanitize(ped.requisicao || ped.ref_documento || ''),
          sanitize(ped.observacoes || ''),
        ];

        if (ped.pedido_linhas && ped.pedido_linhas.length > 0) {
          ped.pedido_linhas.forEach((l) => {
            const linhaParts = [
              ...baseParts,
              sanitize(l.artigo_id || l.artigo_cli || l.artigo_codigo || ''),
              sanitize(l.descricao || ''),
              sanitize(l.lote || ''),
              sanitize(l.validade || ''),
              Number(l.quantidade || 0),
            ];
            rows.push(linhaParts.join(','));
          });
        } else {
          const emptyLinha = [
            ...baseParts,
            '""',
            '""',
            '""',
            '""',
            0,
          ];
          rows.push(emptyLinha.join(','));
        }
      });

      // Incluir BOM UTF-8 (\uFEFF) para caracteres com acento abrirem corretamente no Excel
      const csvString = '\uFEFF' + rows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `historico_pedidos_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
    }
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedClientId !== 'todos' ||
    selectedStatus !== 'todos' ||
    selectedTipoMov !== 'todos' ||
    selectedDestino !== 'todos' ||
    selectedDateFilter !== 'todos';

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedClientId('todos');
    setSelectedStatus('todos');
    setSelectedTipoMov('todos');
    setSelectedDestino('todos');
    setSelectedDateFilter('todos');
  };

  const handleClearTabArtigoFilters = () => {
    setArtigoSearchQuery('');
    setTabArtigoSelected('todos');
    setTabArtigoPeriod('todos');
    setTabArtigoDateFrom('');
    setTabArtigoDateTo('');
    setTabArtigoTipoMov('todos');
    if (isManagerOrAdmin) {
      setSelectedClientId('todos');
    }
  };

  const hasTabArtigoActiveFilters =
    artigoSearchQuery !== '' ||
    tabArtigoSelected !== 'todos' ||
    tabArtigoPeriod !== 'todos' ||
    tabArtigoDateFrom !== '' ||
    tabArtigoDateTo !== '' ||
    tabArtigoTipoMov !== 'todos' ||
    selectedClientId !== 'todos';

  return (
    <main className="w-full px-4 sm:px-6 pt-1 pb-6 space-y-4 sm:space-y-5">
      {/* Linha Topo: Janela do Título (1/2 do comprimento) + Botões de Seleção de Aba à direita */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Banner Topo Sermail (1/2 do comprimento em ecrãs largos, 48px / h-12) */}
        <div className="w-full lg:w-1/2 bg-gradient-to-r from-sermail-green-dark via-sermail-green to-[#005a46] text-white rounded-xl px-4 sm:px-6 h-12 flex items-center shadow-sm relative overflow-hidden border border-emerald-950/30">
          <div className="relative z-10 flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center text-sermail-lime-border shrink-0 border border-white/10">
                <span className="material-symbols-outlined text-base">receipt_long</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 min-w-0">
                <h1 className="text-sm sm:text-base font-bold font-headline leading-none text-white whitespace-nowrap shrink-0">
                  {t.historico.bannerTitle}
                </h1>
                <p className="text-xs sm:text-sm text-lime-300/90 font-medium leading-normal truncate">
                  {t.historico.bannerSubtitle}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Botões de Seleção de Aba à Direita da Janela do Título */}
        <div className="bg-white border border-lime-400 rounded-xl p-1 h-12 shadow-2xs flex items-center gap-1.5 shrink-0 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('movimentos')}
            className={`h-full px-4 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 border border-lime-400 transition-all cursor-pointer ${activeTab === 'movimentos'
                ? 'bg-sermail-green text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <span
              className={`material-symbols-outlined text-base ${activeTab === 'movimentos' ? 'text-sermail-lime-border' : 'text-slate-400'
                }`}
            >
              receipt_long
            </span>
            <span>
              {language === 'pt'
                ? 'Histórico de Movimentos'
                : language === 'es'
                  ? 'Historial de Movimientos'
                  : 'Movement History'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${activeTab === 'movimentos'
                  ? 'bg-white/15 text-white'
                  : 'bg-slate-100 text-slate-600'
                }`}
            >
              {filteredPedidos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('por_artigo')}
            className={`h-full px-4 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 border border-lime-400 transition-all cursor-pointer ${activeTab === 'por_artigo'
                ? 'bg-sermail-green text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <span
              className={`material-symbols-outlined text-base ${activeTab === 'por_artigo' ? 'text-sermail-lime-border' : 'text-slate-400'
                }`}
            >
              inventory_2
            </span>
            <span>
              {language === 'pt'
                ? 'Listagem por Artigo'
                : language === 'es'
                  ? 'Listado por Artículo'
                  : 'Listing by Article'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${activeTab === 'por_artigo'
                  ? 'bg-white/15 text-white'
                  : 'bg-slate-100 text-slate-600'
                }`}
            >
              {availableArtigos.length}
            </span>
          </button>

          {showFaturacaoTab && (
            <button
              type="button"
              onClick={() => setActiveTab('faturacao')}
              className={`h-full px-4 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 border border-lime-400 transition-all cursor-pointer ${activeTab === 'faturacao'
                  ? 'bg-sermail-green text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <span
                className={`material-symbols-outlined text-base ${activeTab === 'faturacao' ? 'text-sermail-lime-border' : 'text-slate-400'
                  }`}
              >
                euro_symbol
              </span>
              <span>Faturação</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${activeTab === 'faturacao'
                    ? 'bg-white/15 text-white'
                    : 'bg-slate-100 text-slate-600'
                  }`}
              >
                {filteredFaturas.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-sm transition-all animate-fadeIn ${feedback.type === 'success'
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
            onClick={() => setFeedback(null)}
            className="text-slate-500 hover:text-slate-800"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {activeTab === 'faturacao' && showFaturacaoTab ? (
        /* =========================================================
           ABA 3: FATURAÇÃO (APENAS CLIENTES CF)
           ========================================================= */
        <div className="space-y-5">
          {/* Painel de Filtros da Aba Faturação */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-sermail-green">
                  <span className="material-symbols-outlined text-lg">euro_symbol</span>
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    Listagem de Faturação (Clientes CF)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Consulte as linhas da tabela de faturas relativas ao cliente e filtre por período ou tipo de documento
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {hasFaturaActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFaturaFilters}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-lime-400 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                    Limpar Filtros
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={filteredFaturas.length === 0}
                  className="px-4 py-2 bg-white border border-lime-400 text-slate-800 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none font-semibold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-sermail-green">download</span>
                  {t.common.export} CSV
                </button>
              </div>
            </div>

            {/* Filtro de Cliente CF (Exclusivo para Administrador e Gestor) */}
            {isManagerOrAdmin && (
              <div className="pb-3 border-b border-slate-100">
                <div className="max-w-sm">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-sermail-green">business</span>
                    {t.historico.filterClient} (CF)
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green cursor-pointer"
                  >
                    <option value="todos">Todos os Clientes (CF)</option>
                    {cfClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.sigla} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Linha Principal de Filtros (Pesquisa Livre, Período Temporal e Tipo de Documento) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* 1. Pesquisa Rápida */}
              <div className="md:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-sermail-green">search</span>
                    Pesquisar Fatura / Destinatário / NIF / Requisição
                  </span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    search
                  </span>
                  <input
                    type="text"
                    value={faturaSearchQuery}
                    onChange={(e) => setFaturaSearchQuery(e.target.value)}
                    placeholder="Filtrar por nº fatura, entidade, nome, NIF, requisição ou localidade..."
                    className="w-full h-9 pl-8 pr-7 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                  />
                  {faturaSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setFaturaSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Período Temporal */}
              <div className="md:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-sermail-green">calendar_month</span>
                  Período Temporal
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <select
                      value={faturaPeriod}
                      onChange={(e) => handleFaturaPeriodChange(e.target.value as DateFilterType)}
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
                    >
                      <option value="todos">Todo o Histórico</option>
                      <option value="hoje">Hoje</option>
                      <option value="7dias">Últimos 7 dias</option>
                      <option value="30dias">Últimos 30 dias</option>
                      <option value="este_mes">Este Mês</option>
                      <option value="este_ano">Este Ano</option>
                      <option value="personalizado">Personalizado</option>
                    </select>
                  </div>

                  <div className="relative">
                    <input
                      type="date"
                      value={faturaDateFrom}
                      onChange={(e) => {
                        setFaturaDateFrom(e.target.value);
                        setFaturaPeriod('personalizado');
                      }}
                      title="Data de Início (De)"
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                    <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold uppercase text-slate-400">
                      De
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="date"
                      value={faturaDateTo}
                      onChange={(e) => {
                        setFaturaDateTo(e.target.value);
                        setFaturaPeriod('personalizado');
                      }}
                      title="Data de Fim (Até)"
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                    <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold uppercase text-slate-400">
                      Até
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Tipo de Documento */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-sermail-green">description</span>
                  Tipo Doc.
                </label>
                <select
                  value={faturaTipoDoc}
                  onChange={(e) => setFaturaTipoDoc(e.target.value)}
                  className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
                >
                  <option value="todos">Todos ({availableFaturaTipoDocs.join('/') || 'FA'})</option>
                  {availableFaturaTipoDocs.map((td) => (
                    <option key={td} value={td}>
                      {td}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Resumo Monetário da Faturação no Período */}
          <div className="bg-gradient-to-br from-emerald-950 via-sermail-green-dark to-[#004d3b] text-white rounded-2xl p-5 sm:p-6 shadow-md border border-emerald-800/40 relative overflow-hidden">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-lime-400/20 text-lime-300 border border-lime-400/30">
                    Resumo de Faturação
                  </span>
                  <span className="text-xs text-emerald-200 font-mono flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">date_range</span>
                    {faturaDateFrom || faturaDateTo
                      ? `${faturaDateFrom ? formatDate(faturaDateFrom) : 'Início'} até ${
                          faturaDateTo ? formatDate(faturaDateTo) : 'Hoje'
                        }`
                      : 'Todo o período disponível'}
                  </span>
                </div>
                <h3 className="text-base sm:text-xl font-bold font-headline text-white truncate">
                  {effectiveClientObj
                    ? `[${effectiveClientObj.sigla}] ${effectiveClientObj.name}`
                    : 'Todos os Clientes com Faturação (CF)'}
                </h3>
                <p className="text-xs text-emerald-200/90">
                  {faturasResumoTotais.totalDocs} documento(s) listado(s) na tabela faturas
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                {/* Total Mercadoria */}
                <div className="bg-white/10 backdrop-blur-xs rounded-xl px-3.5 py-2.5 border border-white/10">
                  <span className="block text-[10px] uppercase tracking-wider font-semibold text-emerald-200">
                    Total Mercadoria
                  </span>
                  <div className="text-sm sm:text-base font-bold font-mono text-white mt-0.5">
                    {formatCurrency(faturasResumoTotais.totalMerc)}
                  </div>
                </div>

                {/* Total Desconto */}
                <div className="bg-white/10 backdrop-blur-xs rounded-xl px-3.5 py-2.5 border border-white/10">
                  <span className="block text-[10px] uppercase tracking-wider font-semibold text-amber-200">
                    Total Descontos
                  </span>
                  <div className="text-sm sm:text-base font-bold font-mono text-white mt-0.5">
                    {formatCurrency(faturasResumoTotais.totalDesc)}
                  </div>
                </div>

                {/* Total IVA */}
                <div className="bg-white/10 backdrop-blur-xs rounded-xl px-3.5 py-2.5 border border-white/10">
                  <span className="block text-[10px] uppercase tracking-wider font-semibold text-sky-200">
                    Total IVA
                  </span>
                  <div className="text-sm sm:text-base font-bold font-mono text-white mt-0.5">
                    {formatCurrency(faturasResumoTotais.totalIva)}
                  </div>
                </div>

                {/* Total Líquido */}
                <div className="bg-white/15 backdrop-blur-md rounded-xl px-4 py-2.5 border border-lime-400/40 shadow-inner">
                  <span className="block text-[10px] uppercase tracking-wider font-bold text-lime-300">
                    Total Líquido
                  </span>
                  <div className="text-base sm:text-lg font-extrabold font-mono text-white mt-0.5">
                    {formatCurrency(faturasResumoTotais.totalLiquido)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela das Linhas da Tabela Faturas */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/20 gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold font-headline text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">receipt</span>
                  Lista de Faturas do Cliente
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Clique na referência do documento para consultar todos os detalhes de faturação e entrega
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-secondary-container text-on-secondary-container">
                  {filteredFaturas.length} fatura(s) • Líquido: {formatCurrency(faturasResumoTotais.totalLiquido)}
                </span>
              </div>
            </div>

            {filteredFaturas.length > 0 ? (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Ref. Documento</th>
                      <th className="py-2.5 px-2 text-center">Tipo</th>
                      <th className="py-2.5 px-2.5">Data</th>
                      {isManagerOrAdmin && <th className="py-2.5 px-2.5">Cliente</th>}
                      <th className="py-2.5 px-2.5">Entidade</th>
                      <th className="py-2.5 px-3">Nome / Destinatário</th>
                      <th className="py-2.5 px-2.5">NIF</th>
                      <th className="py-2.5 px-3">Localidade</th>
                      <th className="py-2.5 px-2.5">Requisição</th>
                      <th className="py-2.5 px-3 text-right">Total Merc.</th>
                      <th className="py-2.5 px-3 text-right">Total Desc.</th>
                      <th className="py-2.5 px-3 text-right">Total IVA</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Total Líquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {filteredFaturas.map((f, idx) => {
                      const merc = Number(f.total_merc) || 0;
                      const desc = Number(f.total_desc) || 0;
                      const iva = Number(f.total_iva) || 0;
                      const liq = merc - iva - desc;
                      const tipoUpper = (f.tipo_doc || '').toUpperCase();

                      return (
                        <tr
                          key={`${f.documento_ref}_${idx}`}
                          className="hover:bg-emerald-50/80 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-secondary whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedModalFatura(f)}
                              className="hover:underline cursor-pointer focus:outline-none text-left"
                              title="Ver detalhes completos da fatura"
                            >
                              {f.documento_ref || f.documento}
                            </button>
                          </td>
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase shadow-2xs ${
                                tipoUpper.startsWith('NC')
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              }`}
                            >
                              {tipoUpper || '-'}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 font-mono text-on-surface-variant whitespace-nowrap">
                            {formatDate(f.data)}
                          </td>
                          {isManagerOrAdmin && (
                            <td className="py-2.5 px-2.5 whitespace-nowrap">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                                {f.cliente_sigla || f.sigla || '-'}
                              </span>
                            </td>
                          )}
                          <td className="py-2.5 px-2.5 font-mono text-slate-700 whitespace-nowrap">
                            {f.entidade || '-'}
                          </td>
                          <td
                            className="py-2.5 px-3 font-medium max-w-[230px] truncate"
                            title={f.nome || f.nome_entrega || '-'}
                          >
                            {f.nome || f.nome_entrega || '-'}
                          </td>
                          <td className="py-2.5 px-2.5 font-mono text-on-surface-variant whitespace-nowrap">
                            {f.num_contribuinte || '-'}
                          </td>
                          <td
                            className="py-2.5 px-3 text-on-surface-variant max-w-[160px] truncate"
                            title={f.localidade || f.cod_postal_localidade || f.localidade_entrega || '-'}
                          >
                            {f.localidade || f.cod_postal_localidade || f.localidade_entrega || '-'}
                          </td>
                          <td className="py-2.5 px-2.5 font-mono text-on-surface-variant whitespace-nowrap">
                            {f.requisicao || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800 whitespace-nowrap">
                            {formatCurrency(merc)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-amber-800 whitespace-nowrap">
                            {formatCurrency(desc)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                            {formatCurrency(iva)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-sermail-green-dark whitespace-nowrap">
                            {formatCurrency(liq)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-emerald-50/90 border-t-2 border-emerald-200 text-slate-900 font-bold text-xs">
                    <tr>
                      <td
                        colSpan={isManagerOrAdmin ? 9 : 8}
                        className="py-3 px-3 text-right uppercase tracking-wider text-[11px] text-emerald-950"
                      >
                        Totais ({filteredFaturas.length} documentos):
                      </td>
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        {formatCurrency(faturasResumoTotais.totalMerc)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-900 whitespace-nowrap">
                        {formatCurrency(faturasResumoTotais.totalDesc)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                        {formatCurrency(faturasResumoTotais.totalIva)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-sm text-sermail-green whitespace-nowrap">
                        {formatCurrency(faturasResumoTotais.totalLiquido)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-on-surface-variant border border-dashed border-outline-variant/40 rounded-xl">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">receipt</span>
                <p className="text-sm font-medium">
                  Nenhuma fatura encontrada para os filtros selecionados.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'por_artigo' ? (
        /* =========================================================
           ABA 2: LISTAGEM POR ARTIGO SELECIONADO + TOTAL NO PERÍODO
           ========================================================= */
        <div className="space-y-5">
          {/* Painel de Filtros da Aba Listagem por Artigo */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-sermail-green">
                  <span className="material-symbols-outlined text-lg">filter_alt</span>
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    Filtro de Pesquisa por Artigo e Período Temporal
                  </h2>
                  <p className="text-xs text-slate-500">
                    Selecione o artigo e defina o intervalo temporal para consultar os movimentos e o total movimentado
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {hasTabArtigoActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearTabArtigoFilters}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-lime-400 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                    Limpar Filtros
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={artigoMovimentosList.length === 0}
                  className="px-4 py-2 bg-white border border-lime-400 text-slate-800 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none font-semibold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-sermail-green">download</span>
                  {t.common.export} CSV
                </button>
              </div>
            </div>

            {/* Filtro de Cliente (Exclusivo para Administrador e Gestor) */}
            {isManagerOrAdmin && (
              <div className="pb-3 border-b border-slate-100">
                <div className="max-w-sm">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-sermail-green">business</span>
                    {t.historico.filterClient}
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green cursor-pointer"
                  >
                    <option value="todos">{t.historico.allClients}</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.sigla} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Linha Principal de Filtros Alinhados (Artigo, Período Temporal e Tipo de Movimento) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* 1. Filtro de Artigo (Pesquisa Rápida + Selector de Artigo) */}
              <div className="md:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-sermail-green">inventory_2</span>
                    Artigo Selecionado
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    {filteredArtigosOptions.length} artigo(s) disponíveis
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <div className="relative sm:col-span-2">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      search
                    </span>
                    <input
                      type="text"
                      value={artigoSearchQuery}
                      onChange={(e) => setArtigoSearchQuery(e.target.value)}
                      placeholder="Filtrar código/nome..."
                      className="w-full h-9 pl-8 pr-7 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                    />
                    {artigoSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setArtigoSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    )}
                  </div>

                  <div className="sm:col-span-3">
                    <select
                      value={tabArtigoSelected}
                      onChange={(e) => setTabArtigoSelected(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green cursor-pointer"
                    >
                      <option value="todos">
                        -- Selecionar Artigo ({filteredArtigosOptions.length}) --
                      </option>
                      {filteredArtigosOptions.map((art) => (
                        <option key={art.codigo} value={art.codigo}>
                          {art.codigo} - {art.descricao}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Filtro de Período Temporal (Predefinição + Intervalo De / Até) */}
              <div className="md:col-span-5">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-sermail-green">calendar_month</span>
                  Período Temporal de Pesquisa
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <select
                      value={tabArtigoPeriod}
                      onChange={(e) => handleTabArtigoPeriodChange(e.target.value as DateFilterType)}
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
                    >
                      <option value="todos">Todo o Histórico</option>
                      <option value="hoje">Hoje</option>
                      <option value="7dias">Últimos 7 dias</option>
                      <option value="30dias">Últimos 30 dias</option>
                      <option value="este_mes">Este Mês</option>
                      <option value="este_ano">Este Ano</option>
                      <option value="personalizado">Personalizado</option>
                    </select>
                  </div>

                  <div className="relative">
                    <input
                      type="date"
                      value={tabArtigoDateFrom}
                      onChange={(e) => {
                        setTabArtigoDateFrom(e.target.value);
                        setTabArtigoPeriod('personalizado');
                      }}
                      title="Data de Início (De)"
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                    <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold uppercase text-slate-400">
                      De
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="date"
                      value={tabArtigoDateTo}
                      onChange={(e) => {
                        setTabArtigoDateTo(e.target.value);
                        setTabArtigoPeriod('personalizado');
                      }}
                      title="Data de Fim (Até)"
                      className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green"
                    />
                    <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold uppercase text-slate-400">
                      Até
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Filtro de Tipo de Movimento (Alinhado na mesma linha) */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-sermail-green">swap_vert</span>
                  Tipo Movimento
                </label>
                <select
                  value={tabArtigoTipoMov}
                  onChange={(e) => setTabArtigoTipoMov(e.target.value)}
                  className="w-full h-9 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
                >
                  <option value="todos">Todos (ES/ET/SS/ST)</option>
                  <option value="ss">Saída Stock (SS)</option>
                  <option value="es">Entrada Stock (ES)</option>
                  <option value="et">Entrada Transf. (ET)</option>
                  <option value="st">Saída Transf. (ST)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Janela com o Total do Artigo no Período Temporal */}
          <div className="bg-gradient-to-br from-emerald-950 via-sermail-green-dark to-[#004d3b] text-white rounded-2xl p-5 sm:p-6 shadow-md border border-emerald-800/40 relative overflow-hidden">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              {/* Identificação do Artigo e Período */}
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-lime-400/20 text-lime-300 border border-lime-400/30">
                    Resumo do Período Temporal
                  </span>
                  <span className="text-xs text-emerald-200 font-mono flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">date_range</span>
                    {tabArtigoDateFrom || tabArtigoDateTo
                      ? `${tabArtigoDateFrom ? formatDate(tabArtigoDateFrom) : 'Início'} até ${tabArtigoDateTo ? formatDate(tabArtigoDateTo) : 'Hoje'
                      }`
                      : 'Todo o período disponível'}
                  </span>
                </div>

                {selectedArtigoInfo ? (
                  <div>
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-white/15 font-mono font-bold text-sm sm:text-base text-lime-300 border border-white/10">
                        {selectedArtigoInfo.codigo}
                      </span>
                      <h3 className="text-base sm:text-xl font-bold font-headline text-white truncate">
                        {selectedArtigoInfo.descricao}
                      </h3>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-base sm:text-lg font-bold font-headline text-white">
                      Todos os Artigos Movimentados ({availableArtigos.length} artigos)
                    </h3>
                    <p className="text-xs text-emerald-200/90">
                      Selecione um artigo específico no filtro acima para isolar o total e os movimentos desse artigo.
                    </p>
                  </div>
                )}
              </div>

              {/* Cartões de Totais do Artigo no Período */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                {/* Total Geral do Artigo no Período (Destaque Principal) */}
                <div className="bg-white/15 backdrop-blur-md rounded-xl px-4 py-3 border border-lime-400/40 shadow-inner">
                  <span className="block text-[10px] uppercase tracking-wider font-bold text-lime-300">
                    Total no Período
                  </span>
                  <div className="text-xl sm:text-2xl font-extrabold font-mono text-white mt-0.5">
                    {artigoResumoTotais.totalUnidades.toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')}{' '}
                    <span className="text-xs font-normal text-lime-200">un</span>
                  </div>
                  <span className="text-[10px] text-emerald-200">
                    {artigoResumoTotais.numMovimentos} linha(s) de mov.
                  </span>
                </div>

                {/* Total Saídas (SS) */}
                <div className="bg-white/10 backdrop-blur-xs rounded-xl px-3.5 py-3 border border-white/10">
                  <span className="block text-[10px] uppercase tracking-wider font-semibold text-rose-200">
                    Saídas (SS)
                  </span>
                  <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                    {artigoResumoTotais.totalSaidas.toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')}{' '}
                    <span className="text-[10px] font-normal text-emerald-200">un</span>
                  </div>
                  <span className="text-[10px] text-emerald-200/80">Expedições / Pedidos</span>
                </div>

                {/* Total Entradas (ES) */}
                <div className="bg-white/10 backdrop-blur-xs rounded-xl px-3.5 py-3 border border-white/10">
                  <span className="block text-[10px] uppercase tracking-wider font-semibold text-emerald-200">
                    Entradas (ES)
                  </span>
                  <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
                    {artigoResumoTotais.totalEntradas.toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')}{' '}
                    <span className="text-[10px] font-normal text-emerald-200">un</span>
                  </div>
                  <span className="text-[10px] text-emerald-200/80">Receções de Stock</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Listagem de Movimentos do Artigo */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/20 gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold font-headline text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">list_alt</span>
                  Listagem de Movimentos por Artigo
                </h2>
                <p className="text-xs text-on-surface-variant">
                  {selectedArtigoInfo
                    ? `Movimentos registados para o artigo ${selectedArtigoInfo.codigo} - ${selectedArtigoInfo.descricao}`
                    : 'A mostrar todas as linhas de movimento no período selecionado (utilize o seletor de artigo para filtrar um único artigo)'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-secondary-container text-on-secondary-container">
                  {artigoMovimentosList.length} registo(s) • Total:{' '}
                  {artigoResumoTotais.totalUnidades.toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')} un
                </span>
              </div>
            </div>

            {artigoMovimentosList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Documento</th>
                      <th className="py-2.5 px-2.5 text-center">Mov.</th>
                      <th className="py-2.5 px-3">Data</th>
                      {isManagerOrAdmin && <th className="py-2.5 px-2.5">Cliente</th>}
                      <th className="py-2.5 px-3">Artigo</th>
                      <th className="py-2.5 px-3">Descrição</th>
                      <th className="py-2.5 px-3">Lote</th>
                      <th className="py-2.5 px-3">Validade</th>
                      <th className="py-2.5 px-3">Destinatário / Origem</th>
                      <th className="py-2.5 px-3">Localidade</th>
                      <th className="py-2.5 px-3">Requisição</th>
                      <th className="py-2.5 px-2.5 text-center">Estado</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {artigoMovimentosList.map((row) => (
                      <tr key={row.id} className="hover:bg-emerald-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-secondary whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedModalPedido(row.pedido)}
                            className="hover:underline cursor-pointer focus:outline-none"
                            title="Ver detalhes do documento"
                          >
                            {row.nr_pedido}
                          </button>
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          {row.tipo_movimento ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-primary text-on-primary uppercase shadow-sm">
                              {row.tipo_movimento}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-outline-variant/30 text-on-surface-variant uppercase">
                              -
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-on-surface-variant whitespace-nowrap">
                          {formatDate(row.data_pedido)}
                        </td>
                        {isManagerOrAdmin && (
                          <td className="py-2.5 px-2.5">
                            {row.cliente_sigla ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                                {row.cliente_sigla}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                        )}
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setTabArtigoSelected(row.artigo_id)}
                            className="hover:text-sermail-green hover:underline cursor-pointer"
                            title="Filtrar apenas este artigo"
                          >
                            {row.artigo_id}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-medium max-w-[220px] truncate" title={row.descricao}>
                          {row.descricao}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-secondary whitespace-nowrap">
                          {row.lote || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-on-surface-variant whitespace-nowrap">
                          {formatDate(row.validade)}
                        </td>
                        <td className="py-2.5 px-3 font-medium max-w-[200px] truncate" title={row.destinatario || '-'}>
                          {row.destinatario || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-on-surface-variant whitespace-nowrap">
                          {row.localidade || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-on-surface-variant whitespace-nowrap">
                          {row.requisicao || '-'}
                        </td>
                        <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                          <span className="font-bold text-[10px] uppercase text-secondary">
                            {getStatusLabel(row.status)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-secondary whitespace-nowrap">
                          {row.quantidade.toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')} un
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-emerald-50/90 border-t-2 border-emerald-200 text-slate-900 font-bold text-xs">
                    <tr>
                      <td
                        colSpan={isManagerOrAdmin ? 12 : 11}
                        className="py-3 px-3 text-right uppercase tracking-wider text-[11px] text-emerald-950"
                      >
                        Total do Artigo no Período Selecionado ({artigoMovimentosList.length} movimentos):
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-sm text-sermail-green whitespace-nowrap">
                        {artigoResumoTotais.totalUnidades.toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')} un
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-on-surface-variant border border-dashed border-outline-variant/40 rounded-xl">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">inventory_2</span>
                <p className="text-sm font-medium">
                  Nenhum movimento encontrado para o artigo e período temporal selecionados.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Painel de Filtros e Busca Sermail */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Barra de Pesquisa */}
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t.historico.searchPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300/80 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>

              {/* Botões de Ação e Alternador de Vista */}
              <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap sm:flex-nowrap">
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-lime-400 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                    {language === 'pt' ? 'Limpar Filtros' : language === 'es' ? 'Limpiar Filtros' : 'Clear Filters'}
                  </button>
                )}

                {/* Alternador de Vista (Tabela vs Linhas) */}
                <div className="flex items-center gap-1 bg-slate-100/80 rounded-xl p-1 border border-lime-400">
                  <button
                    onClick={() => setViewMode('tabela')}
                    title={t.historico.viewTable}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-lime-400 transition-all cursor-pointer ${viewMode === 'tabela'
                      ? 'bg-sermail-green text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    <span className={`material-symbols-outlined text-sm ${viewMode === 'tabela' ? 'text-sermail-lime-border' : 'text-slate-400'}`}>table_rows</span>
                    <span className="hidden sm:inline">{t.historico.viewTable}</span>
                  </button>
                  <button
                    onClick={() => setViewMode('detalhado')}
                    title={t.historico.viewCards}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-lime-400 transition-all cursor-pointer ${viewMode === 'detalhado'
                      ? 'bg-sermail-green text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    <span className={`material-symbols-outlined text-sm ${viewMode === 'detalhado' ? 'text-sermail-lime-border' : 'text-slate-400'}`}>view_agenda</span>
                    <span className="hidden sm:inline">{t.historico.viewCards}</span>
                  </button>
                </div>

                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2.5 bg-white border border-lime-400 text-slate-800 hover:bg-slate-50 font-semibold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-sermail-green">download</span>
                  {t.common.export} CSV
                </button>
              </div>
            </div>

            {/* Linha de Filtros Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-3 border-t border-slate-100">
                {/* Filtro Cliente (Apenas se Admin/Gestor) */}
                {isManagerOrAdmin ? (
                    <div className="lg:col-span-4">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        {t.historico.filterClient}
                      </label>
                      <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer"
                      >
                        <option value="todos">{t.historico.allClients}</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.sigla} - {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    ) : (
                      <div className="lg:col-span-4">
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          {t.historico.filterClient}
                        </label>
                        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-sermail-green">
                          {currentUserProfile?.empresa || t.common.client}
                        </div>
                      </div>
          )}

                          {/* Filtro Tipo Movimento (Reduzido para 1/2: lg:col-span-1) */}
                          <div className="lg:col-span-1">
                            <label className="block text-[11px] font-semibold text-on-surface-variant mb-1 truncate">
                              Movimento
                            </label>
                            <select
                              value={selectedTipoMov}
                              onChange={(e) => setSelectedTipoMov(e.target.value)}
                              className="w-full px-2 py-2 bg-surface border border-outline-variant/30 rounded-xl text-xs font-medium text-on-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all hover:bg-surface-container/30 cursor-pointer"
                            >
                              <option value="todos">Todos</option>
                              <option value="es">ES</option>
                              <option value="et">ET</option>
                              <option value="ss">SS</option>
                              <option value="st">ST</option>
                            </select>
                          </div>

                          {/* Filtro Estado */}
                            <div className="lg:col-span-2">
                              <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                                {t.historico.filterStatus}
                              </label>
                              <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="w-full px-3 py-2 bg-surface border border-outline-variant/40 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
                              >
                                <option value="todos">{t.historico.allStatuses}</option>
                                {availableStatuses.map((status) => (
                                  <option key={status} value={status}>
                                    {getStatusLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </div>

                              {/* Filtro Destino (Aumentado com o espaço reduzido do filtro Movimento: lg:col-span-3) */}
                              <div className="lg:col-span-3">
                                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                                  {t.historico.colDestination || 'Destino'}
                                </label>
                                <select
                                  value={selectedDestino}
                                  onChange={(e) => setSelectedDestino(e.target.value)}
                                  className="w-full px-3 py-2 bg-surface border border-outline-variant/40 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
                                >
                                  <option value="todos">Todos os Destinos ({availableDestinos.length})</option>
                                  {availableDestinos.map((dest) => (
                                    <option key={dest} value={dest}>
                                      {dest}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Filtro Período */}
                                <div className="lg:col-span-2">
                                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                                    {t.historico.filterDate}
                                  </label>
                                  <select
                                    value={selectedDateFilter}
                                    onChange={(e) => setSelectedDateFilter(e.target.value as DateFilterType)}
                                    className="w-full px-3 py-2 bg-surface border border-outline-variant/40 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
                                  >
                                    <option value="todos">{t.historico.allPeriods}</option>
                                    <option value="hoje">{t.historico.periodToday}</option>
                                    <option value="7dias">{t.historico.period7Days}</option>
                                    <option value="30dias">{t.historico.period30Days}</option>
                                    <option value="este_mes">{t.historico.periodThisMonth}</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            {/* Lista de Pedidos */}
                            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-outline-variant/20 gap-2">
                                <div>
                                  <h2 className="text-xl font-bold font-headline text-on-surface flex items-center gap-2">
                                    <span className="material-symbols-outlined text-secondary">receipt_long</span>
                                    {t.historico.bannerTitle}
                                  </h2>
                                  <p className="text-xs text-on-surface-variant mt-0.5">
                                    {t.historico.bannerSubtitle}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-secondary-container text-on-secondary-container">
                                    {filteredPedidos.length} {t.historico.totalOrders} (
                                    {totalUnidadesFiltradas.toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')} un)
                                  </span>
                                </div>
                              </div>

                              {filteredPedidos.length > 0 ? (
                                viewMode === 'detalhado' ? (
                                  /* Vista Detalhada em Cards */
                                  <div className="space-y-4">
                                    {filteredPedidos.map((ped) => {
                                      const totalQtd =
                                        ped.pedido_linhas?.reduce((acc, l) => acc + Number(l.quantidade || 0), 0) || 0;

                                      return (
                                        <div
                                          key={ped.id}
                                          className="border border-outline-variant/30 rounded-xl p-5 bg-surface transition-all space-y-4 shadow-sm"
                                        >
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                              <span
                                                className="inline-block px-2.5 py-1 bg-secondary text-on-secondary rounded-lg font-mono font-bold text-xs shadow-sm cursor-pointer hover:bg-secondary/80"
                                                onClick={() => setSelectedModalPedido(ped)}
                                              >
                                                {ped.nr_pedido}
                                              </span>
                                              {ped.tipo_movimento && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary text-on-primary uppercase shadow-sm">
                                                  {ped.tipo_movimento}
                                                </span>
                                              )}
                                              <span className="font-semibold text-sm text-on-surface">
                                                {(ped.nome_destinatario || ped.destinos?.nome || '')}
                                              </span>
                                              {(ped.classifica_destino || ped.destinos?.classifica_destino) && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                                  {ped.classifica_destino || ped.destinos?.classifica_destino}
                                                </span>
                                              )}
                                              {ped.clients?.sigla && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                                                  {ped.clients.sigla}
                                                </span>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-3">
                                              {/* Gestão de Estado */}
                                              <div className="flex items-center gap-1">
                                                <span className="font-bold text-[11px] uppercase text-secondary bg-secondary/10 px-2 py-1 rounded-md">
                                                  {getStatusLabel(ped.status)}
                                                </span>
                                                {(String(getStatusLabel(ped.status)).toLowerCase() === 'entregue' || String(getStatusLabel(ped.status)).toLowerCase() === 'entregue pda') && (ped as any).url_comprovativo && (
                                                  <button
                                                    onClick={() => handleViewComprovativo((ped as any).url_comprovativo, (ped as any).ref_ser || ped.nr_pedido)}
                                                    className="bg-secondary/10 text-secondary hover:bg-secondary/20 hover:text-secondary-dark border border-lime-400 transition-colors px-2 py-1 rounded text-xs font-semibold flex items-center justify-center gap-1"
                                                    title="Ver Comprovativo"
                                                  >
                                                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                    Ver
                                                  </button>
                                                )}
                                              </div>

                                              <span className="text-xs text-on-surface-variant font-mono">
                                                {formatDate(ped.data_pedido)}
                                              </span>

                                              {isManagerOrAdmin && (
                                                <button
                                                  type="button"
                                                  onClick={() => setPedidoToDelete(ped)}
                                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-lime-400 transition-colors cursor-pointer"
                                                  title={
                                                    language === 'pt'
                                                      ? 'Apagar movimento e linhas associadas'
                                                      : 'Delete movement and associated lines'
                                                  }
                                                >
                                                  <span className="material-symbols-outlined text-[14px]">delete</span>
                                                  {language === 'pt' ? 'Apagar' : 'Delete'}
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          {/* Destino & Info */}
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-surface-container/40 p-3.5 rounded-lg border border-outline-variant/20">
                                            <div>
                                              <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">
                                                {t.pedidos.address}
                                              </span>
                                              <span className="text-on-surface font-medium">
                                                {ped.morada}, {ped.codigo_postal} {ped.localidade} (
                                                {ped.pais || 'Portugal'})
                                              </span>
                                            </div>
                                            <div>
                                              <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">
                                                {t.pedidos.docRef}
                                              </span>
                                              <span className="text-on-surface font-mono font-medium">
                                                {(ped.requisicao || ped.ref_documento) || 'N/A'}
                                              </span>
                                            </div>
                                            <div>
                                              <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">
                                                {t.pedidos.deliveryDate}
                                              </span>
                                              <span className="text-on-surface font-mono font-medium">
                                                {ped.data_entrega ? formatDate(ped.data_entrega) : (language === 'pt' ? 'Imediata' : language === 'es' ? 'Inmediata' : 'Immediate')}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Linhas do Pedido */}
                                          {ped.pedido_linhas && ped.pedido_linhas.length > 0 && (
                                            <div className="overflow-x-auto">
                                              <table className="w-full text-left text-xs">
                                                <thead className="text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold bg-surface-container/60">
                                                  <tr>
                                                    <th className="py-2 px-3 rounded-l-md">{t.pedidos.tableArticle}</th>
                                                    <th className="py-2 px-3">{t.common.description}</th>
                                                    <th className="py-2 px-3">{t.pedidos.tableBatch}</th>
                                                    <th className="py-2 px-3">{t.pedidos.tableExpiry}</th>
                                                    <th className="py-2 px-3 text-right rounded-r-md">{t.pedidos.tableQty}</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                                                  {ped.pedido_linhas.map((linha, lIdx) => (
                                                    <tr key={lIdx} className="hover:bg-emerald-100/70 transition-colors">
                                                      <td className="py-2 px-3 font-mono font-medium">
                                                        {linha.artigo_id || linha.artigo_cli || linha.artigo_codigo}
                                                      </td>
                                                      <td className="py-2 px-3 font-medium">{linha.descricao}</td>
                                                      <td className="py-2 px-3 font-mono font-semibold text-secondary">
                                                        {linha.lote}
                                                      </td>
                                                      <td className="py-2 px-3 font-mono text-on-surface-variant">
                                                        {formatDate(linha.validade)}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">
                                                        {Math.abs(Number(linha.quantidade)).toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')}{' '}
                                                        <span className="text-[10px] font-normal text-on-surface-variant">
                                                          un
                                                        </span>
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}

                                          <div className="flex items-center justify-between text-xs text-on-surface-variant pt-2 border-t border-outline-variant/10">
                                            <span>
                                              {ped.observacoes
                                                ? `${t.pedidos.notes}: ${ped.observacoes}`
                                                : (language === 'pt' ? 'Sem observações adicionais' : language === 'es' ? 'Sin observaciones adicionales' : 'No additional notes')}
                                            </span>
                                            <span className="font-semibold text-on-surface">
                                              {t.historico.colTotalQty}:{' '}
                                              <strong className="text-secondary font-mono text-sm">
                                                {totalQtd.toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')} un
                                              </strong>
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  /* Vista Tabela Compacta */
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                                        <tr>
                                          <th className="py-2.5 px-3 rounded-l-lg">{t.historico.colOrderNumber}</th>
                                          <th className="py-2.5 px-3 text-center">{t.historico.colTipoMovimento || 'Movimento'}</th>
                                          <th className="py-2.5 px-3">{t.historico.colDate}</th>

                                          <th className="py-2.5 px-3">{t.historico.colDestination}</th>
                                          <th className="py-2.5 px-3">Morada</th>
                                          <th className="py-2.5 px-3">Cod_Postal</th>
                                          <th className="py-2.5 px-3">Localidade</th>
                                          <th className="py-2.5 px-3">Requisição</th>
                                          <th className="py-2.5 px-3 text-center">{t.historico.colLines}</th>
                                          <th className="py-2.5 px-3 text-right">{t.historico.colTotalQty}</th>
                                          <th className="py-2.5 px-3 text-center">{t.historico.colStatus}</th>
                                          <th className={`py-2.5 px-3 text-center ${!isManagerOrAdmin ? 'rounded-r-lg' : ''}`}>Comprovativo</th>
                                          {isManagerOrAdmin && (
                                            <th className="py-2.5 px-3 text-center rounded-r-lg">
                                              {language === 'pt' ? 'Ações' : language === 'es' ? 'Acciones' : 'Actions'}
                                            </th>
                                          )}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                                        {filteredPedidos.map((ped) => {
                                          const totalQtd =
                                            ped.pedido_linhas?.reduce((acc, l) => acc + Number(l.quantidade || 0), 0) || 0;

                                          return (
                                            <tr key={ped.id} className="hover:bg-emerald-50 transition-colors">
                                              <td className="py-3 px-3 font-mono font-bold text-secondary">
                                                <button
                                                  onClick={() => setSelectedModalPedido(ped)}
                                                  className="hover:underline cursor-pointer focus:outline-none"
                                                  title="Ver detalhes do documento"
                                                >
                                                  {ped.nr_pedido}
                                                </button>
                                              </td>
                                              <td className="py-3 px-3 text-center">
                                                {ped.tipo_movimento ? (
                                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-primary text-on-primary uppercase shadow-sm">
                                                    {ped.tipo_movimento}
                                                  </span>
                                                ) : (
                                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-outline-variant/30 text-on-surface-variant uppercase shadow-sm">
                                                    -
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-3 px-3 font-mono text-on-surface-variant">
                                                {formatDate(ped.data_pedido)}
                                              </td>

                                              <td className="py-3 px-3 font-medium">
                                                <div>{(ped.nome_destinatario || ped.destinos?.nome || '')}</div>
                                                {(ped.classifica_destino || ped.destinos?.classifica_destino) && (
                                                  <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-medium bg-primary/10 text-primary">
                                                    {ped.classifica_destino || ped.destinos?.classifica_destino}
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-3 px-3 text-on-surface-variant max-w-[200px] truncate" title={ped.morada || '-'}>{ped.morada || '-'}</td>
                                              <td className="py-3 px-3 text-on-surface-variant font-mono">{ped.cod_postal || ped.codigo_postal || '-'}</td>
                                              <td className="py-3 px-3 text-on-surface-variant">{ped.cod_postal_localidade || ped.localidade || '-'}</td>
                                              <td className="py-3 px-3 font-mono text-on-surface-variant">
                                                {(ped.requisicao || ped.ref_documento) || '-'}
                                              </td>
                                              <td className="py-3 px-3 text-center font-mono font-semibold">
                                                {ped.pedido_linhas?.length || 0}
                                              </td>
                                              <td className="py-3 px-3 text-right font-bold font-mono text-secondary">
                                                {totalQtd.toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')} un
                                              </td>
                                              <td className="py-3 px-3 text-center">
                                                <span className="font-bold text-[11px] uppercase text-secondary">
                                                  {getStatusLabel(ped.status)}
                                                </span>
                                              </td>
                                              <td className="py-3 px-3 text-center">
                                                {(String(getStatusLabel(ped.status)).toLowerCase() === 'entregue' || String(getStatusLabel(ped.status)).toLowerCase() === 'entregue pda') && (ped as any).url_comprovativo && (
                                                  <button
                                                    onClick={() => handleViewComprovativo((ped as any).url_comprovativo, (ped as any).ref_ser || ped.nr_pedido)}
                                                    className="bg-secondary/10 text-secondary hover:bg-secondary/20 hover:text-secondary-dark border border-lime-400 transition-colors px-2 py-1 rounded text-xs font-semibold flex items-center justify-center gap-1 mx-auto"
                                                    title="Ver Comprovativo"
                                                  >
                                                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                    Ver
                                                  </button>
                                                )}
                                              </td>
                                              {isManagerOrAdmin && (
                                                <td className="py-3 px-3 text-center">
                                                  <button
                                                    type="button"
                                                    onClick={() => setPedidoToDelete(ped)}
                                                    className="inline-flex items-center justify-center p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-lime-400 transition-colors cursor-pointer"
                                                    title={
                                                      language === 'pt'
                                                        ? 'Apagar movimento e linhas associadas'
                                                        : 'Delete movement and associated lines'
                                                    }
                                                  >
                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                  </button>
                                                </td>
                                              )}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )
                              ) : (
                                <div className="py-12 text-center text-on-surface-variant border border-dashed border-outline-variant/40 rounded-xl">
                                  <span className="material-symbols-outlined text-4xl text-outline mb-2">shopping_bag</span>
                                  <p className="text-sm font-medium">
                                    {t.historico.noOrdersFound}
                                  </p>
                                </div>
                              )}
                            </div>
                          </>
      )}

                          {selectedModalFatura && (() => {
                            const f = selectedModalFatura;
                            const merc = Number(f.total_merc) || 0;
                            const desc = Number(f.total_desc) || 0;
                            const iva = Number(f.total_iva) || 0;
                            const outros = Number(f.total_outros) || 0;
                            const liq = merc - iva - desc;

                            return (
                              <div
                                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                                onClick={() => setSelectedModalFatura(null)}
                              >
                                <div
                                  className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-surface rounded-2xl shadow-2xl relative border border-slate-200"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => setSelectedModalFatura(null)}
                                    className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface bg-surface-container hover:bg-surface-container-high rounded-full p-1.5 z-10 transition-colors flex items-center justify-center cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-sm">close</span>
                                  </button>

                                  <div className="p-6 md:p-8 space-y-5">
                                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
                                      <div className="flex items-center gap-2.5 flex-wrap">
                                        <span className="inline-block px-3 py-1 bg-sermail-green text-white rounded-lg font-mono font-bold text-xs shadow-xs">
                                          {f.documento_ref || f.documento}
                                        </span>
                                        {f.tipo_doc && (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-lime-200 text-emerald-950 uppercase">
                                            {f.tipo_doc} #{f.num_doc || '-'}
                                          </span>
                                        )}
                                        {(f.cliente_sigla || f.sigla) && (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                                            [{f.cliente_sigla || f.sigla}] {f.cliente_nome || f.cliente_ser || ''}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-xs font-mono font-semibold text-slate-600 pr-6">
                                        Data: {formatDate(f.data)}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2">
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-sermail-green">
                                          Dados da Entidade / Faturação
                                        </span>
                                        <div>
                                          <strong className="text-slate-600">Nome:</strong>{' '}
                                          <span className="font-semibold text-slate-900">{f.nome || '-'}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-4">
                                          <div>
                                            <strong className="text-slate-600">Entidade:</strong>{' '}
                                            <span className="font-mono">{f.entidade || '-'}</span>
                                          </div>
                                          <div>
                                            <strong className="text-slate-600">NIF:</strong>{' '}
                                            <span className="font-mono">{f.num_contribuinte || '-'}</span>
                                          </div>
                                          <div>
                                            <strong className="text-slate-600">Requisição:</strong>{' '}
                                            <span className="font-mono">{f.requisicao || '-'}</span>
                                          </div>
                                        </div>
                                        <div>
                                          <strong className="text-slate-600">Morada:</strong>{' '}
                                          <span>
                                            {f.morada || '-'}, {f.cod_postal || ''}{' '}
                                            {f.localidade || f.cod_postal_localidade || ''} ({f.pais || 'PT'})
                                          </span>
                                        </div>
                                      </div>

                                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2">
                                        <span className="block text-[10px] font-bold uppercase tracking-wider text-sermail-green">
                                          Dados de Entrega
                                        </span>
                                        <div>
                                          <strong className="text-slate-600">Destinatário Entrega:</strong>{' '}
                                          <span className="font-semibold text-slate-900">
                                            {f.nome_entrega || f.nome || '-'}
                                          </span>
                                        </div>
                                        <div>
                                          <strong className="text-slate-600">Entidade Entrega:</strong>{' '}
                                          <span className="font-mono">{f.entidade_entrega || f.entidade || '-'}</span>
                                        </div>
                                        <div>
                                          <strong className="text-slate-600">Morada Entrega:</strong>{' '}
                                          <span>
                                            {f.morada_entrega || f.morada || '-'},{' '}
                                            {f.cod_postal_entrega || f.cod_postal || ''}{' '}
                                            {f.localidade_entrega || f.cod_postal_localidade_entrega || f.localidade || ''}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 text-xs">
                                      <div>
                                        <span className="block text-[10px] uppercase font-bold text-slate-500">
                                          Total Mercadoria
                                        </span>
                                        <span className="font-mono font-bold text-sm text-slate-900">
                                          {formatCurrency(merc)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="block text-[10px] uppercase font-bold text-amber-800">
                                          Total Desconto
                                        </span>
                                        <span className="font-mono font-bold text-sm text-amber-900">
                                          {formatCurrency(desc)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="block text-[10px] uppercase font-bold text-slate-500">
                                          Total IVA
                                        </span>
                                        <span className="font-mono font-bold text-sm text-slate-900">
                                          {formatCurrency(iva)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="block text-[10px] uppercase font-bold text-slate-500">
                                          Total Outros
                                        </span>
                                        <span className="font-mono font-bold text-sm text-slate-900">
                                          {formatCurrency(outros)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="block text-[10px] uppercase font-bold text-sermail-green">
                                          Total Líquido
                                        </span>
                                        <span className="font-mono font-extrabold text-sm text-sermail-green-dark">
                                          {formatCurrency(liq)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {selectedModalPedido && (() => {
                            const ped = selectedModalPedido;
                            const totalQtd = ped.pedido_linhas?.reduce((acc, l) => acc + Number(l.quantidade || 0), 0) || 0;

                            return (
                              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedModalPedido(null)}>
                                <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-surface rounded-xl shadow-2xl relative" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => setSelectedModalPedido(null)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface bg-surface-container hover:bg-surface-container-high rounded-full p-1.5 z-10 transition-colors flex items-center justify-center">
                                    <span className="material-symbols-outlined text-sm">close</span>
                                  </button>
                                  <div className="p-6 md:p-8 space-y-5">
                                    {/* Header do Card */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                      <div className="flex items-center gap-3">
                                        <span className="inline-block px-2.5 py-1 bg-secondary text-on-secondary rounded-lg font-mono font-bold text-xs shadow-sm">
                                          {ped.nr_pedido}
                                        </span>
                                        {ped.tipo_movimento && (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary text-on-primary uppercase shadow-sm">
                                            {ped.tipo_movimento}
                                          </span>
                                        )}
                                        <span className="font-semibold text-sm text-on-surface">
                                          {(ped.nome_destinatario || ped.destinos?.nome || '')}
                                        </span>
                                        {(ped.classifica_destino || ped.destinos?.classifica_destino) && (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                            {ped.classifica_destino || ped.destinos?.classifica_destino}
                                          </span>
                                        )}
                                        {ped.clients?.sigla && (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                                            {ped.clients.sigla}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <span className="font-bold text-[11px] uppercase text-secondary bg-secondary/10 px-2 py-1 rounded-md">
                                          {getStatusLabel(ped.status)}
                                        </span>
                                        {(String(getStatusLabel(ped.status)).toLowerCase() === 'entregue' || String(getStatusLabel(ped.status)).toLowerCase() === 'entregue pda') && (ped as any).url_comprovativo && (
                                          <button
                                            onClick={() => handleViewComprovativo((ped as any).url_comprovativo, (ped as any).ref_ser || ped.nr_pedido)}
                                            className="bg-secondary/10 text-secondary hover:bg-secondary/20 hover:text-secondary-dark transition-colors px-2 py-1 rounded text-xs font-semibold flex items-center justify-center gap-1"
                                            title="Ver Comprovativo"
                                          >
                                            <span className="material-symbols-outlined text-[14px]">visibility</span>
                                            Ver
                                          </button>
                                        )}

                                        <span className="text-xs text-on-surface-variant font-mono">
                                          {formatDate(ped.data_pedido)}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Destino & Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-surface-container/40 p-4 rounded-lg border border-outline-variant/20">
                                      <div>
                                        <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">
                                          {t.pedidos.address}
                                        </span>
                                        <span className="text-on-surface font-medium">
                                          {ped.morada}, {ped.codigo_postal} {ped.localidade} ({ped.pais || 'Portugal'})
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">
                                          {t.pedidos.docRef}
                                        </span>
                                        <span className="text-on-surface font-mono font-medium">
                                          {(ped.requisicao || ped.ref_documento) || 'N/A'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">
                                          {t.pedidos.deliveryDate}
                                        </span>
                                        <span className="text-on-surface font-mono font-medium">
                                          {ped.data_entrega ? formatDate(ped.data_entrega) : (language === 'pt' ? 'Imediata' : language === 'es' ? 'Inmediata' : 'Immediate')}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Linhas do Pedido */}
                                    {ped.pedido_linhas && ped.pedido_linhas.length > 0 && (
                                      <div className="overflow-x-auto overflow-y-auto max-h-[40vh] border border-outline-variant/20 rounded-lg custom-scrollbar">
                                        <table className="w-full text-left text-xs relative">
                                          <thead className="text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold bg-surface-container/95 backdrop-blur sticky top-0 z-10 shadow-sm">
                                            <tr>
                                              <th className="py-2.5 px-3 rounded-tl-lg">{t.pedidos.tableArticle}</th>
                                              <th className="py-2.5 px-3">{t.common.description}</th>
                                              <th className="py-2.5 px-3">{t.pedidos.tableBatch}</th>
                                              <th className="py-2.5 px-3">{t.pedidos.tableExpiry}</th>
                                              <th className="py-2.5 px-3 text-right rounded-tr-lg">{t.pedidos.tableQty}</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                                            {ped.pedido_linhas.map((linha, lIdx) => (
                                              <tr key={lIdx} className="hover:bg-emerald-100/70 transition-colors">
                                                <td className="py-2.5 px-3 font-mono font-medium">{linha.artigo_id || linha.artigo_cli || linha.artigo_codigo}</td>
                                                <td className="py-2.5 px-3 font-medium">{linha.descricao}</td>
                                                <td className="py-2.5 px-3 font-mono font-semibold text-secondary">{linha.lote}</td>
                                                <td className="py-2.5 px-3 font-mono text-on-surface-variant">{formatDate(linha.validade)}</td>
                                                <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                                                  {Math.abs(Number(linha.quantidade)).toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')}{' '}
                                                  <span className="text-[10px] font-normal text-on-surface-variant">un</span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between text-xs text-on-surface-variant pt-3 border-t border-outline-variant/10">
                                      <span>
                                        {ped.observacoes ? `${t.pedidos.notes}: ${ped.observacoes}` : (language === 'pt' ? 'Sem observações adicionais' : language === 'es' ? 'Sin observaciones adicionales' : 'No additional notes')}
                                      </span>
                                      <span className="font-semibold text-on-surface">
                                        {t.historico.colTotalQty}:{' '}
                                        <strong className="text-secondary font-mono text-sm">
                                          {totalQtd.toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')} un
                                        </strong>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Modal Visualizador do Comprovativo TIFF convertido para PNG */}
                          {(isLoadingComprovativo || comprovativoImage) && (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => !isLoadingComprovativo && setComprovativoImage(null)}>
                              <div className="relative w-full max-w-5xl max-h-[95vh] bg-surface rounded-xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between p-4 border-b border-outline-variant/20 bg-surface-container">
                                  <h3 className="font-bold text-on-surface">Visualizar Comprovativo</h3>
                                  <button
                                    onClick={() => { setComprovativoImage(null); setIsLoadingComprovativo(false); }}
                                    className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full p-2 transition-colors flex items-center justify-center"
                                  >
                                    <span className="material-symbols-outlined">close</span>
                                  </button>
                                </div>

                                <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-surface-container-lowest min-h-[50vh]">
                                  {isLoadingComprovativo ? (
                                    <div className="flex flex-col items-center justify-center gap-4 text-primary">
                                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                                      <p className="font-medium animate-pulse">A processar ficheiro TIFF...</p>
                                    </div>
                                  ) : comprovativoImage ? (
                                    <img
                                      src={comprovativoImage}
                                      alt="Comprovativo"
                                      className="max-w-full max-h-[80vh] object-contain border border-outline-variant/30 rounded shadow-md"
                                    />
                                  ) : null}
                                </div>
                                {comprovativoImage && (
                                  <div className="p-4 border-t border-outline-variant/20 bg-surface flex justify-end">
                                    <a
                                      href={comprovativoImage}
                                      download={comprovativoName}
                                      className="bg-primary text-on-primary hover:bg-primary-dark transition-colors px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
                                    >
                                      <span className="material-symbols-outlined text-sm">download</span>
                                      Transferir PNG
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Modal de Confirmação para Apagar Movimento e Linhas (Admin / Gestor) */}
                          {isManagerOrAdmin && pedidoToDelete && (
                            <div
                              className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
                              onClick={() => !isDeleting && setPedidoToDelete(null)}
                            >
                              <div
                                className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                                      <span className="material-symbols-outlined text-xl">delete_forever</span>
                                    </div>
                                    <div>
                                      <h3 className="text-sm font-bold text-slate-900">
                                        {language === 'pt'
                                          ? 'Apagar Movimento e Linhas'
                                          : language === 'es'
                                            ? 'Eliminar Movimiento y Líneas'
                                            : 'Delete Movement and Lines'}
                                      </h3>
                                      <p className="text-[11px] text-slate-500">
                                        {language === 'pt'
                                          ? 'Ação restrita a Administrador e Gestor'
                                          : 'Restricted to Administrator and Manager'}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => setPedidoToDelete(null)}
                                    className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                                  >
                                    <span className="material-symbols-outlined text-base">close</span>
                                  </button>
                                </div>

                                <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-3.5 text-xs text-slate-800 space-y-1.5">
                                  <p className="font-semibold text-rose-900">
                                    {language === 'pt'
                                      ? 'Tem a certeza que deseja apagar permanentemente este movimento e todas as linhas a ele associadas?'
                                      : 'Are you sure you want to permanently delete this movement and all its associated lines?'}
                                  </p>
                                  <div className="pt-1 space-y-0.5 text-[11px] text-slate-700 font-mono">
                                    <div>
                                      <strong>Documento:</strong> {pedidoToDelete.nr_pedido}{' '}
                                      {pedidoToDelete.tipo_movimento ? `(${pedidoToDelete.tipo_movimento})` : ''}
                                    </div>
                                    <div>
                                      <strong>Destino:</strong>{' '}
                                      {pedidoToDelete.nome_destinatario || pedidoToDelete.destinos?.nome || '-'}
                                    </div>
                                    <div>
                                      <strong>Linhas associadas:</strong> {pedidoToDelete.pedido_linhas?.length || 0} linha(s)
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-end gap-2.5 pt-2">
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => setPedidoToDelete(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    {t.common.cancel}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={handleConfirmDeleteMovimento}
                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                                  >
                                    {isDeleting ? (
                                      <>
                                        <span className="material-symbols-outlined animate-spin text-sm">
                                          progress_activity
                                        </span>
                                        {language === 'pt' ? 'A apagar...' : 'Deleting...'}
                                      </>
                                    ) : (
                                      <>
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                        {language === 'pt' ? 'Confirmar e Apagar' : 'Confirm & Delete'}
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </main>
                        );
}
