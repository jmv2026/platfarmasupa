'use client';

import { useState, useMemo, useRef } from 'react';
import { Client, UserProfile } from '@/lib/supabase/types';
import { useLanguage } from '@/lib/i18n/context';
import GraficoPedidosMensal from './grafico-pedidos-mensal';
import GraficoTopProdutos from './grafico-top-produtos';
import GraficoPrevisaoStock from './grafico-previsao-stock';


export interface DashboardStockItem {
  artigo_id: string;
  validade: string | null;
  stock: number;
  client_id: string;
  tipo_artigo?: string | null;
}

export interface DashboardStockPedidoItem {
  stock: number;
  client_id: string;
}

export interface DashboardPedidoLinhaItem {
  id: string;
  artigo_id?: string;
  artigo_codigo: string;
  descricao: string;
  quantidade: number;
}

export interface DashboardPedidoItem {
  id: string;
  client_id: string;
  data_pedido?: string | null;
  created_at?: string | null;
  pedido_linhas?: DashboardPedidoLinhaItem[];
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
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-PT';
  const [selectedClientId, setSelectedClientId] = useState<string>('todos');
  const [graficoAtivo, setGraficoAtivo] = useState<'pedidos' | 'top10' | 'previsao'>('pedidos');
  const [selectedArticleCodeForForecast, setSelectedArticleCodeForForecast] = useState<string | null>(null);
  const graficoContainerRef = useRef<HTMLDivElement>(null);

