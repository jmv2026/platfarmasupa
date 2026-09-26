'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  PedidoComLinhas,
  Client,
  STATUS_PEDIDO_LABELS,
  StatusPedido,
  UserProfile,
} from '@/lib/supabase/types';
import { useLanguage } from '@/lib/i18n/context';
import { atualizarEstadoPedido } from './actions';

interface HistoricoPedidosViewProps {
  pedidos: PedidoComLinhas[];
  clients: Client[];
  currentUserProfile: UserProfile | null;
}

type DateFilterType = 'todos' | 'hoje' | '7dias' | '30dias' | 'este_mes';
type ViewModeType = 'detalhado' | 'tabela';

const STATUS_CONFIG: Record<
  StatusPedido,
  { bg: string; dot: string; icon: string }
> = {
  pendente: {
    bg: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-blue-600',
    icon: 'pending',
  },
  confirmado: {
    bg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dot: 'bg-indigo-600',
    icon: 'check_circle',
  },
  em_preparacao: {
    bg: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-600',
    icon: 'inventory',
  },
  expedido: {
    bg: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    dot: 'bg-cyan-600',
    icon: 'local_shipping',
  },
  entregue: {
    bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600',
    icon: 'task_alt',
  },
  cancelado: {
    bg: 'bg-rose-100 text-rose-800 border-rose-200',
    dot: 'bg-rose-600',
    icon: 'cancel',
  },
};

