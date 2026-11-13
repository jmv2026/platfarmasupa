'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Client, UserProfile } from '@/lib/supabase/types';
import { useLanguage } from '@/lib/i18n/context';
import GraficoPedidosMensal from './grafico-pedidos-mensal';
import type { DashboardEntradaESItem } from './grafico-kpi-rececoes';

const GraficoTopProdutos = dynamic(() => import('./grafico-top-produtos'));
const GraficoFaturacaoMensal = dynamic(() => import('./grafico-faturacao-mensal'));
const GraficoFaturacaoArtigo = dynamic(() => import('./grafico-faturacao-artigo'));
const GraficoKpiRececoes = dynamic(() => import('./grafico-kpi-rececoes'));

export interface DashboardFaturacaoItem {
  sigla_cliente: string | null;
  cliente_id?: string | null;
  data: string | null;
  total_docs?: number | null;
  total_quantidade?: number | null;
  total_merc: number | null;
  total_iva: number | null;
  total_desc: number | null;
  total_liquido?: number | null;
}


export interface DashboardStockItem {
  artigo_id: string;
  artigo_cli?: string | null;
  descricao?: string | null;
  validade: string | null;
  stock: number;
  cliente_id?: string;
  tipo_artigo?: string | null;
}

export interface DashboardPedidoLinhaItem {
  id: string;
  artigo_id?: string;
  artigo_codigo: string;
  descricao: string;
  tipo_desc?: string;
  quantidade: number;
}

export interface DashboardPedidoItem {
  id: string;
  documento_ref?: string | null;
  cliente_id?: string;
  data_pedido?: string | null;
  created_at?: string | null;
  total_linhas?: number;
  total_quantidade?: number;
  sigla?: string | null;
  nome?: string | null;
  entidade?: string | null;
  tipo_doc?: string | null;
  pedido_linhas?: DashboardPedidoLinhaItem[];
}

export interface DashboardSaidaItem {
  id: string;
  cliente_id: string;
  sigla?: string | null;
  artigo_cli: string;
  artigo_id?: string;
  descricao?: string;
  artigo?: string;
  artigo_codigo?: string;
  artigo_descricao?: string;
  tipo_desc?: string;
  quantidade: number;
  valor_unitario?: number | string | null;
  valor_adicional?: number | string | null;
  valor_abater?: number | string | null;
  tipo_doc?: string | null;
  data?: string | null;
  data_movimento?: string | null;
  created_at?: string | null;
  documento_ref?: string | null;
  lote?: string | null;
}

interface DashboardViewProps {
  clients: Client[];
  stockAtual: DashboardStockItem[];
  pedidos: DashboardPedidoItem[];
  saidas: DashboardSaidaItem[];
  entradas?: DashboardEntradaESItem[];
  faturacao: DashboardFaturacaoItem[];
  currentUserProfile: UserProfile | null;
  isManagerOrAdmin: boolean;
}

