'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Client, UserProfile } from '@/lib/supabase/types';
import { useLanguage } from '@/lib/i18n/context';
import GraficoPedidosMensal from './grafico-pedidos-mensal';
import GraficoTopProdutos from './grafico-top-produtos';
import GraficoFaturacaoMensal from './grafico-faturacao-mensal';

export interface DashboardFaturacaoItem {
  sigla_cliente: string | null;
  data: string | null;
  total_merc: number | null;
  total_iva: number | null;
  total_desc: number | null;
}


export interface DashboardStockItem {
  artigo_id: string;
  artigo_codigo?: string | null;
  artigo_descricao?: string | null;
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
  faturacao: DashboardFaturacaoItem[];
  currentUserProfile: UserProfile | null;
  isManagerOrAdmin: boolean;
}

export default function DashboardView({
  clients,
  stockAtual,
  stockPedidos,
  pedidos,
  faturacao,
  currentUserProfile,
  isManagerOrAdmin,
}: DashboardViewProps) {
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-PT';
  const router = useRouter();
  const [selectedClientId, setSelectedClientId] = useState<string>('todos');
  const [graficoAtivo, setGraficoAtivo] = useState<'pedidos' | 'top10' | 'faturacao'>('pedidos');
  const graficoContainerRef = useRef<HTMLDivElement>(null);

  // Posiciona a página para colocar o gráfico no centro do ecrã
  const handleSelecionarGrafico = (tipo: 'pedidos' | 'top10' | 'faturacao') => {
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

  // Redireciona para a nova página dedicada de Previsão de Stock com o produto selecionado
  const handleSelecionarProdutoPrevisao = (codigo: string) => {
    const clientQuery = selectedClientId !== 'todos' ? `&cliente=${encodeURIComponent(selectedClientId)}` : '';
    router.push(`/dashboard/previsao-stock?codigo=${encodeURIComponent(codigo)}${clientQuery}`);
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

  const filteredFaturacao = useMemo(() => {
    if (!isManagerOrAdmin || selectedClientId === 'todos') {
      const clientObj = clients.find(c => c.id === (isManagerOrAdmin ? selectedClientId : currentUserProfile?.client_id));
      if (!clientObj || !clientObj.sigla) return faturacao;
      return faturacao.filter(f => f.sigla_cliente === clientObj.sigla);
    }
    const selectedClient = clients.find(c => c.id === selectedClientId);
    if (!selectedClient) return faturacao;
    return faturacao.filter((f) => f.sigla_cliente === selectedClient.sigla);
  }, [faturacao, selectedClientId, isManagerOrAdmin, clients, currentUserProfile]);

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

  const effectiveClientObj = isManagerOrAdmin
    ? (selectedClientId === 'todos' ? null : clients.find(c => c.id === selectedClientId))
    : clients.find(c => c.id === currentUserProfile?.client_id);

  const showFaturacao = effectiveClientObj?.tipo_cliente === 'CF';

  return (
    <main className="w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Welcome Banner Sermail */}
      <div className="bg-gradient-to-r from-sermail-green-dark via-sermail-green to-[#005a46] text-white rounded-2xl px-6 py-4 shadow-sm relative overflow-hidden border border-emerald-950/30">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-sermail-lime-border shrink-0 border border-white/10">
              <span className="material-symbols-outlined text-xl">analytics</span>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold font-headline leading-tight text-white">
                {t.dashboard.bannerTitle}
              </h1>
              <p className="text-xs sm:text-sm text-lime-300/90 font-medium">
                {t.dashboard.bannerSubtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="badge-sermail-lime shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-sermail-lime-vibrant"></span>
              {t.nav.plataformaFarma}
            </span>
          </div>
        </div>
      </div>

      {/* Pull-down de seleção de cliente para Administradores e Gestores */}
      {isManagerOrAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl px-5 py-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-sermail-green flex items-center justify-center shrink-0 border border-emerald-100">
              <span className="material-symbols-outlined text-base">filter_alt</span>
            </div>
            <span className="text-xs font-bold text-slate-800">{t.dashboard.filterByClient}</span>
            {selectedClientObj && (
              <span className="badge-sermail-green">
                [{selectedClientObj.sigla}] {selectedClientObj.name}
              </span>
            )}
          </div>
          <select
            id="dashboard-client-select"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100/80 text-slate-900 border border-slate-300/90 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sermail-green cursor-pointer shadow-2xs min-w-[260px] transition-all"
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

      {/* KPIs Grid (6 Indicadores com espaço livre amplo, cantos refinados e contraste WCAG AAA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-stretch">
        {/* 1. Artigos em Risco (Medicamentos Uso Humano) */}
        <div className="sermail-card p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider leading-tight">
                {t.dashboard.kpiRiskItems}
              </span>
              <span className="text-[11px] font-semibold text-amber-700 leading-tight mt-0.5">
                {t.dashboard.kpiHumanMeds}
              </span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">warning</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 flex-wrap pt-1">
            <span className="text-2xl sm:text-3xl font-extrabold font-headline text-amber-600 leading-none">
              {totalArtigosEmRisco}
            </span>
            <span className="text-[11px] text-amber-800 font-semibold flex items-center gap-1 leading-tight">
              <span className="material-symbols-outlined text-xs shrink-0">schedule</span>
              <span>{t.dashboard.kpiRiskPeriod}</span>
            </span>
          </div>
        </div>

        {/* 2. Artigos Bloqueados */}
        <div className="sermail-card p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider leading-tight">
              {t.dashboard.kpiBlockedItems}
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">block</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 flex-wrap pt-1">
            <span className="text-2xl sm:text-3xl font-extrabold font-headline text-rose-600 leading-none">
              {totalArtigosBloqueados}
            </span>
            <span className="text-[11px] text-rose-800 font-semibold flex items-center gap-1 leading-tight">
              <span className="material-symbols-outlined text-xs shrink-0">error</span>
              <span>{t.dashboard.kpiBlockedPeriod}</span>
            </span>
          </div>
        </div>

        {/* 3. Pedidos do Mês em Curso */}
        <div className="sermail-card p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider leading-tight">
              {t.dashboard.kpiOrdersMonth}
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/60 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">calendar_month</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 flex-wrap pt-1">
            <span className="text-2xl sm:text-3xl font-extrabold font-headline text-teal-800 leading-none">
              {pedidosMesCount}
            </span>
            <span className="text-[11px] text-teal-800 font-semibold flex items-center gap-1 leading-tight">
              <span className="material-symbols-outlined text-xs shrink-0">today</span>
              <span>{currentMonthName}</span>
            </span>
          </div>
        </div>

        {/* 4. Pedidos do Ano Corrente */}
        <div className="sermail-card p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider leading-tight">
              {t.dashboard.kpiOrdersYear}
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">date_range</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 flex-wrap pt-1">
            <span className="text-2xl sm:text-3xl font-extrabold font-headline text-indigo-800 leading-none">
              {pedidosAnoCount}
            </span>
            <span className="text-[11px] text-indigo-800 font-semibold flex items-center gap-1 leading-tight">
              <span className="material-symbols-outlined text-xs shrink-0">event</span>
              <span>{currentYear}</span>
            </span>
          </div>
        </div>

        {/* 5. Total Histórico de Pedidos */}
        <div className="sermail-card p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider leading-tight">
              {t.dashboard.kpiTotalOrders}
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">receipt_long</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 flex-wrap pt-1">
            <span className="text-2xl sm:text-3xl font-extrabold font-headline text-slate-900 leading-none">
              {totalPedidosCount}
            </span>
            <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1 leading-tight">
              <span className="material-symbols-outlined text-xs shrink-0">history</span>
              <span>{t.common.total}</span>
            </span>
          </div>
        </div>

        {/* 6. Artigos com Stock */}
        <div className="sermail-card p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider leading-tight">
              {t.dashboard.kpiActiveArticles}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-sermail-green border border-emerald-200/60 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">medication</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 flex-wrap pt-1">
            <span className="text-2xl sm:text-3xl font-extrabold font-headline text-sermail-green-dark leading-none">
              {totalArtigosCount}
            </span>
            <span className="text-[11px] text-sermail-green font-semibold flex items-center gap-1 leading-tight">
              <span className="material-symbols-outlined text-xs shrink-0">inventory</span>
              <span>{t.common.warehouse}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Botões de Seleção do Gráfico com identidade Sermail limpa */}
      <div className="flex items-center gap-2.5 pt-1 flex-wrap">
        <button
          type="button"
          onClick={() => handleSelecionarGrafico('pedidos')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
            graficoAtivo === 'pedidos'
              ? 'bg-sermail-green text-white shadow-sm border border-sermail-green-dark'
              : 'bg-white text-slate-700 hover:text-sermail-green-dark hover:bg-slate-50 border border-slate-200/90 shadow-2xs font-semibold'
          }`}
        >
          <span className={`material-symbols-outlined text-base ${graficoAtivo === 'pedidos' ? 'text-sermail-lime-border' : 'text-slate-400'}`}>insights</span>
          <span>{t.dashboard.chartMonthlyTitle}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelecionarGrafico('top10')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
            graficoAtivo === 'top10'
              ? 'bg-sermail-green text-white shadow-sm border border-sermail-green-dark'
              : 'bg-white text-slate-700 hover:text-sermail-green-dark hover:bg-slate-50 border border-slate-200/90 shadow-2xs font-semibold'
          }`}
        >
          <span className={`material-symbols-outlined text-base ${graficoAtivo === 'top10' ? 'text-sermail-lime-border' : 'text-slate-400'}`}>leaderboard</span>
          <span>{t.dashboard.chartTop10Title}</span>
        </button>

        {showFaturacao && (
          <button
            type="button"
            onClick={() => handleSelecionarGrafico('faturacao')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              graficoAtivo === 'faturacao'
                ? 'bg-sermail-green text-white shadow-sm border border-sermail-green-dark'
                : 'bg-white text-slate-700 hover:text-sermail-green-dark hover:bg-slate-50 border border-slate-200/90 shadow-2xs font-semibold'
            }`}
          >
            <span className={`material-symbols-outlined text-base ${graficoAtivo === 'faturacao' ? 'text-sermail-lime-border' : 'text-slate-400'}`}>euro_symbol</span>
            <span>Faturação Mensal</span>
          </button>
        )}

        <Link
          href={selectedClientId !== 'todos' ? `/dashboard/previsao-stock?cliente=${encodeURIComponent(selectedClientId)}` : '/dashboard/previsao-stock'}
          prefetch={true}
          className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer bg-white text-sermail-green hover:bg-sermail-lime-light border border-slate-200/90 hover:border-sermail-lime-border shadow-2xs group"
          title={t.dashboard.chartForecastDesc}
        >
          <span className="material-symbols-outlined text-base text-sermail-green">trending_up</span>
          <span>{t.dashboard.chartForecastTitle}</span>
          <span className="material-symbols-outlined text-xs text-slate-400 group-hover:text-sermail-green group-hover:translate-x-0.5 transition-all">
            open_in_new
          </span>
        </Link>
      </div>

      {/* Container do Gráfico com Ref para Centralização Automática no Ecrã */}
      <div ref={graficoContainerRef} className="scroll-mt-8 transition-all">
        {graficoAtivo === 'faturacao' && showFaturacao ? (
          <GraficoFaturacaoMensal
            faturacao={filteredFaturacao}
            clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
          />
        ) : graficoAtivo === 'pedidos' ? (
          <GraficoPedidosMensal
            pedidos={filteredPedidos}
            clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
          />
        ) : (
          <GraficoTopProdutos
            pedidos={filteredPedidos}
            clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
            onSelectProdutoPrevisao={handleSelecionarProdutoPrevisao}
          />
        )}
      </div>
    </main>
  );
}

