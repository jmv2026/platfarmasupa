'use client';

import { useState, useMemo } from 'react';
import { Client, UserProfile } from '@/lib/supabase/types';
import GraficoPedidosMensal from './grafico-pedidos-mensal';

export interface DashboardStockItem {
  artigo_id: string;
  validade: string | null;
  stock: number;
  client_id: string;
}

export interface DashboardStockPedidoItem {
  stock: number;
  client_id: string;
}

export interface DashboardPedidoItem {
  id: string;
  client_id: string;
  data_pedido?: string | null;
  created_at?: string | null;
}

interface DashboardViewProps {
  clients: Client[];
  stockAtual: DashboardStockItem[];
  stockPedidos: DashboardStockPedidoItem[];
  pedidos: DashboardPedidoItem[];
  currentUserProfile: UserProfile | null;
  isManagerOrAdmin: boolean;
}

export default function DashboardView({
  clients,
  stockAtual,
  stockPedidos,
  pedidos,
  currentUserProfile,
  isManagerOrAdmin,
}: DashboardViewProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>('todos');

  // Helper para calcular dias até à validade
  const getDaysUntilExpiry = (dateStr: string | null) => {
    if (!dateStr) return null;
    const expiry = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Filtragem dos dados de acordo com a seleção de cliente
  const filteredStockAtual = useMemo(() => {
    if (!isManagerOrAdmin || selectedClientId === 'todos') {
      return stockAtual;
    }
    return stockAtual.filter((s) => s.client_id === selectedClientId);
  }, [stockAtual, selectedClientId, isManagerOrAdmin]);

  const filteredStockPedidos = useMemo(() => {
    if (!isManagerOrAdmin || selectedClientId === 'todos') {
      return stockPedidos;
    }
    return stockPedidos.filter((s) => s.client_id === selectedClientId);
  }, [stockPedidos, selectedClientId, isManagerOrAdmin]);

  const filteredPedidos = useMemo(() => {
    if (!isManagerOrAdmin || selectedClientId === 'todos') {
      return pedidos;
    }
    return pedidos.filter((p) => p.client_id === selectedClientId);
  }, [pedidos, selectedClientId, isManagerOrAdmin]);

  // 1. Stock Venda
  const totalStockVenda = useMemo(() => {
    return filteredStockPedidos.reduce((acc, curr) => acc + Number(curr.stock || 0), 0);
  }, [filteredStockPedidos]);

  // 2. Artigos em Risco (> 60d e < 180d) & 3. Artigos Bloqueados (> 0d e <= 60d)
  const { totalArtigosEmRisco, totalArtigosBloqueados } = useMemo(() => {
    const artigosEmRiscoSet = new Set<string>();
    const artigosBloqueadosSet = new Set<string>();

    filteredStockAtual.forEach((item) => {
      const days = getDaysUntilExpiry(item.validade);
      if (days !== null) {
        if (days > 0 && days <= 60) {
          artigosBloqueadosSet.add(item.artigo_id);
        } else if (days > 60 && days < 180) {
          artigosEmRiscoSet.add(item.artigo_id);
        }
      }
    });

    return {
      totalArtigosEmRisco: artigosEmRiscoSet.size,
      totalArtigosBloqueados: artigosBloqueadosSet.size,
    };
  }, [filteredStockAtual]);

  // 4. Pedidos do Mês Corrente, Ano Corrente e Total Histórico
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const currentMonthName = monthNames[currentMonth];

  const { pedidosMesCount, pedidosAnoCount, totalPedidosCount } = useMemo(() => {
    let mes = 0;
    let ano = 0;

    filteredPedidos.forEach((p) => {
      const rawDate = p.data_pedido || p.created_at;
      if (rawDate) {
        const d = new Date(rawDate);
        if (d.getFullYear() === currentYear) {
          ano++;
          if (d.getMonth() === currentMonth) {
            mes++;
          }
        }
      }
    });

    return {
      pedidosMesCount: mes,
      pedidosAnoCount: ano,
      totalPedidosCount: filteredPedidos.length,
    };
  }, [filteredPedidos, currentYear, currentMonth]);

  // 5. Artigos pertencentes ao cliente (existentes no stock ativo)
  const totalArtigosCount = useMemo(() => {
    const artigosSet = new Set<string>();
    filteredStockAtual.forEach((item) => {
      if (item.artigo_id) {
        artigosSet.add(item.artigo_id);
      }
    });
    return artigosSet.size;
  }, [filteredStockAtual]);

  const selectedClientObj = useMemo(() => {
    if (selectedClientId === 'todos') return null;
    return clients.find((c) => c.id === selectedClientId);
  }, [clients, selectedClientId]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="h-[50px] bg-gradient-to-r from-primary-container to-primary text-on-primary rounded-xl px-5 flex items-center shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-[50px] w-full min-w-0">
          <h1 className="text-base sm:text-lg font-bold font-headline leading-none whitespace-nowrap text-white shrink-0">
            Painel Informativo
          </h1>
          <p className="text-xs sm:text-sm text-on-primary/80 font-normal truncate hidden sm:block">
            Visão geral das operações de armazém, encomendas e controlo de stocks.
          </p>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/4 bg-secondary/15 pointer-events-none"></div>
      </div>

      {/* Pull-down de seleção de cliente para Administradores e Gestores */}
      {isManagerOrAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-base">filter_alt</span>
            <span className="text-xs font-bold text-on-surface">Filtrar por Cliente:</span>
            {selectedClientObj && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/10 border border-secondary/20 text-xs font-semibold text-secondary">
                [{selectedClientObj.sigla}] {selectedClientObj.name}
              </span>
            )}
          </div>
          <select
            id="dashboard-client-select"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-3 py-1.5 bg-surface-container-low text-on-surface border border-outline-variant/40 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer shadow-xs min-w-[240px]"
          >
            <option value="todos">Todos os Clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.sigla}] {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* KPIs Grid (Indicadores atualizados dinamicamente) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 sm:gap-5">
        {/* 1. Stock Venda */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Stock Venda</p>
              <p className="text-2xl font-bold font-headline text-secondary mt-1">
                {totalStockVenda.toLocaleString('pt-PT')}{' '}
                <span className="text-xs font-normal text-on-surface-variant">un</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
              <span className="material-symbols-outlined text-xl">inventory_2</span>
            </div>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">check_circle</span>
            Armazém 01 (Venda)
          </p>
        </div>

        {/* 2. Artigos em Risco */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Artigos em Risco</p>
              <p className="text-2xl font-bold font-headline text-amber-600 mt-1">
                {totalArtigosEmRisco}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
              <span className="material-symbols-outlined text-xl">warning</span>
            </div>
          </div>
          <p className="text-[11px] text-amber-700 font-medium mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">schedule</span>
            Validade 60 a 180 dias
          </p>
        </div>

        {/* 3. Artigos Bloqueados */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Artigos Bloqueados</p>
              <p className="text-2xl font-bold font-headline text-rose-600 mt-1">
                {totalArtigosBloqueados}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600 shrink-0">
              <span className="material-symbols-outlined text-xl">block</span>
            </div>
          </div>
          <p className="text-[11px] text-rose-700 font-medium mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">error</span>
            Validade 1 a 60 dias
          </p>
        </div>

        {/* 4. Pedidos do Mês em Curso */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Pedidos (Mês)</p>
              <p className="text-2xl font-bold font-headline text-teal-700 mt-1">
                {pedidosMesCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-700 shrink-0">
              <span className="material-symbols-outlined text-xl">calendar_month</span>
            </div>
          </div>
          <p className="text-[11px] text-teal-700 font-medium mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">today</span>
            {currentMonthName} {currentYear}
          </p>
        </div>

        {/* 5. Pedidos do Ano Corrente */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Pedidos (Ano)</p>
              <p className="text-2xl font-bold font-headline text-indigo-700 mt-1">
                {pedidosAnoCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-700 shrink-0">
              <span className="material-symbols-outlined text-xl">date_range</span>
            </div>
          </div>
          <p className="text-[11px] text-indigo-700 font-medium mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">event</span>
            Ano {currentYear}
          </p>
        </div>

        {/* 6. Total Histórico de Pedidos */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Total Pedidos</p>
              <p className="text-2xl font-bold font-headline text-on-surface mt-1">
                {totalPedidosCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center text-slate-700 shrink-0">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-700 font-medium mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">history</span>
            Total acumulado
          </p>
        </div>

        {/* 7. Artigos com Stock */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Artigos</p>
              <p className="text-2xl font-bold font-headline text-on-surface mt-1">
                {totalArtigosCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-700 shrink-0">
              <span className="material-symbols-outlined text-xl">medication</span>
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">inventory</span>
            Artigos em armazém
          </p>
        </div>
      </div>

      {/* Gráfico de Evolução Mensal do Nº de Pedidos (Tons Verde Pastel & Lima) */}
      <GraficoPedidosMensal
        pedidos={filteredPedidos}
        clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
      />
    </main>
  );
}
