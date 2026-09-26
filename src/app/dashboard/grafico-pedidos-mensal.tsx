'use client';

import React, { useState, useMemo, useRef } from 'react';
import { DashboardPedidoItem } from './dashboard-view';
import { useLanguage } from '@/lib/i18n/context';

interface GraficoPedidosMensalProps {
  pedidos: DashboardPedidoItem[];
  clientName?: string | null;
}

type PeriodoFiltro = '12m' | '6m' | 'ano-atual' | 'todos';
type TipoVisualizacao = 'area' | 'barras' | 'combinado';

interface MesData {
  key: string; // "2026-03"
  year: number;
  month: number; // 0-11
  label: string; // "Mar 26"
  labelCompleto: string; // "Março 2026"
  count: number;
  diffAnterior: number | null; // % vs mes anterior
}

// Extrai ano e mês com segurança
function extrairAnoMes(dateStr: string | null | undefined): { year: number; month: number } | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (str.includes('-')) {
    const parts = str.split('T')[0].split('-');
    if (parts.length >= 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
        return { year: y, month: m };
      }
    }
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() };
}

export default function GraficoPedidosMensal({ pedidos, clientName }: GraficoPedidosMensalProps) {
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-PT';

  const [periodo, setPeriodo] = useState<PeriodoFiltro>('12m');
  const [tipoGrafico, setTipoGrafico] = useState<TipoVisualizacao>('combinado');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Processamento e agrupamento mensal de pedidos
  const { dadosMensais, estatisticas } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Mapeia todas as contagens por "YYYY-MM"
    const contagemPorMes: Record<string, number> = {};
    const todosAnosDisponiveis = new Set<number>();

    pedidos.forEach((p) => {
      const dataRaw = p.data_pedido || p.created_at;
      const parsed = extrairAnoMes(dataRaw);
      if (parsed) {
        const key = `${parsed.year}-${String(parsed.month + 1).padStart(2, '0')}`;
        contagemPorMes[key] = (contagemPorMes[key] || 0) + 1;
        todosAnosDisponiveis.add(parsed.year);
      }
    });

    todosAnosDisponiveis.add(currentYear);

    // Determina o intervalo de meses a gerar baseado no filtro selecionado
    const mesesParaGerar: { year: number; month: number }[] = [];

    if (periodo === '6m') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        mesesParaGerar.push({ year: d.getFullYear(), month: d.getMonth() });
      }
    } else if (periodo === '12m') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        mesesParaGerar.push({ year: d.getFullYear(), month: d.getMonth() });
      }
    } else if (periodo === 'ano-atual') {
      for (let m = 0; m <= 11; m++) {
        mesesParaGerar.push({ year: currentYear, month: m });
      }
    } else {
      // 'todos'
      const anosOrdenados = Array.from(todosAnosDisponiveis).sort((a, b) => a - b);
      const minAno = anosOrdenados[0] || currentYear;
      const maxAno = currentYear;

      for (let y = minAno; y <= maxAno; y++) {
        const maxM = y === currentYear ? currentMonth : 11;
        for (let m = 0; m <= maxM; m++) {
          mesesParaGerar.push({ year: y, month: m });
        }
      }
    }

    const monthsNames = t.dashboard.months;
    const monthsShort = t.dashboard.monthsShort;

    // Cria os objetos MesData com cálculo de variação
    let prevCount: number | null = null;
    const resultado: MesData[] = mesesParaGerar.map(({ year, month }) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const count = contagemPorMes[key] || 0;
      const mShort = monthsShort[month] || String(month + 1);
      const mFull = monthsNames[month] || String(month + 1);
      const label = `${mShort} '${String(year).slice(-2)}`;
      const labelCompleto = language === 'pt' ? `${mFull} de ${year}` : `${mFull} ${year}`;

      let diffAnterior: number | null = null;
      if (prevCount !== null) {
        if (prevCount === 0) {
          diffAnterior = count > 0 ? 100 : 0;
        } else {
          diffAnterior = Math.round(((count - prevCount) / prevCount) * 100);
        }
      }
      prevCount = count;

      return {
        key,
        year,
        month,
        label,
        labelCompleto,
        count,
        diffAnterior,
      };
    });

    // Estatísticas resumidas do período
    const totalPedidosPeriodo = resultado.reduce((acc, curr) => acc + curr.count, 0);
    const mediaMensal = resultado.length > 0 ? totalPedidosPeriodo / resultado.length : 0;

    const mesPico = resultado.reduce<MesData | null>((pico, curr) => {
      if (!pico || curr.count > pico.count) {
        return curr;
      }
      return pico;
    }, null);

    // Último mês com dados ou mês corrente
    const ultimoMes = resultado[resultado.length - 1];
    const penultimoMes = resultado.length > 1 ? resultado[resultado.length - 2] : null;
    let variacaoUltimoMes = 0;
    if (penultimoMes && penultimoMes.count > 0 && ultimoMes) {
      variacaoUltimoMes = Math.round(((ultimoMes.count - penultimoMes.count) / penultimoMes.count) * 100);
    } else if (ultimoMes && ultimoMes.count > 0 && penultimoMes?.count === 0) {
      variacaoUltimoMes = 100;
    }

    return {
      dadosMensais: resultado,
      estatisticas: {
        total: totalPedidosPeriodo,
        media: mediaMensal,
        pico: mesPico && mesPico.count > 0 ? mesPico : null,
        ultimoMes,
        variacaoUltimoMes,
      },
    };
  }, [pedidos, periodo, t.dashboard.months, t.dashboard.monthsShort, language]);

  // Dimensões do SVG do gráfico otimizadas para visualização na janela
  const svgWidth = 800;
  const svgHeight = 240;
  const padding = { top: 25, right: 25, bottom: 38, left: 45 };

  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // Escala Y máxima
  const maxCountRaw = useMemo(() => {
    return Math.max(...dadosMensais.map((d) => d.count), 0);
  }, [dadosMensais]);

  const yMax = useMemo(() => {
    if (maxCountRaw === 0) return 5;
    if (maxCountRaw <= 5) return 5;
    if (maxCountRaw <= 10) return 10;
    if (maxCountRaw <= 20) return 20;
    if (maxCountRaw <= 50) return Math.ceil(maxCountRaw / 10) * 10;
    return Math.ceil(maxCountRaw / 20) * 20;
  }, [maxCountRaw]);

  // Linhas de grelha Y
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  // Cálculo das coordenadas dos pontos
  const points = useMemo(() => {
    const numPoints = dadosMensais.length;
    if (numPoints === 0) return [];

    return dadosMensais.map((d, index) => {
      const x =
        numPoints === 1
          ? padding.left + chartWidth / 2
          : padding.left + (index / (numPoints - 1)) * chartWidth;
      const y = padding.top + chartHeight - (d.count / yMax) * chartHeight;
      return { x, y, data: d, index };
    });
  }, [dadosMensais, chartWidth, chartHeight, padding, yMax]);

  // Geração do caminho Spline Bézier Suave
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };
    if (points.length === 1) {
      const p = points[0];
      return {
        linePath: `M ${p.x} ${p.y}`,
        areaPath: `M ${p.x - 20} ${padding.top + chartHeight} L ${p.x - 20} ${p.y} L ${p.x + 20} ${p.y} L ${p.x + 20} ${padding.top + chartHeight} Z`,
      };
    }

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p1.x} ${p1.y}`;
    }

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const bottomY = padding.top + chartHeight;

    const area = `${d} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;

    return { linePath: d, areaPath: area };
  }, [points, chartHeight, padding]);

  const activeItem = hoveredIndex !== null ? dadosMensais[hoveredIndex] : null;
  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all">
      {/* Header do Gráfico */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-outline-variant/20">
        <div className="flex items-start gap-3.5">
          {/* Ícone com gradiente Verde Pastel e Lima */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-lime-200 via-emerald-100 to-teal-200/80 border border-lime-300/60 flex items-center justify-center text-lime-900 shadow-sm shrink-0">
            <span className="material-symbols-outlined text-2xl text-emerald-800">show_chart</span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold font-headline text-on-surface">
                {t.dashboard.chartMonthlyTitle}
              </h2>
              {clientName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/70 text-emerald-900 border border-emerald-200">
                  {clientName}
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/80 mt-0.5">
              {t.dashboard.chartMonthlyDesc}
            </p>
          </div>
        </div>

        {/* Controlos e Filtros */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Tipo de Gráfico */}
          <div className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 shadow-2xs">
            <button
              type="button"
              onClick={() => setTipoGrafico('area')}
              title={t.dashboard.viewArea}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                tipoGrafico === 'area'
                  ? 'bg-gradient-to-r from-lime-300 to-emerald-300 text-emerald-950 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">area_chart</span>
              <span className="hidden sm:inline">{t.dashboard.viewArea}</span>
            </button>
            <button
              type="button"
              onClick={() => setTipoGrafico('barras')}
              title={t.dashboard.viewBars}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                tipoGrafico === 'barras'
                  ? 'bg-gradient-to-r from-lime-300 to-emerald-300 text-emerald-950 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">bar_chart</span>
              <span className="hidden sm:inline">{t.dashboard.viewBars}</span>
            </button>
            <button
              type="button"
              onClick={() => setTipoGrafico('combinado')}
              title={t.dashboard.viewMixed}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                tipoGrafico === 'combinado'
                  ? 'bg-gradient-to-r from-lime-300 to-emerald-300 text-emerald-950 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">stacked_line_chart</span>
              <span className="hidden sm:inline">{t.dashboard.viewMixed}</span>
            </button>
          </div>

          {/* Seletor de Período */}
          <div className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 shadow-2xs">
            {(
              [
                { id: '6m', label: t.dashboard.period6m },
                { id: '12m', label: t.dashboard.period12m },
                { id: 'ano-atual', label: t.dashboard.periodCurrentYear },
                { id: 'todos', label: t.dashboard.periodAll },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriodo(opt.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  periodo === opt.id
                    ? 'bg-white text-emerald-900 shadow-xs border border-emerald-200/60 font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cartões de Métricas e Destaques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 my-4 items-stretch">
        {/* 1. Total no Período */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-lime-50/90 to-emerald-50/50 border border-lime-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-lime-900/80 uppercase tracking-wide leading-snug whitespace-normal">
              {t.dashboard.monthlyTotalOrders}
            </span>
            <span className="w-2 h-2 rounded-full bg-lime-500 ring-4 ring-lime-200/50 shrink-0 mt-0.5"></span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.total.toLocaleString(locale)}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">
                {estatisticas.total === 1 ? t.dashboard.top10OrdersSingle : t.dashboard.top10OrdersPlural}
              </span>
            </div>
            <span className="text-[10px] text-emerald-700/90 font-medium leading-tight whitespace-normal">
              {dadosMensais.length} {t.dashboard.months[0] ? '' : ''}
            </span>
          </div>
        </div>

        {/* 2. Média Mensal */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-900/80 uppercase tracking-wide leading-snug whitespace-normal">
              {t.dashboard.monthlyAverage}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-200/50 shrink-0 mt-0.5"></span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.media.toLocaleString(locale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">
                {t.dashboard.top10OrdersPlural}/{language === 'en' ? 'mo' : 'mês'}
              </span>
            </div>
            <span className="text-[10px] text-emerald-700/90 font-medium leading-tight whitespace-normal">
              {t.dashboard.monthlyAverage}
            </span>
          </div>
        </div>

        {/* 3. Mês de Pico / Recorde */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-lime-100/70 via-emerald-50/60 to-lime-50/80 border border-lime-300/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-lime-950 uppercase tracking-wide flex items-center gap-1 leading-snug whitespace-normal">
              <span className="material-symbols-outlined text-[13px] text-lime-700 shrink-0">military_tech</span>
              <span>{t.dashboard.monthlyPeakMonth}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-lime-300 text-lime-950 leading-none shrink-0">
              Máx
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.pico ? estatisticas.pico.count.toLocaleString(locale) : 0}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">
                {t.dashboard.top10OrdersPlural}
              </span>
            </div>
            <span className="text-[10px] text-emerald-800 font-semibold leading-tight whitespace-normal">
              {estatisticas.pico ? estatisticas.pico.labelCompleto : '-'}
            </span>
          </div>
        </div>

        {/* 4. Mês Mais Recente & Tendência */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-teal-50/90 to-emerald-50/60 border border-teal-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-teal-900/80 uppercase tracking-wide leading-snug whitespace-normal">
              {t.dashboard.monthlyRecentTrend}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold leading-none shrink-0 ${
                estatisticas.variacaoUltimoMes > 0
                  ? 'bg-lime-300 text-emerald-950'
                  : estatisticas.variacaoUltimoMes < 0
                  ? 'bg-rose-200 text-rose-900'
                  : 'bg-slate-200 text-slate-800'
              }`}
            >
              {estatisticas.variacaoUltimoMes > 0
                ? `+${estatisticas.variacaoUltimoMes}%`
                : `${estatisticas.variacaoUltimoMes}%`}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.ultimoMes ? estatisticas.ultimoMes.count.toLocaleString(locale) : 0}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">
                {t.dashboard.top10OrdersPlural}
              </span>
            </div>
            <span className="text-[10px] text-teal-800 font-medium leading-tight whitespace-normal">
              {t.dashboard.monthlyVsPrevious}
            </span>
          </div>
        </div>
      </div>

      {/* Área do Gráfico SVG com Suporte a Hover & Tooltips */}
      <div
        ref={containerRef}
        className="relative bg-gradient-to-b from-white via-emerald-50/20 to-lime-50/30 rounded-xl p-2.5 sm:p-3.5 border border-emerald-100/80 shadow-inner overflow-hidden"
      >
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto min-w-[550px] max-h-[250px] select-none"
          >
            <defs>
              <linearGradient id="areaGradientVerdeLima" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#84cc16" stopOpacity="0.4" />
                <stop offset="35%" stopColor="#a3e635" stopOpacity="0.25" />
                <stop offset="70%" stopColor="#6ee7b7" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.01" />
              </linearGradient>

              <linearGradient id="strokeGradientLima" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#65a30d" />
                <stop offset="40%" stopColor="#84cc16" />
                <stop offset="80%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>

              <linearGradient id="barGradientLima" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#bef264" />
                <stop offset="40%" stopColor="#86efac" />
                <stop offset="100%" stopColor="#6ee7b7" />
              </linearGradient>

              <linearGradient id="barGradientLimaHover" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d9f99d" />
                <stop offset="100%" stopColor="#a3e635" />
              </linearGradient>

              <filter id="glowLima" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Linhas de grelha horizontal e rótulos Y */}
            {yTicks.map((val, idx) => {
              const y = padding.top + chartHeight - (val / yMax) * chartHeight;
              return (
                <g key={`ytick-${idx}`}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={svgWidth - padding.right}
                    y2={y}
                    stroke={idx === 0 ? '#cbd5e1' : '#e2e8f0'}
                    strokeWidth={idx === 0 ? '1.5' : '1'}
                    strokeDasharray={idx === 0 ? 'none' : '3 3'}
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize="10"
                    fontWeight="600"
                    fill="#64748b"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Barras do Gráfico (se modo 'barras' ou 'combinado') */}
            {(tipoGrafico === 'barras' || tipoGrafico === 'combinado') &&
              points.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const isPeak = estatisticas.pico?.key === p.data.key && p.data.count > 0;
                const barW = Math.min(chartWidth / (points.length * 2.8), 26);
                const bHeight = ((p.data.count / yMax) * chartHeight) || 0;
                const bY = padding.top + chartHeight - bHeight;

                return (
                  <g key={`bar-group-${i}`}>
                    <rect
                      x={p.x - barW / 2}
                      y={padding.top}
                      width={barW}
                      height={chartHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />

                    {bHeight > 0 && (
                      <rect
                        x={p.x - barW / 2}
                        y={bY}
                        width={barW}
                        height={bHeight}
                        rx={Math.min(barW / 2, 6)}
                        ry={Math.min(barW / 2, 6)}
                        fill={isHovered ? 'url(#barGradientLimaHover)' : 'url(#barGradientLima)'}
                        stroke={isHovered ? '#15803d' : '#86efac'}
                        strokeWidth={isHovered ? '2' : '1'}
                        opacity={tipoGrafico === 'combinado' ? 0.75 : 0.95}
                        className="transition-all duration-200 cursor-pointer hover:opacity-100"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    )}

                    {(isHovered || (tipoGrafico === 'barras' && p.data.count > 0)) && (
                      <text
                        x={p.x}
                        y={bY - 6}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill={isHovered ? '#14532d' : '#334155'}
                      >
                        {p.data.count.toLocaleString(locale)}
                      </text>
                    )}

                    {isPeak && !isHovered && tipoGrafico === 'barras' && (
                      <circle cx={p.x} cy={bY - 14} r="3" fill="#65a30d" />
                    )}
                  </g>
                );
              })}

            {/* Gráfico de Área & Curva Suave (se modo 'area' ou 'combinado') */}
            {(tipoGrafico === 'area' || tipoGrafico === 'combinado') && (
              <>
                <path
                  d={areaPath}
                  fill="url(#areaGradientVerdeLima)"
                  className="transition-all duration-300 pointer-events-none"
                />

                <path
                  d={linePath}
                  fill="none"
                  stroke="url(#strokeGradientLima)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glowLima)"
                  className="transition-all duration-300 pointer-events-none"
                />

                {/* Pontos de Dados Interativos */}
                {points.map((p, i) => {
                  const isHovered = hoveredIndex === i;
                  const isPeak = estatisticas.pico?.key === p.data.key && p.data.count > 0;

                  return (
                    <g key={`point-${i}`}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 7 : isPeak ? 5.5 : 4}
                        fill={isHovered ? '#bef264' : isPeak ? '#a3e635' : '#d9f99d'}
                        stroke={isHovered ? '#14532d' : isPeak ? '#4d7c0f' : '#059669'}
                        strokeWidth={isHovered ? '3' : '2'}
                        className="transition-all duration-150 cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />

                      {isHovered && (
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="13"
                          fill="none"
                          stroke="#84cc16"
                          strokeWidth="2"
                          strokeOpacity="0.5"
                          className="animate-ping pointer-events-none"
                        />
                      )}
                    </g>
                  );
                })}
              </>
            )}

            {/* Linha de Referência Vertical no Hover */}
            {activePoint && (
              <line
                x1={activePoint.x}
                y1={padding.top}
                x2={activePoint.x}
                y2={padding.top + chartHeight}
                stroke="#65a30d"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                className="pointer-events-none"
              />
            )}

            {/* Rótulos do Eixo X (Meses) */}
            {points.map((p, i) => {
              const isHovered = hoveredIndex === i;
              return (
                <text
                  key={`xlabel-${i}`}
                  x={p.x}
                  y={padding.top + chartHeight + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? '800' : '600'}
                  fill={isHovered ? '#14532d' : '#475569'}
                  className="cursor-pointer transition-colors duration-150"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {p.data.label}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Tooltip Detalhado Flutuante */}
        {activeItem && activePoint && (() => {
          const xPct = (activePoint.x / svgWidth) * 100;
          const yPct = (activePoint.y / svgHeight) * 100;
          const isUpperHalf = yPct < 45;

          let transformX = '-50%';
          if (xPct < 22) {
            transformX = '0%';
          } else if (xPct > 78) {
            transformX = '-100%';
          }

          const leftPos = Math.min(Math.max(xPct, 3), 97);
          const topPos = isUpperHalf ? Math.min(yPct + 8, 55) : Math.max(yPct - 6, 15);
          const transformY = isUpperHalf ? '0%' : '-100%';

          return (
            <div
              className="absolute z-20 pointer-events-none bg-slate-900/95 text-white backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-2xl border border-lime-300/40 text-xs transition-all duration-75 min-w-[210px]"
              style={{
                left: `${leftPos}%`,
                top: `${topPos}%`,
                transform: `translate(${transformX}, ${transformY})`,
              }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1 mb-1">
                <span className="font-bold text-lime-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-lime-400">event</span>
                  {activeItem.labelCompleto}
                </span>
                {activeItem.count === estatisticas.pico?.count && activeItem.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-lime-400 text-slate-950">
                    Máx
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between gap-4">
                <span className="text-slate-300">{t.dashboard.monthlyOrdersProcessed}:</span>
                <span className="font-bold text-sm text-white">
                  {activeItem.count.toLocaleString(locale)}{' '}
                  <span className="text-[10px] font-normal text-slate-300">
                    {activeItem.count === 1 ? t.dashboard.top10OrdersSingle : t.dashboard.top10OrdersPlural}
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 mt-0.5 text-[10px]">
                <span className="text-slate-400">{t.dashboard.top10ShareOfTotal}:</span>
                <span className="font-semibold text-emerald-300">
                  {estatisticas.total > 0
                    ? Math.round((activeItem.count / estatisticas.total) * 100)
                    : 0}
                  %
                </span>
              </div>

              {activeItem.diffAnterior !== null && (
                <div className="flex items-center justify-between gap-4 mt-0.5 text-[10px] pt-1 border-t border-white/10">
                  <span className="text-slate-400">{t.dashboard.monthlyVsPrevious}:</span>
                  <span
                    className={`font-semibold flex items-center gap-0.5 ${
                      activeItem.diffAnterior > 0
                        ? 'text-lime-400'
                        : activeItem.diffAnterior < 0
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {activeItem.diffAnterior > 0
                      ? `+${activeItem.diffAnterior}%`
                      : `${activeItem.diffAnterior}%`}
                  </span>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
