'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Artigo,
  Client,
  PedidoComLinhas,
  StockPedido,
  STATUS_PEDIDO_LABELS,
  StatusPedido,
  CLASSIFICACOES_DESTINO,
} from '@/lib/supabase/types';
import { useLanguage } from '@/lib/i18n/context';
import {
  atualizarProcessamentoPedidoAction,
  editarPedidoAction,
  apagarPedidoAction,
  EditarPedidoInput,
} from './actions';

interface ProcPedidosViewProps {
  pedidos: PedidoComLinhas[];
  clients: Client[];
  stockPedidos?: StockPedido[];
  artigos?: Artigo[];
}

const STATUS_DB_OPTIONS: { value: string; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'processado', label: 'Processado' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
];

export default function ProcPedidosView({
  pedidos,
  clients,
  stockPedidos = [],
  artigos = [],
}: ProcPedidosViewProps) {
  const { language } = useLanguage();
  const [pedidosList, setPedidosList] = useState<PedidoComLinhas[]>(pedidos);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('todos');
  const [filterEstadoProc, setFilterEstadoProc] = useState<'todos' | 'pendentes' | 'processar' | 'processados'>('todos');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedPedido, setSelectedPedido] = useState<PedidoComLinhas | null>(null);
  const [editingPedido, setEditingPedido] = useState<EditarPedidoInput | null>(null);
  const [editingNrPedido, setEditingNrPedido] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingPedido, setDeletingPedido] = useState<PedidoComLinhas | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados para acrescentar nova linha no modal de edição
  const [newLineArtigoCli, setNewLineArtigoCli] = useState<string>('');
  const [newLineLote, setNewLineLote] = useState<string>('');
  const [newLineValidade, setNewLineValidade] = useState<string>('');
  const [newLineQuantidade, setNewLineQuantidade] = useState<number>(1);

  useEffect(() => {
    setPedidosList(pedidos);
  }, [pedidos]);

  const formatDate = (dStr: string | null | undefined) => {
    if (!dStr) return '-';
    try {
      const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'pt-PT';
      return new Date(dStr).toLocaleDateString(locale);
    } catch {
      return dStr;
    }
  };

  // Stock disponível do cliente do pedido em edição
  const editingClientStock = useMemo(() => {
    if (!editingPedido?.cliente_id) return [];
    return stockPedidos.filter(
      (s) => s.cliente_id === editingPedido.cliente_id && Number(s.stock) > 0
    );
  }, [stockPedidos, editingPedido?.cliente_id]);

  // Artigos disponíveis para o cliente do pedido em edição (prioriza stock disponível + catálogo de artigos do cliente)
  const editingClientArtigos = useMemo(() => {
    if (!editingPedido?.cliente_id) return [];
    const clientObj = clients.find((c) => c.id === editingPedido.cliente_id);
    const sigla = (clientObj?.sigla || '').toUpperCase();

    const map = new Map<
      string,
      { artigo_cli: string; artigo_id: string; descricao: string }
    >();

    editingClientStock.forEach((s) => {
      const key = s.artigo_cli || s.artigo_id;
      if (key && !map.has(key)) {
        map.set(key, {
          artigo_cli: s.artigo_cli || s.artigo_id,
          artigo_id: s.artigo_id || s.artigo_cli,
          descricao: s.descricao || '',
        });
      }
    });

    artigos.forEach((a) => {
      if (sigla && a.artigo_cli?.toUpperCase().startsWith(`${sigla}-`)) {
        if (!map.has(a.artigo_cli)) {
          map.set(a.artigo_cli, {
            artigo_cli: a.artigo_cli,
            artigo_id: a.artigo_id,
            descricao: a.descricao || '',
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.artigo_id.localeCompare(b.artigo_id, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [editingPedido?.cliente_id, editingClientStock, artigos, clients]);

  // Lotes em stock para o artigo selecionado na nova linha (ordenados por FEFO)
  const availableLotesForNewLine = useMemo(() => {
    if (!newLineArtigoCli) return [];
    return editingClientStock
      .filter((s) => s.artigo_cli === newLineArtigoCli || s.artigo_id === newLineArtigoCli)
      .sort((a, b) => {
        if (!a.validade) return 1;
        if (!b.validade) return -1;
        return new Date(a.validade).getTime() - new Date(b.validade).getTime();
      });
  }, [editingClientStock, newLineArtigoCli]);

  const handleSelectNewLineArtigo = (artigoCli: string) => {
    setNewLineArtigoCli(artigoCli);
    const lotes = editingClientStock
      .filter((s) => s.artigo_cli === artigoCli || s.artigo_id === artigoCli)
      .sort((a, b) => {
        if (!a.validade) return 1;
        if (!b.validade) return -1;
        return new Date(a.validade).getTime() - new Date(b.validade).getTime();
      });

    if (lotes.length > 0) {
      setNewLineLote(lotes[0].lote || '');
      setNewLineValidade(lotes[0].validade ? lotes[0].validade.split('T')[0] : '');
    } else {
      setNewLineLote('');
      setNewLineValidade('');
    }
    setNewLineQuantidade(1);
  };

  const handleSelectNewLineLote = (loteStr: string) => {
    setNewLineLote(loteStr);
    const matched = availableLotesForNewLine.find((l) => (l.lote || '') === loteStr);
    if (matched) {
      setNewLineValidade(matched.validade ? matched.validade.split('T')[0] : '');
    }
  };

  const handleAddLineToEditingPedido = () => {
    if (!editingPedido) return;
    if (!newLineArtigoCli) {
      setFeedback({ type: 'error', message: 'Selecione um artigo para acrescentar ao pedido.' });
      return;
    }
    if (!newLineLote.trim()) {
      setFeedback({ type: 'error', message: 'Indique o lote do artigo.' });
      return;
    }
    if (Number(newLineQuantidade) <= 0) {
      setFeedback({ type: 'error', message: 'A quantidade deve ser superior a zero.' });
      return;
    }

    const artInfo = editingClientArtigos.find((a) => a.artigo_cli === newLineArtigoCli);
    const artigoId = artInfo?.artigo_id || newLineArtigoCli;
    const artigoCli = artInfo?.artigo_cli || newLineArtigoCli;
    const descricao = artInfo?.descricao || artigoId;

    const novaLinha = {
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      artigo_id: artigoId,
      artigo_cli: artigoCli,
      descricao,
      lote: newLineLote.trim(),
      validade: newLineValidade || null,
      quantidade: Number(newLineQuantidade),
      isNew: true,
    };

    setEditingPedido({
      ...editingPedido,
      linhas: [...editingPedido.linhas, novaLinha],
    });

    // Limpar campos de adição de linha
    setNewLineArtigoCli('');
    setNewLineLote('');
    setNewLineValidade('');
    setNewLineQuantidade(1);
  };

  const handleToggleField = async (
    pedidoId: string,
    field: 'processar' | 'processado',
    currentValue: boolean
  ) => {
    const newValue = !currentValue;
    setUpdatingId(pedidoId);
    setFeedback(null);

    // Atualização otimista
    setPedidosList((prev) =>
      prev.map((p) => (p.id === pedidoId ? { ...p, [field]: newValue } : p))
    );

    const res = await atualizarProcessamentoPedidoAction(pedidoId, { [field]: newValue });
    setUpdatingId(null);

    if (!res.success) {
      // Reverter se falhar
      setPedidosList((prev) =>
        prev.map((p) => (p.id === pedidoId ? { ...p, [field]: currentValue } : p))
      );
      setFeedback({
        type: 'error',
        message: res.error || 'Erro ao atualizar o pedido.',
      });
    }
  };

  const handleOpenEdit = (pedido: PedidoComLinhas) => {
    setFeedback(null);
    setEditingNrPedido(pedido.nr_pedido);
    setNewLineArtigoCli('');
    setNewLineLote('');
    setNewLineValidade('');
    setNewLineQuantidade(1);
    setEditingPedido({
      id: pedido.id,
      cliente_id: pedido.cliente_id,
      nome_destinatario: pedido.nome_destinatario || '',
      morada: pedido.morada || '',
      codigo_postal: pedido.codigo_postal || '',
      localidade: pedido.localidade || '',
      pais: pedido.pais || 'Portugal',
      data_pedido: pedido.data_pedido ? pedido.data_pedido.split('T')[0] : '',
      data_entrega: pedido.data_entrega ? pedido.data_entrega.split('T')[0] : '',
      ref_documento: pedido.ref_documento || '',
      classifica_destino: pedido.classifica_destino || '',
      status: pedido.status || 'pendente',
      observacoes: pedido.observacoes || '',
      processar: Boolean(pedido.processar),
      processado: Boolean(pedido.processado),
      linhas: (pedido.pedido_linhas || []).map((l) => ({
        id: l.id,
        artigo_id: l.artigo_id,
        artigo_cli: l.artigo_cli,
        descricao: l.descricao || '',
        lote: l.lote || '',
        validade: l.validade ? l.validade.split('T')[0] : '',
        quantidade: Number(l.quantidade) || 1,
      })),
      linhasRemovidasIds: [],
    });
  };

  const handleRemoveEditLine = (linhaId: string) => {
    if (!editingPedido) return;
    if (editingPedido.linhas.length <= 1) {
      setFeedback({
        type: 'error',
        message: 'O pedido deve ter pelo menos uma linha. Para remover todo o pedido, utilize a opção Apagar.',
      });
      return;
    }
    setEditingPedido({
      ...editingPedido,
      linhas: editingPedido.linhas.filter((l) => l.id !== linhaId),
      linhasRemovidasIds: [...(editingPedido.linhasRemovidasIds || []), linhaId],
    });
  };

  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingPedido) return;

    // Se o utilizador selecionou um artigo na secção "Acrescentar Linha ao Pedido" e clicou diretamente em "Guardar Alterações", incluir essa linha automaticamente
    let linhasFinais = [...editingPedido.linhas];
    if (newLineArtigoCli && newLineLote.trim() && Number(newLineQuantidade) > 0) {
      const artInfo = editingClientArtigos.find((a) => a.artigo_cli === newLineArtigoCli);
      const artigoId = artInfo?.artigo_id || newLineArtigoCli;
      const artigoCli = artInfo?.artigo_cli || newLineArtigoCli;
      const descricao = artInfo?.descricao || artigoId;

      linhasFinais.push({
        id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        artigo_id: artigoId,
        artigo_cli: artigoCli,
        descricao,
        lote: newLineLote.trim(),
        validade: newLineValidade || null,
        quantidade: Number(newLineQuantidade),
        isNew: true,
      });
    }

    const payloadParaGuardar: EditarPedidoInput = {
      ...editingPedido,
      linhas: linhasFinais,
    };

    setIsSavingEdit(true);
    setFeedback(null);

    const res = await editarPedidoAction(payloadParaGuardar);
    setIsSavingEdit(false);

    if (!res.success) {
      setFeedback({
        type: 'error',
        message: res.error || 'Erro ao guardar alterações do pedido.',
      });
      return;
    }

    setPedidosList((prev) =>
      prev.map((p) =>
        p.id === payloadParaGuardar.id
          ? {
              ...p,
              nome_destinatario: payloadParaGuardar.nome_destinatario,
              morada: payloadParaGuardar.morada,
              codigo_postal: payloadParaGuardar.codigo_postal,
              localidade: payloadParaGuardar.localidade,
              pais: payloadParaGuardar.pais,
              data_pedido: payloadParaGuardar.data_pedido,
              data_entrega: payloadParaGuardar.data_entrega || null,
              ref_documento: payloadParaGuardar.ref_documento || null,
              classifica_destino: payloadParaGuardar.classifica_destino || null,
              status: payloadParaGuardar.status,
              observacoes: payloadParaGuardar.observacoes || null,
              processar: payloadParaGuardar.processar,
              processado: payloadParaGuardar.processado,
              pedido_linhas:
                res.linhas && res.linhas.length > 0
                  ? res.linhas
                  : payloadParaGuardar.linhas.map((l) => ({
                      id: l.id,
                      pedido_id: payloadParaGuardar.id,
                      cliente_id: p.cliente_id,
                      artigo_id: l.artigo_id,
                      artigo_cli: l.artigo_cli,
                      descricao: l.descricao,
                      lote: l.lote,
                      validade: l.validade || null,
                      quantidade: Number(l.quantidade),
                    })),
            }
          : p
      )
    );

    // Fechar a janela de edição imediatamente após guardar
    setEditingPedido(null);
    setNewLineArtigoCli('');
    setNewLineLote('');
    setNewLineValidade('');
    setNewLineQuantidade(1);
    setFeedback({
      type: 'success',
      message: `Pedido ${editingNrPedido} atualizado com sucesso.`,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deletingPedido) return;

    setIsDeleting(true);
    setFeedback(null);

    const res = await apagarPedidoAction(deletingPedido.id);
    setIsDeleting(false);

    if (!res.success) {
      setFeedback({
        type: 'error',
        message: res.error || 'Erro ao apagar o pedido.',
      });
      return;
    }

    const deletedNr = deletingPedido.nr_pedido;
    setPedidosList((prev) => prev.filter((p) => p.id !== deletingPedido.id));
    setDeletingPedido(null);
    setFeedback({
      type: 'success',
      message: `Pedido ${deletedNr} apagado com sucesso.`,
    });
  };

  const filteredPedidos = useMemo(() => {
    return pedidosList.filter((p) => {
      if (selectedClientId !== 'todos' && p.cliente_id !== selectedClientId) {
        return false;
      }

      if (filterEstadoProc === 'pendentes' && p.processado) {
        return false;
      }
      if (filterEstadoProc === 'processar' && !p.processar) {
        return false;
      }
      if (filterEstadoProc === 'processados' && !p.processado) {
        return false;
      }

      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const nr = (p.nr_pedido || '').toLowerCase();
        const ref = (p.ref_documento || '').toLowerCase();
        const dest = (p.nome_destinatario || '').toLowerCase();
        const cli = (p.clientes?.name || p.clientes?.sigla || '').toLowerCase();
        const loc = (p.localidade || '').toLowerCase();

        if (!nr.includes(q) && !ref.includes(q) && !dest.includes(q) && !cli.includes(q) && !loc.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [pedidosList, selectedClientId, filterEstadoProc, searchTerm]);

  const stats = useMemo(() => {
    const total = pedidosList.length;
    const paraProcessar = pedidosList.filter((p) => Boolean(p.processar) && !p.processado).length;
    const processados = pedidosList.filter((p) => Boolean(p.processado)).length;
    const naoProcessados = pedidosList.filter((p) => !p.processado).length;
    return { total, paraProcessar, processados, naoProcessados };
  }, [pedidosList]);

  return (
    <main className="w-full px-4 sm:px-6 pt-5 space-y-5">
      {/* Banner Topo */}
      <div className="bg-gradient-to-r from-sermail-green-dark via-sermail-green to-[#0f5132] rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-sermail-lime-vibrant text-2xl">
            fact_check
          </span>
          <h1 className="text-xl font-bold tracking-tight text-sermail-lime-vibrant">
            Controlo e Processamento de Pedidos
          </h1>
        </div>

        {/* KPIs rápidos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-lg px-3.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-white/75 font-semibold">Total Pedidos</p>
            <p className="text-lg font-bold text-white leading-tight">{stats.total}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-lg px-3.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-amber-200 font-semibold">Por Processar</p>
            <p className="text-lg font-bold text-amber-300 leading-tight">{stats.naoProcessados}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-lg px-3.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-sky-200 font-semibold">A Processar</p>
            <p className="text-lg font-bold text-sky-300 leading-tight">{stats.paraProcessar}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-lg px-3.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-200 font-semibold">Processados</p>
            <p className="text-lg font-bold text-emerald-300 leading-tight">{stats.processados}</p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs font-medium flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined text-slate-400 text-base absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar nº pedido, cliente, destinatário, ref..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
            />
          </div>

          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-sermail-green/20"
          >
            <option value="todos">Todos os Clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.sigla} - {c.name}
              </option>
            ))}
          </select>

          <select
            value={filterEstadoProc}
            onChange={(e) => setFilterEstadoProc(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-sermail-green/20"
          >
            <option value="todos">Todos os Estados</option>
            <option value="pendentes">Não Processados</option>
            <option value="processar">Marcados para Processar</option>
            <option value="processados">Processados</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          A mostrar <span className="font-bold text-slate-800">{filteredPedidos.length}</span> de{' '}
          <span className="font-bold text-slate-800">{pedidosList.length}</span> pedidos
        </div>
      </div>

      {/* Tabela de Pedidos */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4">Nº Pedido</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Destinatário</th>
                <th className="py-3 px-4">Localidade</th>
                <th className="py-3 px-4">Ref. Doc</th>
                <th className="py-3 px-4 text-center">Linhas</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Processar</th>
                <th className="py-3 px-4 text-center">Processado</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPedidos.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400 font-medium">
                    Nenhum pedido encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredPedidos.map((p) => {
                  const isUpdating = updatingId === p.id;
                  const processarVal = Boolean(p.processar);
                  const processadoVal = Boolean(p.processado);

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-sermail-green-dark whitespace-nowrap">
                        {p.nr_pedido}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatDate(p.data_pedido || p.created_at)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold">
                            {p.clientes?.sigla || '-'}
                          </span>
                          <span className="truncate max-w-[160px]">{p.clientes?.name || ''}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium max-w-[200px] truncate">
                        {p.nome_destinatario}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {p.localidade}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {p.ref_documento || '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-700">
                        {p.pedido_linhas?.length || 0}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {STATUS_PEDIDO_LABELS[p.status as StatusPedido] || p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={processarVal}
                          disabled={isUpdating}
                          onChange={() => handleToggleField(p.id, 'processar', processarVal)}
                          className="h-4 w-4 rounded border-slate-300 text-sermail-green focus:ring-sermail-green cursor-pointer disabled:opacity-50"
                          title="Marcar para processar"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={processadoVal}
                          disabled={isUpdating}
                          onChange={() => handleToggleField(p.id, 'processado', processadoVal)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer disabled:opacity-50"
                          title="Marcar como processado"
                        />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedPedido(p)}
                            title="Ver detalhes do pedido"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-sermail-green hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">visibility</span>
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            title="Editar pedido"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingPedido(p)}
                            title="Apagar pedido"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            Apagar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhe do Pedido */}
      {selectedPedido && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Pedido {selectedPedido.nr_pedido}
                </h2>
                <p className="text-xs text-slate-500">
                  Cliente: {selectedPedido.clientes?.sigla} - {selectedPedido.clientes?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPedido(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                <div>
                  <span className="text-slate-400 font-semibold block">Destinatário</span>
                  <span className="font-bold text-slate-800">{selectedPedido.nome_destinatario}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Morada</span>
                  <span className="text-slate-700">
                    {selectedPedido.morada}, {selectedPedido.codigo_postal} {selectedPedido.localidade} ({selectedPedido.pais})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Data do Pedido</span>
                  <span className="text-slate-700">{formatDate(selectedPedido.data_pedido)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Ref. Documento</span>
                  <span className="text-slate-700">{selectedPedido.ref_documento || '-'}</span>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 mb-2">
                  Linhas do Pedido ({selectedPedido.pedido_linhas?.length || 0})
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                        <th className="py-2.5 px-3">Código</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-3">Lote</th>
                        <th className="py-2.5 px-3">Validade</th>
                        <th className="py-2.5 px-3 text-right">Qtd</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedPedido.pedido_linhas || []).map((linha) => (
                        <tr key={linha.id}>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {linha.artigo_cli || linha.artigo_id}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{linha.descricao}</td>
                          <td className="py-2 px-3 text-slate-600">{linha.lote}</td>
                          <td className="py-2 px-3 text-slate-600">{formatDate(linha.validade)}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {linha.quantidade}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const p = selectedPedido;
                  setSelectedPedido(null);
                  handleOpenEdit(p);
                }}
                className="px-4 py-1.5 rounded-lg bg-sermail-green text-white text-xs font-semibold hover:bg-sermail-green-dark"
              >
                Editar Pedido
              </button>
              <button
                type="button"
                onClick={() => setSelectedPedido(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição do Pedido */}
      {editingPedido && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sermail-green text-xl">edit_note</span>
                <h2 className="text-base font-bold text-slate-900">
                  Editar Pedido {editingNrPedido}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingPedido(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {feedback?.type === 'error' && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 font-semibold flex items-center justify-between">
                  <span>{feedback.message}</span>
                  <button
                    type="button"
                    onClick={() => setFeedback(null)}
                    className="text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Secção Destinatário e Cabeçalho */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Nome do Destinatário *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPedido.nome_destinatario}
                    onChange={(e) =>
                      setEditingPedido({ ...editingPedido, nome_destinatario: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Classificação do Destino
                  </label>
                  <select
                    value={editingPedido.classifica_destino || ''}
                    onChange={(e) =>
                      setEditingPedido({ ...editingPedido, classifica_destino: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                  >
                    <option value="">Sem classificação</option>
                    {CLASSIFICACOES_DESTINO.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Morada *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPedido.morada}
                    onChange={(e) =>
                      setEditingPedido({ ...editingPedido, morada: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Código Postal *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPedido.codigo_postal}
                    onChange={(e) =>
                      setEditingPedido({ ...editingPedido, codigo_postal: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Localidade *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPedido.localidade}
                    onChange={(e) =>
                      setEditingPedido({ ...editingPedido, localidade: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    País
                  </label>
                  <input
                    type="text"
                    value={editingPedido.pais}
                    onChange={(e) =>
                      setEditingPedido({ ...editingPedido, pais: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Ref. Documento
                  </label>
                  <input
                    type="text"
                    value={editingPedido.ref_documento || ''}
                    onChange={(e) =>
                      setEditingPedido({ ...editingPedido, ref_documento: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Data do Pedido *
                  </label>
                  <input
                    type="date"
                    required
                    value={editingPedido.data_pedido}
                    onChange={(e) =>
                      setEditingPedido({ ...editingPedido, data_pedido: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Data de Entrega
                  </label>
                  <input
                    type="date"
                    value={editingPedido.data_entrega || ''}
                    onChange={(e) =>
                      setEditingPedido({ ...editingPedido, data_entrega: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Estado
                  </label>
                  <select
                    value={editingPedido.status}
                    onChange={(e) =>
                      setEditingPedido({ ...editingPedido, status: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                  >
                    {STATUS_DB_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Observações
                  </label>
                  <input
                    type="text"
                    value={editingPedido.observacoes || ''}
                    onChange={(e) =>
                      setEditingPedido({ ...editingPedido, observacoes: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                  />
                </div>

                <div className="flex items-center gap-5 pt-5">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPedido.processar}
                      onChange={(e) =>
                        setEditingPedido({ ...editingPedido, processar: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-sermail-green focus:ring-sermail-green"
                    />
                    <span className="font-bold text-slate-700">Processar</span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingPedido.processado}
                      onChange={(e) =>
                        setEditingPedido({ ...editingPedido, processado: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                    />
                    <span className="font-bold text-slate-700">Processado</span>
                  </label>
                </div>
              </div>

              {/* Secção Acrescentar Nova Linha ao Pedido */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sermail-green text-base">
                    add_circle
                  </span>
                  <h4 className="font-bold text-slate-800 text-xs">
                    Acrescentar Linha ao Pedido
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Artigo
                    </label>
                    <select
                      value={newLineArtigoCli}
                      onChange={(e) => handleSelectNewLineArtigo(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                    >
                      <option value="">Selecionar artigo...</option>
                      {editingClientArtigos.map((art) => (
                        <option key={art.artigo_cli} value={art.artigo_cli}>
                          {art.artigo_id} - {art.descricao}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Lote
                    </label>
                    {availableLotesForNewLine.length > 0 ? (
                      <select
                        value={newLineLote}
                        onChange={(e) => handleSelectNewLineLote(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                      >
                        {availableLotesForNewLine.map((l) => (
                          <option key={`${l.lote}-${l.validade}`} value={l.lote || ''}>
                            {l.lote} (Stock: {l.stock})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Indicar lote..."
                        value={newLineLote}
                        onChange={(e) => setNewLineLote(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newLineQuantidade}
                      onChange={(e) => setNewLineQuantidade(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-right font-bold focus:outline-none focus:ring-2 focus:ring-sermail-green/20 focus:border-sermail-green"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddLineToEditingPedido}
                      className="w-full px-3 py-2 rounded-lg bg-sermail-green text-white text-xs font-bold hover:bg-sermail-green-dark inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>

              {/* Secção Linhas do Pedido */}
              <div>
                <h3 className="font-bold text-slate-800 mb-2">
                  Linhas do Pedido ({editingPedido.linhas.length})
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                        <th className="py-2.5 px-3">Código</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-3">Lote</th>
                        <th className="py-2.5 px-3">Validade</th>
                        <th className="py-2.5 px-3 text-right">Quantidade</th>
                        <th className="py-2.5 px-3 text-center">Remover</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editingPedido.linhas.map((linha, idx) => (
                        <tr key={linha.id}>
                          <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">
                            {linha.artigo_cli || linha.artigo_id}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={linha.descricao}
                              onChange={(e) => {
                                const novas = [...editingPedido.linhas];
                                novas[idx] = { ...novas[idx], descricao: e.target.value };
                                setEditingPedido({ ...editingPedido, linhas: novas });
                              }}
                              className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-xs"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={linha.lote}
                              onChange={(e) => {
                                const novas = [...editingPedido.linhas];
                                novas[idx] = { ...novas[idx], lote: e.target.value };
                                setEditingPedido({ ...editingPedido, linhas: novas });
                              }}
                              className="w-28 px-2.5 py-1.5 rounded border border-slate-200 text-xs"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={linha.validade || ''}
                              onChange={(e) => {
                                const novas = [...editingPedido.linhas];
                                novas[idx] = { ...novas[idx], validade: e.target.value };
                                setEditingPedido({ ...editingPedido, linhas: novas });
                              }}
                              className="px-2.5 py-1.5 rounded border border-slate-200 text-xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min={1}
                              required
                              value={linha.quantidade}
                              onChange={(e) => {
                                const novas = [...editingPedido.linhas];
                                novas[idx] = {
                                  ...novas[idx],
                                  quantidade: Number(e.target.value),
                                };
                                setEditingPedido({ ...editingPedido, linhas: novas });
                              }}
                              className="w-24 px-2.5 py-1.5 rounded border border-slate-200 text-xs text-right font-bold"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveEditLine(linha.id)}
                              className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                              title="Remover linha"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={() => setEditingPedido(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-lg bg-sermail-green text-white text-xs font-bold hover:bg-sermail-green-dark disabled:opacity-50"
              >
                {isSavingEdit ? 'A guardar...' : 'Guardar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Confirmação para Apagar Pedido */}
      {deletingPedido && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">warning</span>
              </div>
              <h2 className="text-base font-bold text-slate-900">
                Apagar Pedido {deletingPedido.nr_pedido}?
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tem a certeza de que pretende apagar o pedido{' '}
                <span className="font-bold text-slate-800">{deletingPedido.nr_pedido}</span> do
                cliente{' '}
                <span className="font-bold text-slate-800">
                  {deletingPedido.clientes?.sigla} - {deletingPedido.clientes?.name}
                </span>
                ? Esta ação irá remover o pedido e todas as suas linhas e não pode ser revertida.
              </p>
            </div>
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingPedido(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'A apagar...' : 'Sim, Apagar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
