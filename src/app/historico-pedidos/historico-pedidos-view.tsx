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
import { createClient } from '@/lib/supabase/client';

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
  const [selectedTipoMov, setSelectedTipoMov] = useState<string>('todos');
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterType>('todos');
  const [selectedModalPedido, setSelectedModalPedido] = useState<PedidoComLinhas | null>(null);
  const [viewMode, setViewMode] = useState<ViewModeType>('tabela');

  const isManagerOrAdmin =
    currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'gestor';

  useEffect(() => {
    setPedidosList(pedidos);
  }, [pedidos]);

  const getRefStr = (nr_pedido: string | undefined | null) => {
    let refStr = (nr_pedido || '').trim();
    if (refStr.includes(' ')) {
      refStr = refStr.substring(refStr.indexOf(' ') + 1).trim();
    }
    return refStr.replace(/^0+/, '');
  };

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



  // Estados disponíveis para filtro (únicos e em ordem alfabética)
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    pedidosList.forEach((ped) => {
      if (ped.status) {
        statuses.add(ped.status);
      }
    });
    return Array.from(statuses).sort();
  }, [pedidosList]);

  // Filtragem
  const filteredPedidos = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return pedidosList.filter((ped) => {
      // Filtro de Cliente
      if (selectedClientId !== 'todos' && ped.client_id !== selectedClientId) {
        return false;
      }

      // Filtro Tipo Movimento
      if (selectedTipoMov !== 'todos' && ped.tipo_movimento?.toLowerCase() !== selectedTipoMov) {
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
  }, [pedidosList, selectedClientId, selectedStatus, selectedDateFilter, searchTerm, selectedTipoMov]);

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
      const baseInfo = `"${ped.nr_pedido}","${ped.data_pedido}","${ped.data_entrega || ''}","${statusLabel}","${ped.clients?.sigla || ''}","${(ped.nome_destinatario || ped.destinos?.nome || '').replace(/"/g, '""')}","${classif}","${ped.morada.replace(/"/g, '""')}","${ped.codigo_postal}","${ped.localidade}","${ped.pais || 'Portugal'}","${ped.requisicao || ped.ref_documento || ''}","${(ped.observacoes || '').replace(/"/g, '""')}"`;

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
    selectedTipoMov !== 'todos' ||
    selectedDateFilter !== 'todos';

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedClientId('todos');
    setSelectedStatus('todos');
    setSelectedTipoMov('todos');
    setSelectedDateFilter('todos');
  };

  return (
    <main className="w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Banner Topo Sermail */}
      <div className="bg-gradient-to-r from-sermail-green-dark via-sermail-green to-[#005a46] text-white rounded-2xl px-6 py-4 shadow-sm relative overflow-hidden border border-emerald-950/30">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-sermail-lime-border shrink-0 border border-white/10">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold font-headline leading-tight text-white">
                {t.historico.bannerTitle}
              </h1>
              <p className="text-xs sm:text-sm text-lime-300/90 font-medium">
                {t.historico.bannerSubtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="badge-sermail-lime shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-sermail-lime-vibrant"></span>
              Histórico & Rastreabilidade
            </span>
          </div>
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
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                {language === 'pt' ? 'Limpar Filtros' : language === 'es' ? 'Limpiar Filtros' : 'Clear Filters'}
              </button>
            )}

            {/* Alternador de Vista (Tabela vs Linhas) */}
            <div className="flex items-center bg-slate-100/80 rounded-xl p-1 border border-slate-200">
              <button
                onClick={() => setViewMode('tabela')}
                title={t.historico.viewTable}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'tabela'
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'detalhado'
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
              className="px-4 py-2.5 bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-sermail-green">download</span>
              {t.common.export} CSV
            </button>
          </div>
        </div>

        {/* Linha de Filtros Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
          {/* Filtro Cliente (Apenas se Admin/Gestor) */}
          {isManagerOrAdmin ? (
            <div className="lg:col-span-2">
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
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">
                {t.historico.filterClient}
              </label>
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-sermail-green">
                {currentUserProfile?.empresa || t.common.client}
              </div>
            </div>
          )}

          {/* Filtro Tipo Movimento */}
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
              Movimento
            </label>
            <select
              value={selectedTipoMov}
              onChange={(e) => setSelectedTipoMov(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-outline-variant/30 rounded-xl text-xs font-medium text-on-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all hover:bg-surface-container/30"
            >
              <option value="todos">Todos</option>
              <option value="es">Entrada Stock (ES)</option>
              <option value="et">Entrada Transf. (ET)</option>
              <option value="ss">Saída Stock (SS)</option>
              <option value="st">Saída Transf. (ST)</option>
            </select>
          </div>

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
              {availableStatuses.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
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
                        </div>

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
                    <th className="py-2.5 px-3 text-center rounded-r-lg">Comprovativo</th>
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
                      <tr key={ped.id} className="hover:bg-emerald-50 transition-colors">
                        {/* {console.log(`Pedido ${ped.nr_pedido} status: ${ped.status} url: ${(ped as any).url_comprovativo}`)} */}
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

      {selectedModalPedido && (() => {
        const ped = selectedModalPedido;
        const totalQtd = ped.pedido_linhas?.reduce((acc, l) => acc + Number(l.quantidade || 0), 0) || 0;
        const statusKey = (ped.status as StatusPedido) || 'pendente';
        const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pendente;
        const isUpdating = updatingPedidoId === ped.id;

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
                        onClick={() => handleViewComprovativo((ped as any).url_comprovativo)}
                        className="bg-secondary/10 text-secondary hover:bg-secondary/20 hover:text-secondary-dark transition-colors p-1.5 rounded-lg flex items-center justify-center"
                        title="Ver Comprovativo"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
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
                            <td className="py-2.5 px-3 font-mono font-medium">{linha.artigo_codigo}</td>
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
    </main>
  );
}
