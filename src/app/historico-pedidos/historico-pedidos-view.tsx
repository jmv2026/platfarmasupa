'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  PedidoComLinhas,
  Client,
  STATUS_PEDIDO_LABELS,
  StatusPedido,
  UserProfile,
} from '@/lib/supabase/types';

interface HistoricoPedidosViewProps {
  pedidos: PedidoComLinhas[];
  clients: Client[];
  currentUserProfile: UserProfile | null;
}

type DateFilterType = 'todos' | 'hoje' | '7dias' | '30dias' | 'este_mes';
type ViewModeType = 'detalhado' | 'tabela';

export default function HistoricoPedidosView({
  pedidos,
  clients,
  currentUserProfile,
}: HistoricoPedidosViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterType>('todos');
  const [viewMode, setViewMode] = useState<ViewModeType>('tabela');
  const [expandedPedidoId, setExpandedPedidoId] = useState<string | null>(null);

  const isManagerOrAdmin =
    currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'gestor';

  // Filtragem
  const filteredPedidos = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return pedidos.filter((ped) => {
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
        const matchCli = ped.clients?.sigla?.toLowerCase().includes(query) || ped.clients?.name?.toLowerCase().includes(query);

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
  }, [pedidos, selectedClientId, selectedStatus, selectedDateFilter, searchTerm]);

  // Total de unidades filtradas
  const totalUnidadesFiltradas = useMemo(() => {
    return filteredPedidos.reduce((acc, ped) => {
      const pedTotal = ped.pedido_linhas?.reduce((lAcc, l) => lAcc + Number(l.quantidade || 0), 0) || 0;
      return acc + pedTotal;
    }, 0);
  }, [filteredPedidos]);

  // Exportar CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Nr Pedido,Data Pedido,Data Entrega,Estado,Cliente,Destinatario,Morada,Codigo Postal,Localidade,Pais,Ref Documento,Observacoes,Codigo Artigo,Descricao Artigo,Lote,Validade,Quantidade\n';

    filteredPedidos.forEach((ped) => {
      const baseInfo = `"${ped.nr_pedido}","${ped.data_pedido}","${ped.data_entrega || ''}","${STATUS_PEDIDO_LABELS[ped.status as StatusPedido] || ped.status}","${ped.clients?.sigla || ''}","${ped.nome_destinatario.replace(/"/g, '""')}","${ped.morada.replace(/"/g, '""')}","${ped.codigo_postal}","${ped.localidade}","${ped.pais || 'Portugal'}","${ped.ref_documento || ''}","${(ped.observacoes || '').replace(/"/g, '""')}"`;

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

  const toggleExpand = (id: string) => {
    setExpandedPedidoId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
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
              placeholder="Pesquisar por nº pedido, destinatário, morada, ref. doc, código de artigo ou lote..."
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
                className="px-3 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 rounded-xl transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                Limpar Filtros
              </button>
            )}

            {/* Alternador de Vista (Tabela vs Linhas) */}
            <div className="flex items-center bg-surface-container rounded-xl p-0.5 border border-outline-variant/30">
              <button
                onClick={() => setViewMode('tabela')}
                title="Vista Tabela Compacta"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  viewMode === 'tabela'
                    ? 'bg-surface-container-lowest text-secondary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-sm">table_rows</span>
                <span className="hidden sm:inline">Tabela</span>
              </button>
              <button
                onClick={() => setViewMode('detalhado')}
                title="Vista Detalhada (Linhas)"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  viewMode === 'detalhado'
                    ? 'bg-surface-container-lowest text-secondary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-sm">view_agenda</span>
                <span className="hidden sm:inline">Linhas</span>
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-surface-container border border-outline-variant/40 text-on-surface hover:bg-surface-container-high font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm text-secondary">download</span>
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Linha de Filtros Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-outline-variant/15">
          {/* Filtro Cliente (Apenas se Admin/Gestor) */}
          {isManagerOrAdmin ? (
            <div>
              <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                Cliente
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
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
            <div>
              <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                Cliente
              </label>
              <div className="px-3 py-1.5 bg-surface-container/40 border border-outline-variant/30 rounded-lg text-xs font-mono font-bold text-secondary">
                {currentUserProfile?.empresa || 'Cliente Associado'}
              </div>
            </div>
          )}

          {/* Filtro Estado */}
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
              Estado do Pedido
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              <option value="todos">Todos os Estados</option>
              <option value="pendente">Pendente</option>
              <option value="confirmado">Confirmado</option>
              <option value="em_preparacao">Em Preparação</option>
              <option value="expedido">Expedido</option>
              <option value="entregue">Entregue</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {/* Filtro Período */}
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
              Período da Encomenda
            </label>
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value as DateFilterType)}
              className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              <option value="todos">Todo o Histórico</option>
              <option value="hoje">Hoje</option>
              <option value="7dias">Últimos 7 dias</option>
              <option value="30dias">Últimos 30 dias</option>
              <option value="este_mes">Este Mês</option>
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
              Registo Histórico de Ordens de Entrega
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Consulta detalhada de pedidos registados, artigos, lotes FEFO debitados e moradas de destino.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-secondary-container text-on-secondary-container">
              {filteredPedidos.length} {filteredPedidos.length === 1 ? 'Pedido' : 'Pedidos'} ({totalUnidadesFiltradas.toLocaleString('pt-PT')} un)
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
                const isExpanded = expandedPedidoId === ped.id;

                return (
                  <div
                    key={ped.id}
                    className="border border-outline-variant/30 rounded-xl p-5 bg-surface hover:bg-surface-container/20 transition-all space-y-4 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="inline-block px-2.5 py-1 bg-secondary text-on-secondary rounded-lg font-mono font-bold text-xs shadow-sm">
                          {ped.nr_pedido}
                        </span>
                        <span className="font-semibold text-sm text-on-surface">
                          {ped.nome_destinatario}
                        </span>
                        {ped.clients?.sigla && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                            {ped.clients.sigla}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                            ped.status === 'expedido' || ped.status === 'entregue'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ped.status === 'pendente'
                              ? 'bg-blue-100 text-blue-800'
                              : ped.status === 'em_preparacao'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              ped.status === 'expedido' || ped.status === 'entregue'
                                ? 'bg-emerald-600'
                                : ped.status === 'pendente'
                                ? 'bg-blue-600'
                                : ped.status === 'em_preparacao'
                                ? 'bg-amber-600'
                                : 'bg-slate-600'
                            }`}
                          ></span>
                          {STATUS_PEDIDO_LABELS[ped.status as StatusPedido] || ped.status}
                        </span>
                        <span className="text-xs text-on-surface-variant font-mono">
                          {new Date(ped.data_pedido).toLocaleDateString('pt-PT')}
                        </span>
                      </div>
                    </div>

                    {/* Destino & Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-surface-container/40 p-3.5 rounded-lg border border-outline-variant/20">
                      <div>
                        <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">
                          Morada de Entrega
                        </span>
                        <span className="text-on-surface font-medium">
                          {ped.morada}, {ped.codigo_postal} {ped.localidade} ({ped.pais || 'Portugal'})
                        </span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">
                          Ref. Documento
                        </span>
                        <span className="text-on-surface font-mono font-medium">
                          {ped.ref_documento || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">
                          Data Prevista Entrega
                        </span>
                        <span className="text-on-surface font-mono font-medium">
                          {ped.data_entrega
                            ? new Date(ped.data_entrega).toLocaleDateString('pt-PT')
                            : 'Imediata'}
                        </span>
                      </div>
                    </div>

                    {/* Linhas do Pedido */}
                    {ped.pedido_linhas && ped.pedido_linhas.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold bg-surface-container/60">
                            <tr>
                              <th className="py-2 px-3 rounded-l-md">Código Artigo</th>
                              <th className="py-2 px-3">Descrição</th>
                              <th className="py-2 px-3">Lote</th>
                              <th className="py-2 px-3">Validade</th>
                              <th className="py-2 px-3 text-right rounded-r-md">Qtd Debitada</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                            {ped.pedido_linhas.map((linha, lIdx) => (
                              <tr key={lIdx} className="hover:bg-surface-container/20">
                                <td className="py-2 px-3 font-mono font-medium">{linha.artigo_codigo}</td>
                                <td className="py-2 px-3 font-medium">{linha.descricao}</td>
                                <td className="py-2 px-3 font-mono font-semibold text-secondary">
                                  {linha.lote}
                                </td>
                                <td className="py-2 px-3 font-mono text-on-surface-variant">
                                  {linha.validade
                                    ? new Date(linha.validade).toLocaleDateString('pt-PT')
                                    : '-'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">
                                  -{Number(linha.quantidade).toLocaleString('pt-PT')}{' '}
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
                          ? `Nota: ${ped.observacoes}`
                          : 'Sem observações adicionais'}
                      </span>
                      <span className="font-semibold text-on-surface">
                        Total do Pedido:{' '}
                        <strong className="text-secondary font-mono text-sm">
                          {totalQtd.toLocaleString('pt-PT')} un
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
                    <th className="py-2.5 px-3 rounded-l-lg">Nº Pedido</th>
                    <th className="py-2.5 px-3">Data Pedido</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Destinatário</th>
                    <th className="py-2.5 px-3">Localidade</th>
                    <th className="py-2.5 px-3">Ref. Doc</th>
                    <th className="py-2.5 px-3 text-center">Linhas</th>
                    <th className="py-2.5 px-3 text-right">Total Unidades</th>
                    <th className="py-2.5 px-3 text-center rounded-r-lg">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                  {filteredPedidos.map((ped) => {
                    const totalQtd =
                      ped.pedido_linhas?.reduce((acc, l) => acc + Number(l.quantidade || 0), 0) || 0;

                    return (
                      <tr key={ped.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-secondary">
                          {ped.nr_pedido}
                        </td>
                        <td className="py-3 px-3 font-mono text-on-surface-variant">
                          {new Date(ped.data_pedido).toLocaleDateString('pt-PT')}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                            {ped.clients?.sigla || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium">{ped.nome_destinatario}</td>
                        <td className="py-3 px-3 text-on-surface-variant">{ped.localidade}</td>
                        <td className="py-3 px-3 font-mono text-on-surface-variant">
                          {ped.ref_documento || '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold">
                          {ped.pedido_linhas?.length || 0}
                        </td>
                        <td className="py-3 px-3 text-right font-bold font-mono text-secondary">
                          {totalQtd.toLocaleString('pt-PT')} un
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              ped.status === 'expedido' || ped.status === 'entregue'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ped.status === 'pendente'
                                ? 'bg-blue-100 text-blue-800'
                                : ped.status === 'em_preparacao'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {STATUS_PEDIDO_LABELS[ped.status as StatusPedido] || ped.status}
                          </span>
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
            <p className="text-sm font-medium">Nenhum pedido de entrega encontrado com os filtros aplicados.</p>
            <p className="text-xs text-on-surface-variant/70 mt-1">
              Tente alterar os termos de pesquisa ou limpar os filtros para ver todos os registos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
