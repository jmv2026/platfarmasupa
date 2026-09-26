'use client';

import React, { useState, useMemo, useRef } from 'react';
import { DashboardPedidoItem } from './dashboard-view';
import { useLanguage } from '@/lib/i18n/context';

interface GraficoTopProdutosProps {
  pedidos: DashboardPedidoItem[];
  clientName?: string | null;
  onSelectProdutoPrevisao?: (codigo: string) => void;
}

type PeriodoFiltro = '12m' | '6m' | 'ano-atual' | 'todos';
type TipoVisualizacao = 'barras' | 'area' | 'combinado';

interface ProdutoRanking {
  rank: number;
  codigo: string;
  descricao: string;
  quantidade: number;
  nrPedidos: number;
  percentagemTop: number;
}

// Extrai ano e mês com segurança
function extrairData(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const d = new Date(str.includes('T') ? str : `${str}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

export default function GraficoTopProdutos({
  pedidos,
  clientName,
  onSelectProdutoPrevisao,
}: GraficoTopProdutosProps) {
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-PT';

  const [periodo, setPeriodo] = useState<PeriodoFiltro>('12m');
  const [tipoGrafico, setTipoGrafico] = useState<TipoVisualizacao>('combinado');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Agrupamento dos 10 produtos mais pedidos no período
  const { topProdutos, estatisticas } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Data de corte com base no período
    let dataInicio: Date | null = null;
    if (periodo === '6m') {
      dataInicio = new Date(currentYear, currentMonth - 5, 1);
    } else if (periodo === '12m') {
      dataInicio = new Date(currentYear, currentMonth - 11, 1);
    } else if (periodo === 'ano-atual') {
      dataInicio = new Date(currentYear, 0, 1);
    } // 'todos' => dataInicio = null

    // Filtrar pedidos no período
    const pedidosFiltrados = pedidos.filter((p) => {
      if (!dataInicio) return true;
      const dataPed = extrairData(p.data_pedido || p.created_at);
      if (!dataPed) return true;
      return dataPed >= dataInicio;
    });

    // Agrupar linhas por artigo_codigo
    const agrupamento: Record<
      string,
      { codigo: string; descricao: string; quantidade: number; pedidosSet: Set<string> }
    > = {};

    let totalGeralUnidades = 0;

    pedidosFiltrados.forEach((p) => {
      if (p.pedido_linhas && p.pedido_linhas.length > 0) {
        p.pedido_linhas.forEach((linha) => {
          const cod = linha.artigo_codigo || 'N/A';
          const qtd = Number(linha.quantidade) || 0;
          totalGeralUnidades += qtd;

          if (!agrupamento[cod]) {
            agrupamento[cod] = {
              codigo: cod,
              descricao: linha.descricao || cod,
              quantidade: 0,
              pedidosSet: new Set(),
            };
          }
          agrupamento[cod].quantidade += qtd;
          agrupamento[cod].pedidosSet.add(p.id);
        });
      }
    });

    // Ordenar por maior quantidade e selecionar o Top 10
    const ordenados = Object.values(agrupamento).sort((a, b) => b.quantidade - a.quantidade);
    const top10Raw = ordenados.slice(0, 10);
    const totalTop10 = top10Raw.reduce((acc, curr) => acc + curr.quantidade, 0);

    const topProdutos: ProdutoRanking[] = top10Raw.map((p, idx) => ({
      rank: idx + 1,
      codigo: p.codigo,
      descricao: p.descricao,
      quantidade: p.quantidade,
      nrPedidos: p.pedidosSet.size,
      percentagemTop: totalTop10 > 0 ? Math.round((p.quantidade / totalTop10) * 100) : 0,
    }));

    const produtoLider = topProdutos[0] || null;
    const mediaPorProduto =
      topProdutos.length > 0 ? Math.round(totalTop10 / topProdutos.length) : 0;
    const concentracaoGeral =
      totalGeralUnidades > 0 ? Math.round((totalTop10 / totalGeralUnidades) * 100) : 0;

    return {
      topProdutos,
      estatisticas: {
        totalTop10,
        totalGeralUnidades,
        produtoLider,
        mediaPorProduto,
        concentracaoGeral,
        totalProdutosDistintos: Object.keys(agrupamento).length,
      },
    };
  }, [pedidos, periodo]);

  // Dimensões do SVG do gráfico otimizadas para visualização na janela (Top 10)
  const svgWidth = 850;
  const svgHeight = 240;
  const padding = { top: 25, right: 30, bottom: 42, left: 55 };

  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // Escala Y máxima
  const maxQtdRaw = useMemo(() => {
    return Math.max(...topProdutos.map((d) => d.quantidade), 0);
  }, [topProdutos]);

  const yMax = useMemo(() => {
    if (maxQtdRaw === 0) return 100;
    if (maxQtdRaw <= 10) return 10;
    if (maxQtdRaw <= 50) return 50;
    if (maxQtdRaw <= 100) return 100;
    if (maxQtdRaw <= 500) return Math.ceil(maxQtdRaw / 50) * 50;
    if (maxQtdRaw <= 2000) return Math.ceil(maxQtdRaw / 200) * 200;
    return Math.ceil(maxQtdRaw / 500) * 500;
  }, [maxQtdRaw]);

  // Linhas de grelha Y
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  // Coordenadas dos pontos no gráfico
  const points = useMemo(() => {
    const num = topProdutos.length;
    if (num === 0) return [];

    return topProdutos.map((p, index) => {
      const x =
        num === 1
          ? padding.left + chartWidth / 2
          : padding.left + (index / (num - 1)) * chartWidth;
      const y = padding.top + chartHeight - (p.quantidade / yMax) * chartHeight;

      return {
        x,
        y,
        data: p,
        index,
      };
    });
  }, [topProdutos, chartWidth, chartHeight, padding, yMax]);

  // Caminhos Bézier Spline para Gráfico de Top Produtos
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };
    if (points.length === 1) {
      const p = points[0];
      return {
        linePath: `M ${p.x} ${p.y}`,
        areaPath: `M ${p.x - 30} ${padding.top + chartHeight} L ${p.x - 30} ${p.y} L ${p.x + 30} ${p.y} L ${p.x + 30} ${padding.top + chartHeight} Z`,
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

  // Largura de cada barra
  const barWidth = useMemo(() => {
    const n = topProdutos.length;
    if (n === 0) return 24;
    const available = chartWidth / n;
    return Math.min(Math.max(available * 0.52, 14), 38);
  }, [topProdutos.length, chartWidth]);

  const activeItem = hoveredIndex !== null ? topProdutos[hoveredIndex] : null;
  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all">
      {/* Header do Gráfico */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-outline-variant/20">
        <div className="flex items-start gap-3.5">
          {/* Ícone com gradiente Verde Pastel e Lima */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-lime-200 via-emerald-100 to-teal-200/80 border border-lime-300/60 flex items-center justify-center text-lime-900 shadow-sm shrink-0">
            <span className="material-symbols-outlined text-2xl text-emerald-800">leaderboard</span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold font-headline text-on-surface">
                {t.dashboard.chartTop10Title}
              </h2>
              {clientName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/70 text-emerald-900 border border-emerald-200">
                  {clientName}
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/80 mt-0.5">
              {t.dashboard.chartTop10Desc}
            </p>
          </div>
        </div>

        {/* Controlos e Filtros */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Tipo de Gráfico */}
          <div className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 shadow-2xs">
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

      {/* Cartões de Métricas e Destaques (Tons Verde Pastel & Lima) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 my-4 items-stretch">
        {/* 1. Total Unidades Top 10 */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-lime-50/90 to-emerald-50/50 border border-lime-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-lime-900/80 uppercase tracking-wide leading-snug whitespace-normal">
              {t.dashboard.top10TotalUnits}
            </span>
            <span className="w-2 h-2 rounded-full bg-lime-500 ring-4 ring-lime-200/50 shrink-0 mt-0.5"></span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.totalTop10.toLocaleString(locale)}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">{t.dashboard.top10UnitsLabel}</span>
            </div>
            <span className="text-[10px] text-emerald-700/90 font-medium leading-tight whitespace-normal">
              {topProdutos.length} {t.dashboard.top10ItemsCount}
            </span>
          </div>
        </div>

        {/* 2. Produto Nº 1 */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-lime-100/70 via-emerald-50/60 to-lime-50/80 border border-lime-300/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-lime-950 uppercase tracking-wide flex items-center gap-1 leading-snug whitespace-normal">
              <span className="material-symbols-outlined text-[13px] text-lime-700 shrink-0">emoji_events</span>
              <span>{t.dashboard.top10ProductLeader}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-lime-300 text-lime-950 leading-none shrink-0">
              {t.dashboard.top10LeaderBadge}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.produtoLider
                  ? estatisticas.produtoLider.quantidade.toLocaleString(locale)
                  : 0}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">{t.dashboard.top10UnitsLabel}</span>
            </div>
            <span className="text-[10px] text-emerald-800 font-semibold leading-tight whitespace-normal break-all">
              {estatisticas.produtoLider?.codigo || '-'}
            </span>
          </div>
        </div>

        {/* 3. Média por Produto Top 10 */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-900/80 uppercase tracking-wide leading-snug whitespace-normal">
              {t.dashboard.top10AveragePerItem}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-200/50 shrink-0 mt-0.5"></span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.mediaPorProduto.toLocaleString(locale)}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">{t.dashboard.top10UnitsLabel}</span>
            </div>
            <span className="text-[10px] text-emerald-700/90 font-medium leading-tight whitespace-normal">
              Top 10
            </span>
          </div>
        </div>

        {/* 4. Concentração no Top 10 */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-teal-50/90 to-emerald-50/60 border border-teal-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-teal-900/80 uppercase tracking-wide leading-snug whitespace-normal">
              {t.dashboard.top10ShareOfTotal}
            </span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-lime-200 text-lime-950 border border-lime-300 leading-none shrink-0">
              {estatisticas.concentracaoGeral}%
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.concentracaoGeral}%
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">{t.dashboard.chartMonthlyDesc ? '' : ''}</span>
            </div>
            <span className="text-[10px] text-teal-800 font-medium leading-tight whitespace-normal">
              {estatisticas.totalProdutosDistintos} {t.dashboard.top10ItemsCount}
            </span>
          </div>
        </div>
      </div>

      {/* Área do Gráfico SVG com Suporte a Hover & Tooltips */}
      <div
        ref={containerRef}
        className="relative bg-gradient-to-b from-white via-emerald-50/20 to-lime-50/30 rounded-xl p-2.5 sm:p-3.5 border border-emerald-100/80 shadow-inner overflow-hidden"
      >
        {topProdutos.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto min-w-[550px] max-h-[250px] select-none"
            >
              <defs>
                <linearGradient id="areaTopProdutos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#84cc16" stopOpacity="0.4" />
                  <stop offset="35%" stopColor="#a3e635" stopOpacity="0.25" />
                  <stop offset="70%" stopColor="#6ee7b7" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.01" />
                </linearGradient>

                <linearGradient id="strokeTopProdutos" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#65a30d" />
                  <stop offset="45%" stopColor="#84cc16" />
                  <stop offset="80%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>

                <linearGradient id="barTopProdutos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#bef264" />
                  <stop offset="40%" stopColor="#86efac" />
                  <stop offset="100%" stopColor="#6ee7b7" />
                </linearGradient>

                <linearGradient id="barTopProdutosHover" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d9f99d" />
                  <stop offset="100%" stopColor="#a3e635" />
                </linearGradient>

                <filter id="glowTopProdutos" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Linhas de Grelha Horizontal e Ticks Y */}
              {yTicks.map((val, idx) => {
                const y = padding.top + chartHeight - (val / yMax) * chartHeight;
                return (
                  <g key={`ytick-top-${idx}`}>
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
                      {val.toLocaleString(locale)}
                    </text>
                  </g>
                );
              })}

              {/* Colunas / Barras do Gráfico (se modo 'barras' ou 'combinado') */}
              {(tipoGrafico === 'barras' || tipoGrafico === 'combinado') &&
                points.map((p, i) => {
                  const isHovered = hoveredIndex === i;
                  const bHeight = ((p.data.quantidade / yMax) * chartHeight) || 0;
                  const bY = padding.top + chartHeight - bHeight;

                  return (
                    <g key={`bar-group-top-${i}`}>
                      <rect
                        x={p.x - barWidth / 2}
                        y={padding.top}
                        width={barWidth}
                        height={chartHeight}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => onSelectProdutoPrevisao?.(p.data.codigo)}
                      />

                      {bHeight > 0 && (
                        <rect
                          x={p.x - barWidth / 2}
                          y={bY}
                          width={barWidth}
                          height={bHeight}
                          rx={Math.min(barWidth / 2, 7)}
                          ry={Math.min(barWidth / 2, 7)}
                          fill={isHovered ? 'url(#barTopProdutosHover)' : 'url(#barTopProdutos)'}
                          stroke={isHovered ? '#15803d' : '#86efac'}
                          strokeWidth={isHovered ? '2' : '1'}
                          opacity={tipoGrafico === 'combinado' ? 0.75 : 0.95}
                          className="transition-all duration-200 cursor-pointer hover:opacity-100"
                          onMouseEnter={() => setHoveredIndex(i)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          onClick={() => onSelectProdutoPrevisao?.(p.data.codigo)}
                        />
                      )}

                      {/* Rótulo de Valor no Topo da Barra */}
                      {(isHovered || (tipoGrafico === 'barras' && p.data.quantidade > 0)) && (
                        <text
                          x={p.x}
                          y={bY - 6}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="700"
                          fill={isHovered ? '#14532d' : '#334155'}
                        >
                          {p.data.quantidade.toLocaleString(locale)}
                        </text>
                      )}
                    </g>
                  );
                })}

              {/* Gráfico de Área & Curva Suave */}
              {(tipoGrafico === 'area' || tipoGrafico === 'combinado') && (
                <>
                  <path
                    d={areaPath}
                    fill="url(#areaTopProdutos)"
                    className="transition-all duration-300 pointer-events-none"
                  />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="url(#strokeTopProdutos)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glowTopProdutos)"
                    className="transition-all duration-300 pointer-events-none"
                  />

                  {points.map((p, i) => {
                    const isHovered = hoveredIndex === i;
                    const isFirst = i === 0;

                    return (
                      <g
                        key={`point-top-${i}`}
                        className="cursor-pointer"
                        onClick={() => onSelectProdutoPrevisao?.(p.data.codigo)}
                      >
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={isHovered ? 7 : isFirst ? 5.5 : 4}
                          fill={isHovered ? '#bef264' : isFirst ? '#a3e635' : '#d9f99d'}
                          stroke={isHovered ? '#14532d' : isFirst ? '#4d7c0f' : '#059669'}
                          strokeWidth={isHovered ? '3' : '2'}
                          className="transition-all duration-150"
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

              {/* Rótulos do Eixo X (Ranking + Código do Produto) */}
              {points.map((p, i) => {
                const isHovered = hoveredIndex === i;
                return (
                  <g
                    key={`xlabel-top-${i}`}
                    className="cursor-pointer transition-colors duration-150"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => onSelectProdutoPrevisao?.(p.data.codigo)}
                  >
                    {/* Badge de Posição #1-#10 */}
                    <text
                      x={p.x}
                      y={padding.top + chartHeight + 16}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="800"
                      fill={isHovered ? '#15803d' : i === 0 ? '#65a30d' : '#0f766e'}
                    >
                      #{p.data.rank}
                    </text>
                    {/* Código do Artigo */}
                    <text
                      x={p.x}
                      y={padding.top + chartHeight + 30}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight={isHovered ? '800' : '600'}
                      fill={isHovered ? '#14532d' : '#334155'}
                    >
                      {p.data.codigo.length > 11
                        ? `${p.data.codigo.slice(0, 9)}...`
                        : p.data.codigo}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="py-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">
              inventory_2
            </span>
            <p className="text-sm font-medium">
              {t.dashboard.noOrdersData}
            </p>
          </div>
        )}

        {/* Tooltip Detalhado Flutuante com Posicionamento Inteligente para Manter 100% Dentro da Janela */}
        {activeItem && activePoint && (() => {
          const xPct = (activePoint.x / svgWidth) * 100;
          const yPct = (activePoint.y / svgHeight) * 100;
          const isUpperHalf = yPct < 45;

          let transformX = '-50%';
          if (xPct < 25) {
            transformX = '0%';
          } else if (xPct > 75) {
            transformX = '-100%';
          }

          const leftPos = Math.min(Math.max(xPct, 3), 97);
          const topPos = isUpperHalf ? Math.min(yPct + 8, 52) : Math.max(yPct - 6, 15);
          const transformY = isUpperHalf ? '0%' : '-100%';

          return (
            <div
              className="absolute z-20 pointer-events-none bg-slate-900/95 text-white backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-2xl border border-lime-300/40 text-xs transition-all duration-75 max-w-[280px] min-w-[210px]"
              style={{
                left: `${leftPos}%`,
                top: `${topPos}%`,
                transform: `translate(${transformX}, ${transformY})`,
              }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1 mb-1">
                <span className="font-bold text-lime-300 flex items-center gap-1 truncate">
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-lime-400 text-slate-950 shrink-0">
                    #{activeItem.rank}
                  </span>
                  <span className="font-mono font-bold text-white truncate">{activeItem.codigo}</span>
                </span>
                <span className="text-[10px] text-emerald-300 font-semibold shrink-0">
                  {activeItem.percentagemTop}%
                </span>
              </div>

              <p className="text-[11px] text-slate-200 font-medium mb-1.5 line-clamp-2">
                {activeItem.descricao}
              </p>

              <div className="flex items-baseline justify-between gap-4 border-t border-white/10 pt-1">
                <span className="text-slate-300 text-[11px]">{t.dashboard.top10ColQty}:</span>
                <span className="font-bold text-sm text-lime-300">
                  {activeItem.quantidade.toLocaleString(locale)}{' '}
                  <span className="text-[10px] font-normal text-slate-300">{t.dashboard.top10UnitsLabel}</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 mt-0.5 text-[10px]">
                <span className="text-slate-400">{t.dashboard.top10ColOrders}:</span>
                <span className="font-semibold text-emerald-300">
                  {activeItem.nrPedidos} {activeItem.nrPedidos === 1 ? t.dashboard.top10OrdersSingle : t.dashboard.top10OrdersPlural}
                </span>
              </div>

              {onSelectProdutoPrevisao && (
                <div className="mt-2 pt-1 border-t border-white/15 text-[10px] text-lime-300 font-semibold flex items-center gap-1 justify-center">
                  <span className="material-symbols-outlined text-xs">touch_app</span>
                  <span>{t.dashboard.top10TooltipClick}</span>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Tabela / Lista dos Top 10 Produtos Mais Pedidos com Acesso Direto à Previsão de Stock */}
      {topProdutos.length > 0 && (
        <div className="mt-5 pt-4 border-t border-outline-variant/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-700 text-lg">format_list_numbered</span>
              <h3 className="text-xs sm:text-sm font-bold text-on-surface">
                {t.dashboard.top10TableTitle}
              </h3>
            </div>
            <span className="text-[11px] text-on-surface-variant font-medium">
              {t.dashboard.top10TableSubtitle}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-outline-variant/30">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-semibold border-b border-outline-variant/30 text-[11px]">
                  <th className="py-2 px-3 w-16">{t.dashboard.top10ColRank}</th>
                  <th className="py-2 px-3">{t.dashboard.top10ColCode}</th>
                  <th className="py-2 px-3">{t.dashboard.top10ColDesc}</th>
                  <th className="py-2 px-3 text-right">{t.dashboard.top10ColQty}</th>
                  <th className="py-2 px-3 text-right">{t.dashboard.top10ColOrders}</th>
                  <th className="py-2 px-3 text-right">{t.dashboard.top10ColShare}</th>
                  <th className="py-2 px-3 text-center w-36">{t.dashboard.top10ColAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 bg-white">
                {topProdutos.map((p) => {
                  const isLeader = p.rank === 1;
                  return (
                    <tr
                      key={p.codigo}
                      className={`transition-colors hover:bg-lime-50/40 cursor-pointer ${
                        isLeader ? 'bg-lime-50/60 font-semibold' : ''
                      }`}
                      onClick={() => onSelectProdutoPrevisao?.(p.codigo)}
                    >
                      <td className="py-2 px-3">
                        {isLeader ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-lime-400 text-slate-950 border border-lime-500 shadow-2xs">
                            {t.dashboard.top10LeaderBadge}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-bold text-[11px]">
                            #{p.rank}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProdutoPrevisao?.(p.codigo);
                          }}
                          className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-lime-100/80 hover:bg-lime-300 text-emerald-950 hover:text-slate-950 border border-lime-300/80 shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                          title={`${t.dashboard.top10TooltipClick} - ${p.codigo}`}
                        >
                          <span className="material-symbols-outlined text-xs text-lime-700">trending_up</span>
                          <span>{p.codigo}</span>
                        </button>
                      </td>
                      <td className="py-2 px-3 text-on-surface font-medium max-w-[240px] truncate">
                        {p.descricao}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-950">
                        {p.quantidade.toLocaleString(locale)}{' '}
                        <span className="text-[10px] font-normal text-slate-500">{t.dashboard.top10UnitsLabel}</span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700 font-medium">
                        {p.nrPedidos} {p.nrPedidos === 1 ? t.dashboard.top10OrdersSingle : t.dashboard.top10OrdersPlural}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-emerald-800">
                        {p.percentagemTop}%
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProdutoPrevisao?.(p.codigo);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300/80 flex items-center justify-center gap-1 transition-all cursor-pointer mx-auto shadow-2xs"
                        >
                          <span>{t.dashboard.top10ActionForecast}</span>
                          <span className="material-symbols-outlined text-xs">arrow_forward</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