export default function HistoricoPedidosView({
  pedidos,
  clients,
  currentUserProfile,
}: HistoricoPedidosViewProps) {
  const { t, language } = useLanguage();
  const [pedidosList, setPedidosList] = useState<PedidoComLinhas[]>(pedidos);
  const [updatingPedidoId, setUpdatingPedidoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterType>('todos');
  const [viewMode, setViewMode] = useState<ViewModeType>('tabela');

  const isManagerOrAdmin =
    currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'gestor';

  useEffect(() => {
    setPedidosList(pedidos);
  }, [pedidos]);

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

  // Alteração de Estado do Pedido
  const handleStatusChange = async (pedidoId: string, novoStatus: StatusPedido) => {
    const pedido = pedidosList.find((p) => p.id === pedidoId);
    if (!pedido || pedido.status === novoStatus) return;

    const statusAnterior = pedido.status as StatusPedido;

    // Atualização otimista
    setPedidosList((prev) =>
      prev.map((p) => (p.id === pedidoId ? { ...p, status: novoStatus } : p))
    );
    setUpdatingPedidoId(pedidoId);
    setFeedback(null);

    const res = await atualizarEstadoPedido(pedidoId, novoStatus);

    setUpdatingPedidoId(null);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `${language === 'pt' ? 'Estado do pedido' : language === 'es' ? 'Estado del pedido' : 'Order status'} ${pedido.nr_pedido} ${language === 'pt' ? 'alterado para' : language === 'es' ? 'cambiado a' : 'changed to'} "${getStatusLabel(novoStatus)}".`,
      });
      setTimeout(() => {
        setFeedback((curr) => (curr?.message.includes(pedido.nr_pedido) ? null : curr));
      }, 4500);
    } else {
      // Reverter alteração otimista em caso de erro
      setPedidosList((prev) =>
        prev.map((p) => (p.id === pedidoId ? { ...p, status: statusAnterior } : p))
      );
      setFeedback({
        type: 'error',
        message: res.error || t.common.error,
      });
    }
  };

  // Filtragem
  const filteredPedidos = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return pedidosList.filter((ped) => {
      // Filtro de Cliente
      if (selectedClientId !== 'todos' && ped.client_id !== selectedClientId) {
        return false;
      }

      // Filtro de Estado
      if (selectedStatus !== 'todos' && ped.status !== selectedStatus) {
        return false;
      }

      // Filtro de Data
      if (selectedDateFilter !== 'todos') {
        const pedDate = new Date(ped.data_pedido);
        if (selectedDateFilter === 'hoje') {
          if (ped.data_pedido !== todayStr) return false;
        } else if (selectedDateFilter === '7dias') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (pedDate < sevenDaysAgo) return false;
        } else if (selectedDateFilter === '30dias') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (pedDate < thirtyDaysAgo) return false;
        } else if (selectedDateFilter === 'este_mes') {
          if (
            pedDate.getMonth() !== now.getMonth() ||
            pedDate.getFullYear() !== now.getFullYear()
          ) {
            return false;
          }
        }
      }

      // Filtro de Pesquisa Textual
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchNr = ped.nr_pedido?.toLowerCase().includes(query);
        const matchDest = ped.nome_destinatario?.toLowerCase().includes(query);
        const matchMorada = ped.morada?.toLowerCase().includes(query);
        const matchLoc = ped.localidade?.toLowerCase().includes(query);
        const matchCP = ped.codigo_postal?.toLowerCase().includes(query);
        const matchRef = ped.ref_documento?.toLowerCase().includes(query);
        const matchObs = ped.observacoes?.toLowerCase().includes(query);
        const matchCli =
          ped.clients?.sigla?.toLowerCase().includes(query) ||
          ped.clients?.name?.toLowerCase().includes(query);

        // Pesquisa também nas linhas de artigos
        const matchLinha = ped.pedido_linhas?.some(
          (l) =>
            l.artigo_codigo?.toLowerCase().includes(query) ||
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
  }, [pedidosList, selectedClientId, selectedStatus, selectedDateFilter, searchTerm]);

  // Total de unidades filtradas
  const totalUnidadesFiltradas = useMemo(() => {
    return filteredPedidos.reduce((acc, ped) => {
      const pedTotal =
        ped.pedido_linhas?.reduce((lAcc, l) => lAcc + Number(l.quantidade || 0), 0) || 0;
      return acc + pedTotal;
    }, 0);
  }, [filteredPedidos]);

  // Exportar CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent +=
      'Nr Pedido,Data Pedido,Data Entrega,Estado,Cliente,Destinatario,Classificacao Destino,Morada,Codigo Postal,Localidade,Pais,Ref Documento,Observacoes,Codigo Artigo,Descricao Artigo,Lote,Validade,Quantidade\n';

    filteredPedidos.forEach((ped) => {
      const statusLabel = getStatusLabel(ped.status);
      const classif = ped.classifica_destino || ped.destinos?.classifica_destino || '';
      const baseInfo = `"${ped.nr_pedido}","${ped.data_pedido}","${ped.data_entrega || ''}","${statusLabel}","${ped.clients?.sigla || ''}","${ped.nome_destinatario.replace(/"/g, '""')}","${classif}","${ped.morada.replace(/"/g, '""')}","${ped.codigo_postal}","${ped.localidade}","${ped.pais || 'Portugal'}","${ped.ref_documento || ''}","${(ped.observacoes || '').replace(/"/g, '""')}"`;

      if (ped.pedido_linhas && ped.pedido_linhas.length > 0) {
        ped.pedido_linhas.forEach((l) => {
          csvContent += `${baseInfo},"${l.artigo_codigo}","${l.descricao.replace(/"/g, '""')}","${l.lote}","${l.validade || ''}",${l.quantidade}\n`;
        });
      } else {
        csvContent += `${baseInfo},"","","","",0\n`;
      }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `historico_pedidos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedClientId !== 'todos' ||
    selectedStatus !== 'todos' ||
    selectedDateFilter !== 'todos';

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedClientId('todos');
    setSelectedStatus('todos');
    setSelectedDateFilter('todos');
  };

  return (
    <main className="w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Banner Topo */}
      <div className="h-[50px] bg-primary-container text-on-primary rounded-xl px-5 flex items-center shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-[50px] w-full min-w-0">
          <h1 className="text-base sm:text-lg font-bold font-headline leading-none whitespace-nowrap text-white shrink-0">
            {t.historico.bannerTitle}
          </h1>
          <p className="text-xs sm:text-sm text-lime-300 font-medium truncate hidden sm:block">
            {t.historico.bannerSubtitle}
          </p>
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
            onClick={() => setFeedback(null)}
            className="text-slate-500 hover:text-slate-800"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Painel de Filtros e Busca */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Barra de Pesquisa */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.historico.searchPlaceholder}
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant/40 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Botões de Ação e Alternador de Vista */}
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                {language === 'pt' ? 'Limpar Filtros' : language === 'es' ? 'Limpiar Filtros' : 'Clear Filters'}
              </button>
            )}

            {/* Alternador de Vista (Tabela vs Linhas) */}
            <div className="flex items-center bg-surface-container rounded-xl p-0.5 border border-outline-variant/30">
              <button
                onClick={() => setViewMode('tabela')}
                title={t.historico.viewTable}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'tabela'
                    ? 'bg-surface-container-lowest text-secondary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-sm">table_rows</span>
                <span className="hidden sm:inline">{t.historico.viewTable}</span>
              </button>
              <button
                onClick={() => setViewMode('detalhado')}
                title={t.historico.viewCards}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'detalhado'
                    ? 'bg-surface-container-lowest text-secondary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-sm">view_agenda</span>
                <span className="hidden sm:inline">{t.historico.viewCards}</span>
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-surface-container border border-outline-variant/40 text-on-surface hover:bg-surface-container-high font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-secondary">download</span>
              {t.common.export} CSV
            </button>
          </div>
        </div>

        {/* Linha de Filtros Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-outline-variant/15">
          {/* Filtro Cliente (Apenas se Admin/Gestor) */}
          {isManagerOrAdmin ? (
            <div>
              <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                {t.historico.filterClient}
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
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
            <div>
              <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                {t.historico.filterClient}
              </label>
              <div className="px-3 py-1.5 bg-surface-container/40 border border-outline-variant/30 rounded-lg text-xs font-mono font-bold text-secondary">
                {currentUserProfile?.empresa || t.common.client}
              </div>
            </div>
          )}

          {/* Filtro Estado */}
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
              {t.historico.filterStatus}
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              <option value="todos">{t.historico.allStatuses}</option>
              <option value="pendente">{t.historico.statusPendente}</option>
              <option value="confirmado">{t.historico.statusConfirmado}</option>
              <option value="em_preparacao">{t.historico.statusPreparacao}</option>
              <option value="expedido">{t.historico.statusExpedido}</option>
              <option value="entregue">{t.historico.statusEntregue}</option>
              <option value="cancelado">{t.historico.statusCancelado}</option>
            </select>
          </div>

          {/* Filtro Período */}
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
              {t.historico.filterDate}
            </label>
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value as DateFilterType)}
              className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
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
                const statusKey = (ped.status as StatusPedido) || 'pendente';
                const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pendente;
                const isUpdating = updatingPedidoId === ped.id;

                return (
                  <div
                    key={ped.id}
                    className="border border-outline-variant/30 rounded-xl p-5 bg-surface hover:bg-surface-container/20 transition-all space-y-4 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-block px-2.5 py-1 bg-secondary text-on-secondary rounded-lg font-mono font-bold text-xs shadow-sm">
                          {ped.nr_pedido}
                        </span>
                        <span className="font-semibold text-sm text-on-surface">
                          {ped.nome_destinatario}
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
                        {isManagerOrAdmin ? (
                          <div className="relative flex items-center">
                            {isUpdating ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-surface-container border border-outline-variant/30 text-on-surface-variant">
                                <span className="w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin"></span>
                                {t.common.loading}
                              </span>
                            ) : (
                              <div className="relative">
                                <select
                                  value={statusKey}
                                  onChange={(e) =>
                                    handleStatusChange(ped.id, e.target.value as StatusPedido)
                                  }
                                  className={`appearance-none cursor-pointer pl-3 pr-8 py-1 rounded-lg text-xs font-bold border transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-secondary/40 ${statusCfg.bg}`}
                                  title={t.historico.changeStatus}
                                >
                                  <option value="pendente">{t.historico.statusPendente}</option>
                                  <option value="confirmado">{t.historico.statusConfirmado}</option>
                                  <option value="em_preparacao">{t.historico.statusPreparacao}</option>
                                  <option value="expedido">{t.historico.statusExpedido}</option>
                                  <option value="entregue">{t.historico.statusEntregue}</option>
                                  <option value="cancelado">{t.historico.statusCancelado}</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none opacity-70">
                                  arrow_drop_down
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusCfg.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}></span>
                            {getStatusLabel(statusKey)}
                          </span>
                        )}

                        <span className="text-xs text-on-surface-variant font-mono">
                          {formatDate(ped.data_pedido)}
                        </span>
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
                          {ped.ref_documento || 'N/A'}
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
                              <tr key={lIdx} className="hover:bg-surface-container/20">
                                <td className="py-2 px-3 font-mono font-medium">
                                  {linha.artigo_codigo}
                                </td>
                                <td className="py-2 px-3 font-medium">{linha.descricao}</td>
                                <td className="py-2 px-3 font-mono font-semibold text-secondary">
                                  {linha.lote}
                                </td>
                                <td className="py-2 px-3 font-mono text-on-surface-variant">
                                  {formatDate(linha.validade)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">
                                  -{Number(linha.quantidade).toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')}{' '}
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
                    <th className="py-2.5 px-3">{t.historico.colDate}</th>
                    <th className="py-2.5 px-3">{t.historico.colClient}</th>
                    <th className="py-2.5 px-3">{t.historico.colDestination}</th>
                    <th className="py-2.5 px-3">{t.pedidos.city}</th>
                    <th className="py-2.5 px-3">{t.historico.colDocRef}</th>
                    <th className="py-2.5 px-3 text-center">{t.historico.colLines}</th>
                    <th className="py-2.5 px-3 text-right">{t.historico.colTotalQty}</th>
                    <th className="py-2.5 px-3 text-center rounded-r-lg">{t.historico.colStatus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                  {filteredPedidos.map((ped) => {
                    const totalQtd =
                      ped.pedido_linhas?.reduce((acc, l) => acc + Number(l.quantidade || 0), 0) ||
                      0;
                    const statusKey = (ped.status as StatusPedido) || 'pendente';
                    const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pendente;
                    const isUpdating = updatingPedidoId === ped.id;

                    return (
                      <tr key={ped.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-secondary">
                          {ped.nr_pedido}
                        </td>
                        <td className="py-3 px-3 font-mono text-on-surface-variant">
                          {formatDate(ped.data_pedido)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                            {ped.clients?.sigla || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium">
                          <div>{ped.nome_destinatario}</div>
                          {(ped.classifica_destino || ped.destinos?.classifica_destino) && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-medium bg-primary/10 text-primary">
                              {ped.classifica_destino || ped.destinos?.classifica_destino}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-on-surface-variant">{ped.localidade}</td>
                        <td className="py-3 px-3 font-mono text-on-surface-variant">
                          {ped.ref_documento || '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold">
                          {ped.pedido_linhas?.length || 0}
                        </td>
                        <td className="py-3 px-3 text-right font-bold font-mono text-secondary">
                          {totalQtd.toLocaleString(language === 'en' ? 'en-GB' : 'pt-PT')} un
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isManagerOrAdmin ? (
                            isUpdating ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-surface-container text-on-surface-variant font-medium">
                                <span className="w-2.5 h-2.5 border-2 border-secondary border-t-transparent rounded-full animate-spin"></span>
                                {t.common.loading}
                              </span>
                            ) : (
                              <div className="relative inline-block">
                                <select
                                  value={statusKey}
                                  onChange={(e) =>
                                    handleStatusChange(ped.id, e.target.value as StatusPedido)
                                  }
                                  className={`appearance-none cursor-pointer pl-2.5 pr-6 py-1 rounded-md text-[11px] font-bold border transition-all shadow-xs focus:outline-none focus:ring-1 focus:ring-secondary ${statusCfg.bg}`}
                                  title={t.historico.changeStatus}
                                >
                                  <option value="pendente">{t.historico.statusPendente}</option>
                                  <option value="confirmado">{t.historico.statusConfirmado}</option>
                                  <option value="em_preparacao">{t.historico.statusPreparacao}</option>
                                  <option value="expedido">{t.historico.statusExpedido}</option>
                                  <option value="entregue">{t.historico.statusEntregue}</option>
                                  <option value="cancelado">{t.historico.statusCancelado}</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[13px] pointer-events-none opacity-70">
                                  arrow_drop_down
                                </span>
                              </div>
                            )
                          ) : (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.bg}`}
                            >
                              {getStatusLabel(statusKey)}
                            </span>
                          )}
                        </td>
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
    </main>
  );
}
