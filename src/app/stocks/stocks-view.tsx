'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  StockAtual,
  StockPedido,
  Client,
  TIPO_ARTIGO_LABELS,
  TIPO_ARMAZENAMENTO_LABELS,
  TIPO_ARMAZEM_LABELS,
  TipoArtigo,
  TipoArmazenamento,
  TipoArmazem,
  UserProfile,
} from '@/lib/supabase/types';

interface StocksViewProps {
  stockAtual: StockAtual[];
  stockPedidos: StockPedido[];
  clients: Client[];
  currentUserProfile: UserProfile | null;
}

type TabType = 'pedidos' | 'consolidado' | 'artigos' | 'validade';

export default function StocksView({
  stockAtual,
  stockPedidos,
  clients,
  currentUserProfile,
}: StocksViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('pedidos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('todos');
  const [selectedArmazenamento, setSelectedArmazenamento] = useState<string>('todos');
  const [selectedTipoArtigo, setSelectedTipoArtigo] = useState<string>('todos');
  const [selectedTipoArmazem, setSelectedTipoArmazem] = useState<string>('todos');

  const isManagerOrAdmin =
    currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'gestor';

  // Helper para calcular dias até à validade
  const getDaysUntilExpiry = (dateStr: string | null) => {
    if (!dateStr) return null;
    const expiry = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // KPIs
  const totalStockVenda = useMemo(() => {
    return stockPedidos.reduce((acc, curr) => acc + Number(curr.stock || 0), 0);
  }, [stockPedidos]);

  const totalStockOutros = useMemo(() => {
    return stockAtual
      .filter((s) => s.tipo_armazem !== '01')
      .reduce((acc, curr) => acc + Number(curr.stock || 0), 0);
  }, [stockAtual]);

  const totalLotes = useMemo(() => {
    const lotesSet = new Set<string>();
    stockAtual.forEach((s) => {
      if (s.lote) lotesSet.add(`${s.artigo_id}_${s.lote}`);
    });
    return lotesSet.size;
  }, [stockAtual]);

  const artigosDistintos = useMemo(() => {
    const artigosSet = new Set<string>();
    stockAtual.forEach((s) => artigosSet.add(s.artigo_id));
    return artigosSet.size;
  }, [stockAtual]);

  const lotesAlertaValidade = useMemo(() => {
    return stockAtual.filter((s) => {
      const days = getDaysUntilExpiry(s.validade);
      return days !== null && days <= 90;
    }).length;
  }, [stockAtual]);

  // Filtragem para Stock de Venda (vw_stock_pedidos)
  const filteredStockPedidos = useMemo(() => {
    return stockPedidos.filter((item) => {
      if (selectedClientId !== 'todos' && item.client_id !== selectedClientId) {
        return false;
      }
      if (
        selectedArmazenamento !== 'todos' &&
        item.tipo_armazenamento !== selectedArmazenamento
      ) {
        return false;
      }
      if (
        selectedTipoArtigo !== 'todos' &&
        item.tipo_artigo !== selectedTipoArtigo
      ) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchCod = item.artigo_codigo?.toLowerCase().includes(query);
        const matchDesc = item.artigo_descricao?.toLowerCase().includes(query);
        const matchLote = item.lote?.toLowerCase().includes(query);
        const matchCli = item.cliente_sigla?.toLowerCase().includes(query) || item.cliente_nome?.toLowerCase().includes(query);
        if (!matchCod && !matchDesc && !matchLote && !matchCli) {
          return false;
        }
      }
      return true;
    });
  }, [stockPedidos, selectedClientId, selectedArmazenamento, selectedTipoArtigo, searchTerm]);

  // Filtragem para Stock Consolidado (vw_stock_atual)
  const filteredStockAtual = useMemo(() => {
    return stockAtual.filter((item) => {
      if (selectedClientId !== 'todos' && item.client_id !== selectedClientId) {
        return false;
      }
      if (
        selectedArmazenamento !== 'todos' &&
        item.tipo_armazenamento !== selectedArmazenamento
      ) {
        return false;
      }
      if (
        selectedTipoArtigo !== 'todos' &&
        item.tipo_artigo !== selectedTipoArtigo
      ) {
        return false;
      }
      if (
        selectedTipoArmazem !== 'todos' &&
        item.tipo_armazem !== selectedTipoArmazem
      ) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchCod = item.artigo_codigo?.toLowerCase().includes(query);
        const matchDesc = item.artigo_descricao?.toLowerCase().includes(query);
        const matchLote = item.lote?.toLowerCase().includes(query);
        const matchArmLoc = item.armazem_loc?.toLowerCase().includes(query);
        const matchCli = item.cliente_sigla?.toLowerCase().includes(query) || item.cliente_nome?.toLowerCase().includes(query);
        if (!matchCod && !matchDesc && !matchLote && !matchArmLoc && !matchCli) {
          return false;
        }
      }
      return true;
    });
  }, [stockAtual, selectedClientId, selectedArmazenamento, selectedTipoArtigo, selectedTipoArmazem, searchTerm]);

  // Agrupamento por Artigo
  const resumoArtigos = useMemo(() => {
    const map = new Map<
      string,
      {
        artigo_id: string;
        artigo_codigo: string;
        artigo_descricao: string;
        cliente_sigla: string;
        tipo_artigo: TipoArtigo;
        tipo_armazenamento: TipoArmazenamento;
        stockVenda: number;
        stockOutros: number;
        stockTotal: number;
        lotesCount: Set<string>;
        primeiraValidade: string | null;
      }
    >();

    filteredStockAtual.forEach((item) => {
      const key = `${item.client_id}_${item.artigo_id}`;
      if (!map.has(key)) {
        map.set(key, {
          artigo_id: item.artigo_id,
          artigo_codigo: item.artigo_codigo,
          artigo_descricao: item.artigo_descricao,
          cliente_sigla: item.cliente_sigla,
          tipo_artigo: item.tipo_artigo,
          tipo_armazenamento: item.tipo_armazenamento,
          stockVenda: 0,
          stockOutros: 0,
          stockTotal: 0,
          lotesCount: new Set<string>(),
          primeiraValidade: item.validade,
        });
      }

      const obj = map.get(key)!;
      const qtd = Number(item.stock || 0);
      obj.stockTotal += qtd;
      if (item.tipo_armazem === '01') {
        obj.stockVenda += qtd;
      } else {
        obj.stockOutros += qtd;
      }
      if (item.lote) {
        obj.lotesCount.add(item.lote);
      }
      if (item.validade) {
        if (!obj.primeiraValidade || new Date(item.validade) < new Date(obj.primeiraValidade)) {
          obj.primeiraValidade = item.validade;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.stockTotal - a.stockTotal);
  }, [filteredStockAtual]);

  // Lotes para Alerta de Validade (FEFO)
  const lotesValidade = useMemo(() => {
    return [...filteredStockAtual]
      .filter((s) => s.validade)
      .sort((a, b) => {
        if (!a.validade) return 1;
        if (!b.validade) return -1;
        return new Date(a.validade).getTime() - new Date(b.validade).getTime();
      });
  }, [filteredStockAtual]);

  // Exportar CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (activeTab === 'pedidos') {
      csvContent += 'Cliente,Codigo Artigo,Descricao,Tipo Artigo,Conservacao,Lote,Validade,Stock Disponivel\n';
      filteredStockPedidos.forEach((r) => {
        csvContent += `"${r.cliente_sigla}","${r.artigo_codigo}","${r.artigo_descricao.replace(/"/g, '""')}","${r.tipo_artigo}","${r.tipo_armazenamento}","${r.lote || ''}","${r.validade || ''}",${r.stock}\n`;
      });
    } else if (activeTab === 'consolidado') {
      csvContent += 'Cliente,Codigo Artigo,Descricao,Lote,Validade,Armazem Loc,Tipo Armazem,Descricao Armazem,Stock\n';
      filteredStockAtual.forEach((r) => {
        csvContent += `"${r.cliente_sigla}","${r.artigo_codigo}","${r.artigo_descricao.replace(/"/g, '""')}","${r.lote || ''}","${r.validade || ''}","${r.armazem_loc}","${r.tipo_armazem}","${r.armazem_descricao || ''}",${r.stock}\n`;
      });
    } else if (activeTab === 'artigos') {
      csvContent += 'Cliente,Codigo Artigo,Descricao,Tipo Artigo,Conservacao,Stock Venda,Stock Outros,Stock Total,Lotes\n';
      resumoArtigos.forEach((r) => {
        csvContent += `"${r.cliente_sigla}","${r.artigo_codigo}","${r.artigo_descricao.replace(/"/g, '""')}","${r.tipo_artigo}","${r.tipo_armazenamento}",${r.stockVenda},${r.stockOutros},${r.stockTotal},${r.lotesCount.size}\n`;
      });
    } else {
      csvContent += 'Cliente,Codigo Artigo,Descricao,Lote,Validade,Dias Restantes,Armazem Loc,Stock\n';
      lotesValidade.forEach((r) => {
        const days = getDaysUntilExpiry(r.validade);
        csvContent += `"${r.cliente_sigla}","${r.artigo_codigo}","${r.artigo_descricao.replace(/"/g, '""')}","${r.lote || ''}","${r.validade || ''}",${days ?? ''},"${r.armazem_loc}",${r.stock}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stocks_export_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedClientId !== 'todos' ||
    selectedArmazenamento !== 'todos' ||
    selectedTipoArtigo !== 'todos' ||
    selectedTipoArmazem !== 'todos';

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedClientId('todos');
    setSelectedArmazenamento('todos');
    setSelectedTipoArtigo('todos');
    setSelectedTipoArmazem('todos');
  };

  return (
    <div className="space-y-6">
      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Stock Venda Livre</p>
              <p className="text-2xl font-bold font-headline text-secondary mt-1">
                {totalStockVenda.toLocaleString('pt-PT')}{' '}
                <span className="text-xs font-normal text-on-surface-variant">un</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-xl">shopping_cart_checkout</span>
            </div>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">check_circle</span>
            Armazém 01 (Expedição Imediata)
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Stock Outros Armazéns</p>
              <p className="text-2xl font-bold font-headline text-on-surface mt-1">
                {totalStockOutros.toLocaleString('pt-PT')}{' '}
                <span className="text-xs font-normal text-on-surface-variant">un</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-700">
              <span className="material-symbols-outlined text-xl">warehouse</span>
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">info</span>
            Quarentena, Devoluções, etc.
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Lotes Ativos</p>
              <p className="text-2xl font-bold font-headline text-on-surface mt-1">{totalLotes}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">qr_code_2</span>
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">inventory_2</span>
            Rastreabilidade FEFO
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Artigos em Armazém</p>
              <p className="text-2xl font-bold font-headline text-on-surface mt-1">
                {artigosDistintos}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-700">
              <span className="material-symbols-outlined text-xl">medication</span>
            </div>
          </div>
          <p className="text-[11px] text-indigo-700 font-medium mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">category</span>
            TF, TC e TA
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Alertas Validade</p>
              <p className={`text-2xl font-bold font-headline mt-1 ${lotesAlertaValidade > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {lotesAlertaValidade}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${lotesAlertaValidade > 0 ? 'bg-rose-500/10 text-rose-700' : 'bg-emerald-500/10 text-emerald-700'}`}>
              <span className="material-symbols-outlined text-xl">warning</span>
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">event_upcoming</span>
            Expiração ≤ 90 dias
          </p>
        </div>
      </div>

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
              placeholder="Pesquisar por código do artigo, descrição, lote ou armazém..."
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

          {/* Botão de Exportar CSV */}
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
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-surface-container border border-outline-variant/40 text-on-surface hover:bg-surface-container-high font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm text-secondary">download</span>
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Linha de Filtros Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-outline-variant/15">
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

          {/* Filtro Conservação */}
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
              Conservação / Temperatura
            </label>
            <select
              value={selectedArmazenamento}
              onChange={(e) => setSelectedArmazenamento(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              <option value="todos">Todas as Temperaturas</option>
              <option value="TF">TF - Frio (2-8 ºC)</option>
              <option value="TC">TC - Controlada (15-25 ºC)</option>
              <option value="TA">TA - Temperatura Ambiente</option>
            </select>
          </div>

          {/* Filtro Tipo Artigo */}
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
              Tipo de Artigo
            </label>
            <select
              value={selectedTipoArtigo}
              onChange={(e) => setSelectedTipoArtigo(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="MH">MH - Medicamento Humano</option>
              <option value="MV">MV - Medicamento Veterinário</option>
              <option value="DM">DM - Dispositivo Médico</option>
              <option value="DC">DC - Dermo-Cosmético</option>
              <option value="SC">SC - Substância Controlada</option>
            </select>
          </div>

          {/* Filtro Tipo Armazém */}
          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
              Tipo de Armazém
            </label>
            <select
              value={selectedTipoArmazem}
              onChange={(e) => setSelectedTipoArmazem(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              <option value="todos">Todos os Armazéns</option>
              <option value="01">01 - Venda (Disponível)</option>
              <option value="05">05 - Quarentena</option>
              <option value="04">04 - Devoluções</option>
              <option value="02">02 - Expirados</option>
              <option value="03">03 - Danificados</option>
              <option value="06">06 - Destruição</option>
              <option value="07">07 - Farmacoteca</option>
            </select>
          </div>
        </div>
      </div>

      {/* Abas de Navegação de Stock */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
        <div className="border-b border-outline-variant/20 px-6 pt-4 bg-surface-container/20">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('pedidos')}
              className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'pedidos'
                  ? 'border-secondary text-secondary bg-surface-container-lowest rounded-t-xl shadow-sm'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container/40 rounded-t-xl'
              }`}
            >
              <span className="material-symbols-outlined text-base">shopping_cart_checkout</span>
              Stock Venda Livre (Armazém 01)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container text-on-secondary-container">
                {filteredStockPedidos.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('consolidado')}
              className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'consolidado'
                  ? 'border-secondary text-secondary bg-surface-container-lowest rounded-t-xl shadow-sm'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container/40 rounded-t-xl'
              }`}
            >
              <span className="material-symbols-outlined text-base">inventory</span>
              Stock Consolidado (Todos Armazéns)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container text-on-secondary-container">
                {filteredStockAtual.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('artigos')}
              className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'artigos'
                  ? 'border-secondary text-secondary bg-surface-container-lowest rounded-t-xl shadow-sm'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container/40 rounded-t-xl'
              }`}
            >
              <span className="material-symbols-outlined text-base">category</span>
              Resumo por Artigo
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container text-on-secondary-container">
                {resumoArtigos.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('validade')}
              className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'validade'
                  ? 'border-secondary text-secondary bg-surface-container-lowest rounded-t-xl shadow-sm'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container/40 rounded-t-xl'
              }`}
            >
              <span className="material-symbols-outlined text-base">event_upcoming</span>
              Controlo de Validades (FEFO)
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lotesAlertaValidade > 0 ? 'bg-rose-100 text-rose-800' : 'bg-secondary-container text-on-secondary-container'}`}>
                {lotesValidade.length}
              </span>
            </button>
          </div>
        </div>

        {/* Conteúdo da Aba Ativa */}
        <div className="p-6">
          {/* TAB 1: Stock Venda Livre (vw_stock_pedidos) */}
          {activeTab === 'pedidos' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/15 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">check_circle</span>
                    Stock Alocável para Pedidos e Expedição Comercial
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Artigos em Armazém 01 disponíveis para saída imediata com ordenação inteligente FEFO.
                  </p>
                </div>
                <Link
                  href="/pedidos"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-on-secondary hover:bg-secondary/90 font-bold text-xs shadow-sm transition-all self-start sm:self-auto"
                >
                  <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                  Fazer Pedido
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Cliente</th>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Descrição do Artigo</th>
                      <th className="py-2.5 px-3">Tipo Artigo</th>
                      <th className="py-2.5 px-3">Conservação</th>
                      <th className="py-2.5 px-3">Lote</th>
                      <th className="py-2.5 px-3">Validade</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Stock Disponível</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {filteredStockPedidos.length > 0 ? (
                      filteredStockPedidos.map((item, idx) => {
                        const days = getDaysUntilExpiry(item.validade);
                        const isExpired = days !== null && days <= 0;
                        const isWarning = days !== null && days > 0 && days <= 90;

                        return (
                          <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                            <td className="py-3 px-3 font-semibold">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                                {item.cliente_sigla}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-medium">{item.artigo_codigo}</td>
                            <td className="py-3 px-3 font-medium">{item.artigo_descricao}</td>
                            <td className="py-3 px-3">
                              <span className="text-[11px] text-on-surface-variant">
                                {TIPO_ARTIGO_LABELS[item.tipo_artigo as TipoArtigo] || item.tipo_artigo}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  item.tipo_armazenamento === 'TF'
                                    ? 'bg-cyan-100 text-cyan-800'
                                    : item.tipo_armazenamento === 'TC'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[12px]">
                                  {item.tipo_armazenamento === 'TF' ? 'ac_unit' : 'thermostat'}
                                </span>
                                {TIPO_ARMAZENAMENTO_LABELS[item.tipo_armazenamento as TipoArmazenamento] ||
                                  item.tipo_armazenamento}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-semibold text-secondary">
                              {item.lote}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-on-surface-variant">
                                  {item.validade
                                    ? new Date(item.validade).toLocaleDateString('pt-PT')
                                    : '-'}
                                </span>
                                {isExpired && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                                    Expirado
                                  </span>
                                )}
                                {isWarning && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                    {days}d
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                              {Number(item.stock).toLocaleString('pt-PT')}{' '}
                              <span className="text-xs font-normal text-on-surface-variant">un</span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-3xl mb-1 text-on-surface-variant/40 block">
                            inventory_2
                          </span>
                          Nenhum artigo com stock de venda livre encontrado com os filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Stock Consolidado (vw_stock_atual) */}
          {activeTab === 'consolidado' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-outline-variant/15">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">warehouse</span>
                  Visão Consolidada por Armazém Físico e Localização
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Registo detalhado de todos os lotes por armazém (<code className="text-xs bg-surface-container px-1 py-0.5 rounded font-mono text-secondary">armazem_loc</code>), incluindo Venda, Quarentena, Devoluções e Expirados.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Cliente</th>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Descrição Artigo</th>
                      <th className="py-2.5 px-3">Lote</th>
                      <th className="py-2.5 px-3">Validade</th>
                      <th className="py-2.5 px-3">Armazém Loc</th>
                      <th className="py-2.5 px-3">Tipo Armazém</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {filteredStockAtual.length > 0 ? (
                      filteredStockAtual.map((item, idx) => (
                        <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                              {item.cliente_sigla}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-medium">{item.artigo_codigo}</td>
                          <td className="py-3 px-3 font-medium">{item.artigo_descricao}</td>
                          <td className="py-3 px-3 font-mono text-secondary font-semibold">
                            {item.lote}
                          </td>
                          <td className="py-3 px-3 font-mono text-on-surface-variant">
                            {item.validade
                              ? new Date(item.validade).toLocaleDateString('pt-PT')
                              : '-'}
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold text-secondary-600">
                            {item.armazem_loc}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                                item.tipo_armazem === '01'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.tipo_armazem === '05'
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.tipo_armazem === '02'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {item.armazem_descricao || `Armazém ${item.tipo_armazem}`}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                            {Number(item.stock).toLocaleString('pt-PT')}{' '}
                            <span className="text-xs font-normal text-on-surface-variant">un</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-3xl mb-1 text-on-surface-variant/40 block">
                            warehouse
                          </span>
                          Nenhum registo consolidado encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Resumo por Artigo */}
          {activeTab === 'artigos' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-outline-variant/15">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">category</span>
                  Stock Total Agregado por Artigo
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Consolidação do stock total em todos os armazéns e lotes para cada artigo.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Cliente</th>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Descrição do Artigo</th>
                      <th className="py-2.5 px-3">Tipo Artigo</th>
                      <th className="py-2.5 px-3">Conservação</th>
                      <th className="py-2.5 px-3 text-center">Nº Lotes</th>
                      <th className="py-2.5 px-3">Próx. Validade</th>
                      <th className="py-2.5 px-3 text-right">Stock Venda</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Stock Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {resumoArtigos.length > 0 ? (
                      resumoArtigos.map((item, idx) => (
                        <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                              {item.cliente_sigla}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-medium">{item.artigo_codigo}</td>
                          <td className="py-3 px-3 font-medium">{item.artigo_descricao}</td>
                          <td className="py-3 px-3">
                            <span className="text-[11px] text-on-surface-variant">
                              {TIPO_ARTIGO_LABELS[item.tipo_artigo] || item.tipo_artigo}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                item.tipo_armazenamento === 'TF'
                                  ? 'bg-cyan-100 text-cyan-800'
                                  : item.tipo_armazenamento === 'TC'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">
                                {item.tipo_armazenamento === 'TF' ? 'ac_unit' : 'thermostat'}
                              </span>
                              {TIPO_ARMAZENAMENTO_LABELS[item.tipo_armazenamento] ||
                                item.tipo_armazenamento}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold">
                            <span className="px-2 py-0.5 bg-surface-container rounded-full text-[11px]">
                              {item.lotesCount.size}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-on-surface-variant">
                            {item.primeiraValidade
                              ? new Date(item.primeiraValidade).toLocaleDateString('pt-PT')
                              : '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700">
                            {item.stockVenda.toLocaleString('pt-PT')}{' '}
                            <span className="text-[10px] text-on-surface-variant">un</span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                            {item.stockTotal.toLocaleString('pt-PT')}{' '}
                            <span className="text-xs font-normal text-on-surface-variant">un</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-on-surface-variant">
                          Nenhum artigo encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Controlo de Validades (FEFO Monitor) */}
          {activeTab === 'validade' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-outline-variant/15">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">event_upcoming</span>
                  Monitorização Preventiva de Validades & Lotes (FEFO)
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Lotes ordenados por data de expiração mais próxima para priorização de expedição e gestão preventiva.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Estado</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Descrição Artigo</th>
                      <th className="py-2.5 px-3">Lote</th>
                      <th className="py-2.5 px-3">Data Validade</th>
                      <th className="py-2.5 px-3">Dias Restantes</th>
                      <th className="py-2.5 px-3">Armazém Loc</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {lotesValidade.length > 0 ? (
                      lotesValidade.map((item, idx) => {
                        const days = getDaysUntilExpiry(item.validade);
                        const isExpired = days !== null && days <= 0;
                        const isCritical = days !== null && days > 0 && days <= 30;
                        const isWarning = days !== null && days > 30 && days <= 90;

                        return (
                          <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                            <td className="py-3 px-3">
                              {isExpired ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                  EXPIRADO
                                </span>
                              ) : isCritical ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse"></span>
                                  CRÍTICO (&le;30d)
                                </span>
                              ) : isWarning ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                  ALERTA (&le;90d)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                  NORMAL
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-semibold">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                                {item.cliente_sigla}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-medium">{item.artigo_codigo}</td>
                            <td className="py-3 px-3 font-medium">{item.artigo_descricao}</td>
                            <td className="py-3 px-3 font-mono font-bold text-secondary">{item.lote}</td>
                            <td className="py-3 px-3 font-mono font-semibold">
                              {item.validade ? new Date(item.validade).toLocaleDateString('pt-PT') : '-'}
                            </td>
                            <td className="py-3 px-3 font-mono">
                              {days !== null ? (
                                <span className={days <= 30 ? 'text-rose-600 font-bold' : days <= 90 ? 'text-amber-700 font-semibold' : 'text-on-surface-variant'}>
                                  {days <= 0 ? `${Math.abs(days)} dias atrás` : `${days} dias`}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-secondary-600 font-medium">
                              {item.armazem_loc}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                              {Number(item.stock).toLocaleString('pt-PT')}{' '}
                              <span className="text-xs font-normal text-on-surface-variant">un</span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-on-surface-variant">
                          Nenhum lote com data de validade registada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