  // Posiciona a página para colocar o gráfico no centro do ecrã
  const handleSelecionarGrafico = (tipo: 'pedidos' | 'top10' | 'previsao') => {
    setGraficoAtivo(tipo);
    setTimeout(() => {
      if (graficoContainerRef.current) {
        graficoContainerRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
    }, 60);
  };

  // Seleciona um produto específico e navega para o Gráfico de Previsão de Stock
  const handleSelecionarProdutoPrevisao = (codigo: string) => {
    setSelectedArticleCodeForForecast(codigo);
    setGraficoAtivo('previsao');
    setTimeout(() => {
      if (graficoContainerRef.current) {
        graficoContainerRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
    }, 60);
  };

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

  // 2. Artigos em Risco (> 60d e < 180d - apenas MH) & 3. Artigos Bloqueados (> 0d e <= 60d)
  const { totalArtigosEmRisco, totalArtigosBloqueados } = useMemo(() => {
    const artigosEmRiscoSet = new Set<string>();
    const artigosBloqueadosSet = new Set<string>();

    filteredStockAtual.forEach((item) => {
      const days = getDaysUntilExpiry(item.validade);
      if (days !== null) {
        if (days > 0 && days <= 60) {
          artigosBloqueadosSet.add(item.artigo_id);
        } else if (days > 60 && days < 180) {
          // A validade de 180 dias apenas se aplica a medicamentos de uso humano (MH)
          const tipo = item.tipo_artigo ? String(item.tipo_artigo).trim().toUpperCase() : '';
          const isMH = tipo === 'MH' || tipo.startsWith('MH') || tipo.includes('HUMANO');
          if (isMH) {
            artigosEmRiscoSet.add(item.artigo_id);
          }
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
  const currentMonthName = t.dashboard.months[currentMonth] || 'Mês';

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
    <main className="w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Welcome Banner */}
      <div className="h-[50px] bg-primary-container text-on-primary rounded-xl px-5 flex items-center shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-[50px] w-full min-w-0">
          <h1 className="text-base sm:text-lg font-bold font-headline leading-none whitespace-nowrap text-white shrink-0">
            {t.dashboard.bannerTitle}
          </h1>
          <p className="text-xs sm:text-sm text-lime-300 font-medium truncate hidden sm:block">
            {t.dashboard.bannerSubtitle}
          </p>
        </div>
      </div>

      {/* Pull-down de seleção de cliente para Administradores e Gestores */}
      {isManagerOrAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2.5 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-base">filter_alt</span>
            <span className="text-xs font-bold text-on-surface">{t.dashboard.filterByClient}</span>
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
            <option value="todos">{t.dashboard.allClients}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.sigla}] {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* KPIs Grid (6 Indicadores atualizados dinamicamente - Texto adaptável em múltiplas linhas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 items-stretch">
        {/* 1. Artigos em Risco (Medicamentos Uso Humano) */}
        <div className="min-h-[100px] p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider leading-snug whitespace-normal break-words">
                {t.dashboard.kpiRiskItems}
              </span>
              <span className="text-[9px] sm:text-[9.5px] font-medium text-amber-800/90 leading-tight whitespace-normal mt-0.5">
                {t.dashboard.kpiHumanMeds}
              </span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
              <span className="material-symbols-outlined text-lg">warning</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1.5 flex-wrap pt-1">
            <span className="text-xl sm:text-2xl font-bold font-headline text-amber-600 leading-none">
              {totalArtigosEmRisco}
            </span>
            <span className="text-[10px] sm:text-[11px] text-amber-700 font-medium flex items-center gap-0.5 leading-tight whitespace-normal">
              <span className="material-symbols-outlined text-xs shrink-0">schedule</span>
              <span>{t.dashboard.kpiRiskPeriod}</span>
            </span>
          </div>
        </div>

        {/* 2. Artigos Bloqueados */}
        <div className="min-h-[100px] p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider leading-snug whitespace-normal break-words">
              {t.dashboard.kpiBlockedItems}
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600 shrink-0">
              <span className="material-symbols-outlined text-lg">block</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1.5 flex-wrap pt-1">
            <span className="text-xl sm:text-2xl font-bold font-headline text-rose-600 leading-none">
              {totalArtigosBloqueados}
            </span>
            <span className="text-[10px] sm:text-[11px] text-rose-700 font-medium flex items-center gap-0.5 leading-tight whitespace-normal">
              <span className="material-symbols-outlined text-xs shrink-0">error</span>
              <span>{t.dashboard.kpiBlockedPeriod}</span>
            </span>
          </div>
        </div>

        {/* 3. Pedidos do Mês em Curso */}
        <div className="min-h-[100px] p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider leading-snug whitespace-normal break-words">
              {t.dashboard.kpiOrdersMonth}
            </span>
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-700 shrink-0">
              <span className="material-symbols-outlined text-lg">calendar_month</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1.5 flex-wrap pt-1">
            <span className="text-xl sm:text-2xl font-bold font-headline text-teal-700 leading-none">
              {pedidosMesCount}
            </span>
            <span className="text-[10px] sm:text-[11px] text-teal-700 font-medium flex items-center gap-0.5 leading-tight whitespace-normal">
              <span className="material-symbols-outlined text-xs shrink-0">today</span>
              <span>{currentMonthName}</span>
            </span>
          </div>
        </div>

        {/* 4. Pedidos do Ano Corrente */}
        <div className="min-h-[100px] p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider leading-snug whitespace-normal break-words">
              {t.dashboard.kpiOrdersYear}
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-700 shrink-0">
              <span className="material-symbols-outlined text-lg">date_range</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1.5 flex-wrap pt-1">
            <span className="text-xl sm:text-2xl font-bold font-headline text-indigo-700 leading-none">
              {pedidosAnoCount}
            </span>
            <span className="text-[10px] sm:text-[11px] text-indigo-700 font-medium flex items-center gap-0.5 leading-tight whitespace-normal">
              <span className="material-symbols-outlined text-xs shrink-0">event</span>
              <span>{currentYear}</span>
            </span>
          </div>
        </div>

        {/* 5. Total Histórico de Pedidos */}
        <div className="min-h-[100px] p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider leading-snug whitespace-normal break-words">
              {t.dashboard.kpiTotalOrders}
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-500/10 flex items-center justify-center text-slate-700 shrink-0">
              <span className="material-symbols-outlined text-lg">receipt_long</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1.5 flex-wrap pt-1">
            <span className="text-xl sm:text-2xl font-bold font-headline text-slate-800 leading-none">
              {totalPedidosCount}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-600 font-medium flex items-center gap-0.5 leading-tight whitespace-normal">
              <span className="material-symbols-outlined text-xs shrink-0">history</span>
              <span>{t.common.total}</span>
            </span>
          </div>
        </div>

        {/* 6. Artigos com Stock */}
        <div className="min-h-[100px] p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider leading-snug whitespace-normal break-words">
              {t.dashboard.kpiActiveArticles}
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-700 shrink-0">
              <span className="material-symbols-outlined text-lg">medication</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1.5 flex-wrap pt-1">
            <span className="text-xl sm:text-2xl font-bold font-headline text-sky-800 leading-none">
              {totalArtigosCount}
            </span>
            <span className="text-[10px] sm:text-[11px] text-sky-700 font-medium flex items-center gap-0.5 leading-tight whitespace-normal">
              <span className="material-symbols-outlined text-xs shrink-0">inventory</span>
              <span>{t.common.warehouse}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Botões Separados de Seleção do Gráfico Ativo (Gráfico Pedidos / Gráfico Top 10 / Gráfico Previsão Stock) */}
      <div className="flex items-center gap-3 pt-1 flex-wrap">
        <button
          type="button"
          onClick={() => handleSelecionarGrafico('pedidos')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-xs cursor-pointer ${
            graficoAtivo === 'pedidos'
              ? 'bg-gradient-to-r from-lime-300 via-lime-200 to-emerald-300 text-emerald-950 border border-lime-500 font-extrabold shadow-sm'
              : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-lime-50/50 border border-lime-400/60 hover:border-lime-500'
          }`}
        >
          <span className="material-symbols-outlined text-base sm:text-lg text-emerald-800">insights</span>
          <span>{t.dashboard.chartMonthlyTitle}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelecionarGrafico('top10')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-xs cursor-pointer ${
            graficoAtivo === 'top10'
              ? 'bg-gradient-to-r from-lime-300 via-lime-200 to-emerald-300 text-emerald-950 border border-lime-500 font-extrabold shadow-sm'
              : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-lime-50/50 border border-lime-400/60 hover:border-lime-500'
          }`}
        >
          <span className="material-symbols-outlined text-base sm:text-lg text-emerald-800">leaderboard</span>
          <span>{t.dashboard.chartTop10Title}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelecionarGrafico('previsao')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all shadow-xs cursor-pointer ${
            graficoAtivo === 'previsao'
              ? 'bg-gradient-to-r from-lime-300 via-lime-200 to-emerald-300 text-emerald-950 border border-lime-500 font-extrabold shadow-sm'
              : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-lime-50/50 border border-lime-400/60 hover:border-lime-500'
          }`}
        >
          <span className="material-symbols-outlined text-base sm:text-lg text-emerald-800">trending_up</span>
          <span>{t.dashboard.chartForecastTitle}</span>
        </button>
      </div>

      {/* Container do Gráfico com Ref para Centralização Automática no Ecrã */}
      <div ref={graficoContainerRef} className="scroll-mt-8 transition-all">
        {graficoAtivo === 'pedidos' ? (
          <GraficoPedidosMensal
            pedidos={filteredPedidos}
            clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
          />
        ) : graficoAtivo === 'top10' ? (
          <GraficoTopProdutos
            pedidos={filteredPedidos}
            clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
            onSelectProdutoPrevisao={handleSelecionarProdutoPrevisao}
          />
        ) : (
          <GraficoPrevisaoStock
            stockAtual={filteredStockAtual}
            stockPedidos={filteredStockPedidos}
            pedidos={filteredPedidos}
            clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
            selectedArticleCode={selectedArticleCodeForForecast}
            onSelectArticleCode={setSelectedArticleCodeForForecast}
          />
        )}
      </div>
    </main>
  );
}