export default function DashboardView({
  clients,
  stockAtual,
  pedidos,
  saidas = [],
  entradas = [],
  faturacao,
  currentUserProfile,
  isManagerOrAdmin,
}: DashboardViewProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [selectedClientId, setSelectedClientId] = useState<string>('todos');
  const [graficoAtivo, setGraficoAtivo] = useState<'pedidos' | 'top10' | 'faturacao' | 'faturacao_artigo' | 'kpi_rececoes'>('pedidos');
  const [visitedCharts, setVisitedCharts] = useState<Set<'pedidos' | 'top10' | 'faturacao' | 'faturacao_artigo' | 'kpi_rececoes'>>(() => new Set(['pedidos']));
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  const graficoContainerRef = useRef<HTMLDivElement>(null);

  // Relógio com data e hora atualizados em tempo real para a janela de informação
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'pt-PT';
      const datePart = now.toLocaleDateString(locale, {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      const timePart = now.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const formattedDate = datePart.charAt(0).toUpperCase() + datePart.slice(1);
      setCurrentDateTime(`${formattedDate} • ${timePart}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [language]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'top10' || tab === 'pedidos' || tab === 'faturacao' || tab === 'faturacao_artigo' || tab === 'kpi_rececoes') {
        setGraficoAtivo(tab);
        setVisitedCharts((prev) => new Set([...prev, tab]));
      }
      const clienteParam = params.get('cliente');
      if (clienteParam) {
        setSelectedClientId(clienteParam);
      }
    }
  }, []);

  // Posiciona a página para colocar o gráfico no centro do ecrã
  const handleSelecionarGrafico = (tipo: 'pedidos' | 'top10' | 'faturacao' | 'faturacao_artigo' | 'kpi_rececoes') => {
    setGraficoAtivo(tipo);
    setVisitedCharts((prev) => {
      if (prev.has(tipo)) return prev;
      const next = new Set(prev);
      next.add(tipo);
      return next;
    });
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

  const selectedClientObj = useMemo(() => {
    if (selectedClientId === 'todos') return null;
    return clients.find((c) => c.id === selectedClientId);
  }, [clients, selectedClientId]);

  // Filtragem dos dados de acordo com a seleção de cliente
  const filteredStockAtual = useMemo(() => {
    if (!isManagerOrAdmin || selectedClientId === 'todos') {
      return stockAtual;
    }
    return stockAtual.filter((s) => s.cliente_id === selectedClientId);
  }, [stockAtual, selectedClientId, isManagerOrAdmin]);


  const filteredPedidos = useMemo(() => {
    if (!isManagerOrAdmin || selectedClientId === 'todos') {
      return pedidos;
    }
    return pedidos.filter(
      (p) => p.cliente_id === selectedClientId || (selectedClientObj?.sigla && p.sigla === selectedClientObj.sigla)
    );
  }, [pedidos, selectedClientId, selectedClientObj, isManagerOrAdmin]);

  const filteredSaidas = useMemo(() => {
    if (!isManagerOrAdmin || selectedClientId === 'todos') {
      return saidas;
    }
    return saidas.filter(
      (s) => s.cliente_id === selectedClientId || (selectedClientObj?.sigla && s.sigla === selectedClientObj.sigla)
    );
  }, [saidas, selectedClientId, selectedClientObj, isManagerOrAdmin]);

  const filteredFaturacao = useMemo(() => {
    if (!isManagerOrAdmin || selectedClientId === 'todos') {
      return faturacao;
    }
    return faturacao.filter(
      (f) => f.cliente_id === selectedClientId || (selectedClientObj?.sigla && f.sigla_cliente === selectedClientObj.sigla)
    );
  }, [faturacao, selectedClientId, selectedClientObj, isManagerOrAdmin]);

  const filteredEntradas = useMemo(() => {
    if (!isManagerOrAdmin || selectedClientId === 'todos') {
      return entradas;
    }
    return entradas.filter(
      (e) =>
        e.cliente_id === selectedClientId ||
        (selectedClientObj?.sigla &&
          (e.sigla === selectedClientObj.sigla || e.cliente_ser === selectedClientObj.sigla))
    );
  }, [entradas, selectedClientId, selectedClientObj, isManagerOrAdmin]);


  // 2. Artigos em Risco (> 60d e < 180d - apenas MH) & 3. Artigos Bloqueados (> 0d e <= 60d)
  const { totalArtigosEmRisco, totalArtigosBloqueados } = useMemo(() => {
    const artigosEmRiscoSet = new Set<string>();
    const artigosBloqueadosSet = new Set<string>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    filteredStockAtual.forEach((item) => {
      if (!item.validade) return;
      const expiryMs = new Date(item.validade).getTime();
      if (isNaN(expiryMs)) return;
      const days = Math.ceil((expiryMs - todayMs) / MS_PER_DAY);

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

  const effectiveClientObj = isManagerOrAdmin
    ? (selectedClientId === 'todos' ? null : clients.find(c => c.id === selectedClientId))
    : clients.find(c => c.id === currentUserProfile?.cliente_id);

  const hasClientComFaturacao = useMemo(() => {
    return clients.some(c => c.tipo_cliente === 'CF');
  }, [clients]);

  const showFaturacao = isManagerOrAdmin
    ? (selectedClientId === 'todos' ? hasClientComFaturacao : effectiveClientObj?.tipo_cliente === 'CF')
    : effectiveClientObj?.tipo_cliente === 'CF';

  return (
    <main className="w-full px-4 sm:px-6 pt-1 pb-6 space-y-4 sm:space-y-6">
      {/* Welcome Banner Sermail (Reduzido para 2/3 da altura: 48px / h-12) */}
      <div className="bg-gradient-to-r from-sermail-green-dark via-sermail-green to-[#005a46] text-white rounded-xl px-4 sm:px-6 h-12 flex items-center shadow-sm relative overflow-hidden border border-emerald-950/30">
        <div className="relative z-10 flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center text-sermail-lime-border shrink-0 border border-white/10">
              <span className="material-symbols-outlined text-base">analytics</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-[2cm] min-w-0">
              <h1 className="text-sm sm:text-base font-bold font-headline leading-none text-white whitespace-nowrap shrink-0">
                {t.dashboard.bannerTitle}
              </h1>
              <p className="text-xs sm:text-sm text-lime-300/90 font-medium leading-normal truncate">
                {t.dashboard.bannerSubtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Informação (Banner com info ou fallback de Data/Hora) + Filtro por Cliente à extrema direita */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl px-4 py-2.5 shadow-2xs min-h-[48px]">
        {/* Espaço à esquerda: Apresenta o banner se info estiver preenchido, senão apresenta Data e Hora (ambos com fundo cor lima) */}
        {effectiveClientObj?.info && effectiveClientObj.info.trim().length > 0 ? (
          <div className="flex items-center gap-3 bg-gradient-to-r from-lime-200 via-lime-300/90 to-lime-200 border border-lime-400 rounded-xl px-3.5 py-2.5 text-slate-950 shadow-2xs flex-1 min-w-0 overflow-hidden relative">
            <div className="w-8 h-8 rounded-lg bg-sermail-green-dark text-lime-300 flex items-center justify-center shrink-0 shadow-2xs z-10 border border-emerald-950/20">
              <span className="material-symbols-outlined text-lg">campaign</span>
            </div>
            <div className="flex-1 min-w-0 overflow-hidden relative flex items-center">
              <div className="animate-marquee-seamless hover:[animation-play-state:paused] cursor-default flex items-center">
                {[0, 1, 2, 3].map((copyIdx) => (
                  <div
                    key={copyIdx}
                    className="flex items-center gap-8 pr-8 shrink-0 select-none"
                    aria-hidden={copyIdx > 0 ? 'true' : undefined}
                  >
                    <span className="text-base sm:text-lg font-bold text-slate-950 tracking-tight">
                      {effectiveClientObj.info}
                    </span>
                    <span className="text-emerald-800 text-xs font-black">•</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-gradient-to-r from-lime-200 via-lime-300/90 to-lime-200 border border-lime-400 rounded-xl px-3.5 py-2 text-slate-950 shadow-2xs flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-sermail-green-dark text-lime-300 border border-emerald-950/20 flex items-center justify-center shrink-0 shadow-2xs">
              <span className="material-symbols-outlined text-lg">schedule</span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base sm:text-lg font-bold text-slate-950 tracking-tight font-headline">
                {currentDateTime || 'A carregar data e hora...'}
              </span>
            </div>
          </div>
        )}

        {/* Janela Reduzida ao Mínimo Indispensável para Filtrar por Cliente (apenas Admin/Gestor) à extrema direita */}
        {isManagerOrAdmin && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 rounded-xl px-3 py-1.5 shadow-2xs shrink-0 self-start md:self-center ml-auto">
            <span className="material-symbols-outlined text-sermail-green text-base">filter_alt</span>
            <label htmlFor="dashboard-client-select" className="text-xs font-bold text-slate-700 whitespace-nowrap">
              Filtrar:
            </label>
            <select
              id="dashboard-client-select"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-sermail-green cursor-pointer shadow-2xs max-w-[200px] sm:max-w-[240px] transition-all truncate"
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
      </div>

      {/* KPIs Grid (6 Indicadores superiores compactos a 2/3 da altura com elegância e alto contraste) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 items-stretch">
        {/* 1. Artigos em Risco (Medicamentos Uso Humano) */}
        <div className="sermail-card px-3 py-1.5 sm:px-3.5 sm:py-2 flex flex-col justify-between gap-1">
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider leading-tight truncate">
                {t.dashboard.kpiRiskItems}
              </span>
              <span className="text-[9px] font-semibold text-amber-700 leading-tight">
                {t.dashboard.kpiHumanMeds}
              </span>
            </div>
            <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-sm">warning</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap">
            <span className="text-lg sm:text-xl font-extrabold font-headline text-amber-600 leading-none">
              {totalArtigosEmRisco}
            </span>
            <span className="text-[9.5px] text-amber-800 font-semibold flex items-center gap-0.5 leading-tight">
              <span className="material-symbols-outlined text-[10px] shrink-0">schedule</span>
              <span>{t.dashboard.kpiRiskPeriod}</span>
            </span>
          </div>
        </div>

        {/* 2. Artigos Bloqueados */}
        <div className="sermail-card px-3 py-1.5 sm:px-3.5 sm:py-2 flex flex-col justify-between gap-1">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider leading-tight">
              {t.dashboard.kpiBlockedItems}
            </span>
            <div className="w-6 h-6 rounded-md bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-sm">block</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap">
            <span className="text-lg sm:text-xl font-extrabold font-headline text-rose-600 leading-none">
              {totalArtigosBloqueados}
            </span>
            <span className="text-[9.5px] text-rose-800 font-semibold flex items-center gap-0.5 leading-tight">
              <span className="material-symbols-outlined text-[10px] shrink-0">error</span>
              <span>{t.dashboard.kpiBlockedPeriod}</span>
            </span>
          </div>
        </div>

        {/* 3. Pedidos do Mês em Curso */}
        <div className="sermail-card px-3 py-1.5 sm:px-3.5 sm:py-2 flex flex-col justify-between gap-1">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider leading-tight">
              {t.dashboard.kpiOrdersMonth}
            </span>
            <div className="w-6 h-6 rounded-md bg-teal-50 text-teal-700 border border-teal-200/60 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-sm">calendar_month</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap">
            <span className="text-lg sm:text-xl font-extrabold font-headline text-teal-800 leading-none">
              {pedidosMesCount}
            </span>
            <span className="text-[9.5px] text-teal-800 font-semibold flex items-center gap-0.5 leading-tight">
              <span className="material-symbols-outlined text-[10px] shrink-0">today</span>
              <span>{currentMonthName}</span>
            </span>
          </div>
        </div>

        {/* 4. Pedidos do Ano Corrente */}
        <div className="sermail-card px-3 py-1.5 sm:px-3.5 sm:py-2 flex flex-col justify-between gap-1">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider leading-tight">
              {t.dashboard.kpiOrdersYear}
            </span>
            <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-sm">date_range</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap">
            <span className="text-lg sm:text-xl font-extrabold font-headline text-indigo-800 leading-none">
              {pedidosAnoCount}
            </span>
            <span className="text-[9.5px] text-indigo-800 font-semibold flex items-center gap-0.5 leading-tight">
              <span className="material-symbols-outlined text-[10px] shrink-0">event</span>
              <span>{currentYear}</span>
            </span>
          </div>
        </div>

        {/* 5. Total Histórico de Pedidos */}
        <div className="sermail-card px-3 py-1.5 sm:px-3.5 sm:py-2 flex flex-col justify-between gap-1">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider leading-tight">
              {t.dashboard.kpiTotalOrders}
            </span>
            <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-sm">receipt_long</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap">
            <span className="text-lg sm:text-xl font-extrabold font-headline text-slate-900 leading-none">
              {totalPedidosCount}
            </span>
            <span className="text-[9.5px] text-slate-600 font-semibold flex items-center gap-0.5 leading-tight">
              <span className="material-symbols-outlined text-[10px] shrink-0">history</span>
              <span>{t.common.total}</span>
            </span>
          </div>
        </div>

        {/* 6. Artigos com Stock */}
        <div className="sermail-card px-3 py-1.5 sm:px-3.5 sm:py-2 flex flex-col justify-between gap-1">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider leading-tight">
              {t.dashboard.kpiActiveArticles}
            </span>
            <div className="w-6 h-6 rounded-md bg-emerald-50 text-sermail-green border border-emerald-200/60 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-sm">medication</span>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap">
            <span className="text-lg sm:text-xl font-extrabold font-headline text-sermail-green-dark leading-none">
              {totalArtigosCount}
            </span>
            <span className="text-[9.5px] text-sermail-green font-semibold flex items-center gap-0.5 leading-tight">
              <span className="material-symbols-outlined text-[10px] shrink-0">inventory</span>
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
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 border border-lime-400 transition-all cursor-pointer ${
            graficoAtivo === 'pedidos'
              ? 'bg-sermail-green text-white shadow-sm'
              : 'bg-white text-slate-700 hover:text-sermail-green-dark hover:bg-slate-50 shadow-2xs font-semibold'
          }`}
        >
          <span className={`material-symbols-outlined text-base ${graficoAtivo === 'pedidos' ? 'text-sermail-lime-border' : 'text-slate-400'}`}>insights</span>
          <span>{t.dashboard.chartMonthlyTitle}</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelecionarGrafico('top10')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 border border-lime-400 transition-all cursor-pointer ${
            graficoAtivo === 'top10'
              ? 'bg-sermail-green text-white shadow-sm'
              : 'bg-white text-slate-700 hover:text-sermail-green-dark hover:bg-slate-50 shadow-2xs font-semibold'
          }`}
        >
          <span className={`material-symbols-outlined text-base ${graficoAtivo === 'top10' ? 'text-sermail-lime-border' : 'text-slate-400'}`}>leaderboard</span>
          <span>{t.dashboard.chartTop10Title}</span>
        </button>

        {showFaturacao && (
          <>
            <button
              type="button"
              onClick={() => handleSelecionarGrafico('faturacao')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 border border-lime-400 transition-all cursor-pointer ${
                graficoAtivo === 'faturacao'
                  ? 'bg-sermail-green text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:text-sermail-green-dark hover:bg-slate-50 shadow-2xs font-semibold'
              }`}
            >
              <span className={`material-symbols-outlined text-base ${graficoAtivo === 'faturacao' ? 'text-sermail-lime-border' : 'text-slate-400'}`}>euro_symbol</span>
              <span>Faturação Mensal</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelecionarGrafico('faturacao_artigo')}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 border border-lime-400 transition-all cursor-pointer ${
                graficoAtivo === 'faturacao_artigo'
                  ? 'bg-sermail-green text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:text-sermail-green-dark hover:bg-slate-50 shadow-2xs font-semibold'
              }`}
            >
              <span className={`material-symbols-outlined text-base ${graficoAtivo === 'faturacao_artigo' ? 'text-sermail-lime-border' : 'text-slate-400'}`}>category</span>
              <span>Faturação Artigo</span>
            </button>
          </>
        )}

        <Link
          href={selectedClientId !== 'todos' ? `/dashboard/previsao-stock?cliente=${encodeURIComponent(selectedClientId)}` : '/dashboard/previsao-stock'}
          prefetch={true}
          className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer bg-white text-sermail-green hover:bg-sermail-lime-light border border-lime-400 shadow-2xs group"
          title={t.dashboard.chartForecastDesc}
        >
          <span className="material-symbols-outlined text-base text-sermail-green">trending_up</span>
          <span>{t.dashboard.chartForecastTitle}</span>
          <span className="material-symbols-outlined text-xs text-slate-400 group-hover:text-sermail-green group-hover:translate-x-0.5 transition-all">
            open_in_new
          </span>
        </Link>

        <button
          type="button"
          onClick={() => handleSelecionarGrafico('kpi_rececoes')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 border border-lime-400 transition-all cursor-pointer ${
            graficoAtivo === 'kpi_rececoes'
              ? 'bg-sermail-green text-white shadow-sm'
              : 'bg-white text-slate-700 hover:text-sermail-green-dark hover:bg-slate-50 shadow-2xs font-semibold'
          }`}
        >
          <span className={`material-symbols-outlined text-base ${graficoAtivo === 'kpi_rececoes' ? 'text-sermail-lime-border' : 'text-slate-400'}`}>inventory_2</span>
          <span>KPI Receções</span>
        </button>
      </div>

      {/* Container do Gráfico com Ref para Centralização Automática no Ecrã e transição instantânea de abas */}
      <div ref={graficoContainerRef} className="scroll-mt-8 transition-all">
        {visitedCharts.has('pedidos') && (
          <div className={graficoAtivo === 'pedidos' ? 'block' : 'hidden'}>
            <GraficoPedidosMensal
              pedidos={filteredPedidos}
              clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
              onSelectKpiRececoes={() => handleSelecionarGrafico('kpi_rececoes')}
            />
          </div>
        )}

        {visitedCharts.has('kpi_rececoes') && (
          <div className={graficoAtivo === 'kpi_rececoes' ? 'block' : 'hidden'}>
            <GraficoKpiRececoes
              entradas={filteredEntradas}
              clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
            />
          </div>
        )}

        {visitedCharts.has('top10') && (
          <div className={graficoAtivo === 'top10' ? 'block' : 'hidden'}>
            <GraficoTopProdutos
              saidas={filteredSaidas}
              clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
              onSelectProdutoPrevisao={handleSelecionarProdutoPrevisao}
            />
          </div>
        )}

        {showFaturacao && visitedCharts.has('faturacao') && (
          <div className={graficoAtivo === 'faturacao' ? 'block' : 'hidden'}>
            <GraficoFaturacaoMensal
              faturacao={filteredFaturacao}
              clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
            />
          </div>
        )}

        {showFaturacao && visitedCharts.has('faturacao_artigo') && (
          <div className={graficoAtivo === 'faturacao_artigo' ? 'block' : 'hidden'}>
            <GraficoFaturacaoArtigo
              saidas={filteredSaidas}
              clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
            />
          </div>
        )}
      </div>
    </main>
  );
}

