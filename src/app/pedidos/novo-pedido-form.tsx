'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Client, StockPedido, NovaLinhaPedidoInput, UserProfile } from '@/lib/supabase/types';
import { criarPedidoAction } from './actions';

interface NovoPedidoFormProps {
  clients: Client[];
  stockPedidos: StockPedido[];
  currentUserProfile?: UserProfile | null;
}

export default function NovoPedidoForm({ clients, stockPedidos, currentUserProfile }: NovoPedidoFormProps) {
  const router = useRouter();

  // Permissões RBAC: Admin e Gestor podem selecionar qualquer cliente livremente
  const isManagerOrAdmin = currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'gestor';

  // Se não for admin nem gestor, o cliente proprietário é automaticamente o associado ao perfil
  const initialClientId = useMemo(() => {
    if (!isManagerOrAdmin && currentUserProfile?.client_id) {
      return currentUserProfile.client_id;
    }
    return clients[0]?.id || '';
  }, [isManagerOrAdmin, currentUserProfile, clients]);

  // Estados do Cabeçalho
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId);
  const [nomeDestinatario, setNomeDestinatario] = useState('');
  const [morada, setMorada] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [localidade, setLocalidade] = useState('');
  const [pais, setPais] = useState('Portugal');
  const [dataPedido, setDataPedido] = useState(new Date().toISOString().split('T')[0]);
  const [dataEntrega, setDataEntrega] = useState('');
  const [refDocumento, setRefDocumento] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Estados do Editor de Linhas
  const [selectedArtigoId, setSelectedArtigoId] = useState<string>('');
  const [selectedLote, setSelectedLote] = useState<string>('');
  const [quantidade, setQuantidade] = useState<number>(1);

  // Lista de Linhas do Pedido
  const [linhas, setLinhas] = useState<NovaLinhaPedidoInput[]>([]);

  // Estados de Submissão
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filtrar stock disponível para o cliente selecionado
  const clientStock = useMemo(() => {
    return stockPedidos.filter((s) => s.client_id === selectedClientId && Number(s.stock) > 0);
  }, [stockPedidos, selectedClientId]);

  // Cliente associado ao perfil de utilizador (quando não é admin nem gestor)
  const associatedClient = useMemo(() => {
    if (isManagerOrAdmin) return null;
    return clients.find((c) => c.id === currentUserProfile?.client_id) || null;
  }, [isManagerOrAdmin, clients, currentUserProfile]);

  // Lista única de artigos disponíveis para o cliente selecionado
  const availableArtigos = useMemo(() => {
    const map = new Map<string, { id: string; codigo: string; descricao: string }>();
    clientStock.forEach((s) => {
      if (!map.has(s.artigo_id)) {
        map.set(s.artigo_id, {
          id: s.artigo_id,
          codigo: s.artigo_codigo,
          descricao: s.artigo_descricao,
        });
      }
    });
    return Array.from(map.values());
  }, [clientStock]);

  // Lotes disponíveis para o artigo selecionado, ordenados por FEFO (Validade Ascendente)
  const availableLotes = useMemo(() => {
    if (!selectedArtigoId) return [];
    return clientStock
      .filter((s) => s.artigo_id === selectedArtigoId)
      .sort((a, b) => {
        if (!a.validade) return 1;
        if (!b.validade) return -1;
        return new Date(a.validade).getTime() - new Date(b.validade).getTime();
      });
  }, [clientStock, selectedArtigoId]);

  // Lote atualmente selecionado (objeto)
  const currentLoteObj = useMemo(() => {
    if (!selectedLote) return availableLotes[0] || null;
    return availableLotes.find((l) => l.lote === selectedLote) || availableLotes[0] || null;
  }, [availableLotes, selectedLote]);

  // Atualizar seleção de artigo e sugerir FEFO automaticamente
  const handleSelectArtigo = (artigoId: string) => {
    setSelectedArtigoId(artigoId);
    const lotesForArtigo = clientStock
      .filter((s) => s.artigo_id === artigoId)
      .sort((a, b) => {
        if (!a.validade) return 1;
        if (!b.validade) return -1;
        return new Date(a.validade).getTime() - new Date(b.validade).getTime();
      });

    if (lotesForArtigo.length > 0) {
      // Sugere o lote com menor data de validade (FEFO)
      setSelectedLote(lotesForArtigo[0].lote || '');
      setQuantidade(1);
    } else {
      setSelectedLote('');
      setQuantidade(1);
    }
  };

  // Adicionar linha à lista
  const handleAddLinha = () => {
    if (!selectedArtigoId || !currentLoteObj) {
      setFeedback({ type: 'error', message: 'Selecione um artigo e um lote com stock disponível.' });
      return;
    }

    if (quantidade <= 0) {
      setFeedback({ type: 'error', message: 'A quantidade deve ser superior a zero.' });
      return;
    }

    const availableStock = Number(currentLoteObj.stock);
    if (quantidade > availableStock) {
      setFeedback({
        type: 'error',
        message: `Quantidade indisponível. O lote ${currentLoteObj.lote} tem apenas ${availableStock} un em stock.`,
      });
      return;
    }

    // Verificar se a combinação artigo + lote já foi adicionada
    const existingIndex = linhas.findIndex(
      (l) => l.artigo_id === selectedArtigoId && l.lote === currentLoteObj.lote
    );

    if (existingIndex >= 0) {
      const updated = [...linhas];
      const novaQtd = updated[existingIndex].quantidade + quantidade;
      if (novaQtd > availableStock) {
        setFeedback({
          type: 'error',
          message: `A quantidade acumulada (${novaQtd} un) excede o stock disponível (${availableStock} un) do lote.`,
        });
        return;
      }
      updated[existingIndex].quantidade = novaQtd;
      setLinhas(updated);
    } else {
      const novaLinha: NovaLinhaPedidoInput = {
        artigo_id: selectedArtigoId,
        artigo_codigo: currentLoteObj.artigo_codigo,
        descricao: currentLoteObj.artigo_descricao,
        lote: currentLoteObj.lote || '',
        validade: currentLoteObj.validade,
        quantidade: quantidade,
        stock_disponivel: availableStock,
      };
      setLinhas([...linhas, novaLinha]);
    }

    setFeedback(null);
    setQuantidade(1);
  };

  // Remover linha da lista
  const handleRemoveLinha = (index: number) => {
    setLinhas(linhas.filter((_, i) => i !== index));
  };

  // Submeter Pedido Completo
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalClientId = !isManagerOrAdmin && currentUserProfile?.client_id
      ? currentUserProfile.client_id
      : selectedClientId;

    if (!finalClientId) {
      setFeedback({
        type: 'error',
        message: 'Não foi possível identificar o cliente proprietário do pedido. Contacte a administração.',
      });
      return;
    }

    if (!nomeDestinatario || !morada || !codigoPostal || !localidade) {
      setFeedback({ type: 'error', message: 'Preencha todos os campos obrigatórios do destinatário e morada.' });
      return;
    }
    if (linhas.length === 0) {
      setFeedback({ type: 'error', message: 'Adicione pelo menos uma linha de artigo ao pedido.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await criarPedidoAction({
        client_id: finalClientId,
        ref_documento: refDocumento || undefined,
        nome_destinatario: nomeDestinatario,
        morada,
        codigo_postal: codigoPostal,
        localidade,
        pais,
        data_pedido: dataPedido,
        data_entrega: dataEntrega || undefined,
        observacoes: observacoes || undefined,
        linhas,
      });

      if (res.success) {
        // Limpar feedback e resetar formulário
        setFeedback(null);
        setNomeDestinatario('');
        setMorada('');
        setCodigoPostal('');
        setLocalidade('');
        setRefDocumento('');
        setObservacoes('');
        setLinhas([]);
        setSelectedArtigoId('');
        setSelectedLote('');
        if (!isManagerOrAdmin && currentUserProfile?.client_id) {
          setSelectedClientId(currentUserProfile.client_id);
        } else {
          setSelectedClientId(clients[0]?.id || '');
        }
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao processar pedido.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const totalUnidades = linhas.reduce((acc, l) => acc + l.quantidade, 0);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between pb-6 border-b border-outline-variant/20 mb-6">
        <div>
          <h2 className="text-xl font-bold font-headline text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">add_shopping_cart</span>
            Criar Novo Pedido de Entrega
          </h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Registe uma nova ordem de expedição com alocação em tempo real e sugestão automática de lote <strong>FEFO</strong>.
          </p>
        </div>
      </div>

      {feedback && feedback.type === 'error' && (
        <div className="p-4 rounded-xl mb-6 text-xs sm:text-sm font-medium flex items-center gap-2.5 bg-rose-50 text-rose-800 border border-rose-200">
          <span className="material-symbols-outlined text-base">error</span>
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECÇÃO 1: Cliente & Dados Gerais */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">domain</span>
            1. Cliente Proprietário & Identificação do Pedido
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Cliente Proprietário do Stock <span className="text-rose-600">*</span>
              </label>

              {isManagerOrAdmin ? (
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    setSelectedArtigoId('');
                    setSelectedLote('');
                    setLinhas([]);
                  }}
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-medium cursor-pointer"
                  required
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.sigla}] {c.name}
                    </option>
                  ))}
                </select>
              ) : associatedClient ? (
                <div>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={`[${associatedClient.sigla}] ${associatedClient.name}`}
                    className="w-full bg-surface-container/70 border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface font-semibold cursor-not-allowed select-none opacity-90 shadow-inner"
                  />
                </div>
              ) : (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-rose-600">error</span>
                  <span>O seu utilizador não tem cliente associado. Contacte a administração.</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Ref. Documento / Requisição
              </label>
              <input
                type="text"
                value={refDocumento}
                onChange={(e) => setRefDocumento(e.target.value)}
                placeholder="Ex: REQ-2026-9910"
                className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Data Pedido <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={dataPedido}
                  onChange={(e) => setDataPedido(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Data Entrega
                </label>
                <input
                  type="date"
                  value={dataEntrega}
                  onChange={(e) => setDataEntrega(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECÇÃO 2: Dados de Destino / Morada */}
        <div className="space-y-4 pt-4 border-t border-outline-variant/20">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">local_shipping</span>
            2. Informações de Destino & Destinatário
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Nome do Destinatário / Entidade <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={nomeDestinatario}
                onChange={(e) => setNomeDestinatario(e.target.value)}
                placeholder="Ex: Hospital de Santa Maria / Farmácia Central"
                className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                required
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Morada de Entrega <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={morada}
                onChange={(e) => setMorada(e.target.value)}
                placeholder="Ex: Av. Professor Egas Moniz, Edifício Principal"
                className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Código Postal <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={codigoPostal}
                onChange={(e) => setCodigoPostal(e.target.value)}
                placeholder="1649-035"
                className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Localidade <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={localidade}
                onChange={(e) => setLocalidade(e.target.value)}
                placeholder="Lisboa"
                className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                required
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-on-surface mb-1">
                País
              </label>
              <input
                type="text"
                value={pais}
                onChange={(e) => setPais(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
          </div>
        </div>

        {/* SECÇÃO 3: Adição de Linhas do Pedido (com FEFO Inteligente) */}
        <div className="space-y-4 pt-4 border-t border-outline-variant/20 bg-surface-container/30 p-5 rounded-xl border border-outline-variant/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">medication</span>
              3. Adicionar Linha de Artigo (Critério FEFO Ativo)
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/10 text-secondary border border-secondary/20">
              <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
              FEFO: Menor Validade Sugerida por Omissão
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            {/* Pull Down 1: Artigo */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Artigo Disponível (Armazém 01)
              </label>
              <select
                value={selectedArtigoId}
                onChange={(e) => handleSelectArtigo(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
              >
                <option value="">-- Selecionar Artigo --</option>
                {availableArtigos.map((art) => (
                  <option key={art.id} value={art.id}>
                    [{art.codigo}] {art.descricao}
                  </option>
                ))}
              </select>
            </div>

            {/* Pull Down 2: Lote com indicação FEFO */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Lote Farmacêutico & Validade (Pull Down)
              </label>
              <select
                value={selectedLote}
                onChange={(e) => setSelectedLote(e.target.value)}
                disabled={!selectedArtigoId || availableLotes.length === 0}
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
              >
                {availableLotes.map((l, index) => (
                  <option key={l.lote} value={l.lote || ''}>
                    {index === 0 ? '⭐ [FEFO] ' : ''}Lote: {l.lote} | Val: {l.validade ? new Date(l.validade).toLocaleDateString('pt-PT') : 'N/D'} | Disp: {l.stock} un
                  </option>
                ))}
              </select>
            </div>

            {/* Quantidade */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Qtd (Max: {currentLoteObj ? currentLoteObj.stock : 0})
              </label>
              <input
                type="number"
                min="1"
                max={currentLoteObj ? Number(currentLoteObj.stock) : 1}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                disabled={!currentLoteObj}
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
              />
            </div>

            {/* Botão Adicionar Linha */}
            <div className="lg:col-span-2">
              <button
                type="button"
                onClick={handleAddLinha}
                disabled={!currentLoteObj || quantidade <= 0}
                className="w-full bg-secondary text-on-secondary px-3 py-2 rounded-lg text-xs font-bold hover:bg-secondary/90 transition-colors flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Adicionar
              </button>
            </div>
          </div>
        </div>

        {/* SECÇÃO 4: Tabela de Linhas do Pedido */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Linhas do Pedido ({linhas.length} {linhas.length === 1 ? 'item' : 'itens'} | {totalUnidades} un no total)
            </h4>
          </div>

          <div className="overflow-x-auto border border-outline-variant/30 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Lote</th>
                  <th className="py-2.5 px-3">Validade</th>
                  <th className="py-2.5 px-3 text-right">Qtd Requisitada</th>
                  <th className="py-2.5 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {linhas.length > 0 ? (
                  linhas.map((linha, idx) => (
                    <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                      <td className="py-2.5 px-3 text-on-surface-variant font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-medium">{linha.artigo_codigo}</td>
                      <td className="py-2.5 px-3 font-medium">{linha.descricao}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-secondary">{linha.lote}</td>
                      <td className="py-2.5 px-3 font-mono text-on-surface-variant">
                        {linha.validade ? new Date(linha.validade).toLocaleDateString('pt-PT') : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-secondary">
                        {linha.quantidade.toLocaleString('pt-PT')} <span className="text-[10px] font-normal text-on-surface-variant">un</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLinha(idx)}
                          className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition-colors"
                          title="Remover linha"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-on-surface-variant">
                      Nenhuma linha adicionada. Selecione um artigo e lote acima e clique em "Adicionar".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECÇÃO 5: Observações & Submissão */}
        <div className="space-y-4 pt-4 border-t border-outline-variant/20">
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Observações / Instruções de Expedição
            </label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Instruções para transportador, horários de entrega ou notas de embalamento..."
              className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-xs text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-600 text-sm">bolt</span>
              <span>Os movimentos de saída <strong>SS</strong> serão criados automaticamente em tempo real.</span>
            </div>

            <button
              type="submit"
              disabled={loading || linhas.length === 0}
              className="w-full sm:w-auto bg-primary text-on-primary hover:bg-primary/90 px-6 py-3 rounded-xl text-xs font-bold tracking-wide transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  A processar pedido e débitos de stock...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Confirmar Pedido & Debitar Stock ({totalUnidades} un)
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
