'use client';

import { useState, useMemo, useRef } from 'react';
import { useLanguage } from '@/lib/i18n/context';

export interface DashboardEntradaESItem {
  documento_ref: string;
  cliente_id?: string | null;
  sigla?: string | null;
  cliente_ser?: string | null;
  data_movimento?: string | null;
  data?: string | null;
  created_at?: string | null;
  tipo_movimento?: string | null;
  tipomovimento?: string | null;
}

interface GraficoKpiRececoesProps {
  entradas: DashboardEntradaESItem[];
  clientName?: string | null;
}

type OpcaoAgrupamento = 'dia-mes-atual' | 'mes-ano-atual';

interface PontoRececaoData {
  key: string;
  label: string;
  labelCompleto: string;
  count: number;
  kpiPct: number | null; // 100.00% quando count > 0, null quando count === 0
}

function extrairDataCompleta(
  dateStr: string | null | undefined
): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const datePart = str.split('T')[0].split(' ')[0];
  if (datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
        return { year: y, month: m, day: d };
      }
    }
  }
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return null;
  return {
    year: dt.getFullYear(),
    month: dt.getMonth(),
    day: dt.getDate(),
  };
}

export default function GraficoKpiRececoes({
  entradas,
  clientName,
}: GraficoKpiRececoesProps) {
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-PT';

  const [modoPeriodo, setModoPeriodo] = useState<OpcaoAgrupamento>('dia-mes-atual');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatKpi = (val: number) =>
    `${val.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

  const { serieDados, estatisticas, subTituloPeriodo } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const monthsNames = t.dashboard.months;
    const monthsShort = t.dashboard.monthsShort;
    const currentMonthName = monthsNames[currentMonth] || '';

    const pontos: PontoRececaoData[] = [];

    if (modoPeriodo === 'dia-mes-atual') {
      // Número de dias do mês corrente
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const contagemPorDia: Record<number, number> = {};

      entradas.forEach((item) => {
        const raw = item.data_movimento || item.data || item.created_at;
        const parsed = extrairDataCompleta(raw);
        if (parsed && parsed.year === currentYear && parsed.month === currentMonth) {
          contagemPorDia[parsed.day] = (contagemPorDia[parsed.day] || 0) + 1;
        }
      });

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, '0');
        const monthStr = String(currentMonth + 1).padStart(2, '0');
        const c = contagemPorDia[d] || 0;
        pontos.push({
          key: `${currentYear}-${monthStr}-${dayStr}`,
          label: dayStr,
          labelCompleto: `${dayStr} de ${currentMonthName} de ${currentYear}`,
          count: c,
          kpiPct: c > 0 ? 100.0 : null,
        });
      }
    } else {
      // Por mês do corrente ano (Jan a Dez)
      const contagemPorMes: Record<number, number> = {};

      entradas.forEach((item) => {
        const raw = item.data_movimento || item.data || item.created_at;
        const parsed = extrairDataCompleta(raw);
        if (parsed && parsed.year === currentYear) {
          contagemPorMes[parsed.month] = (contagemPorMes[parsed.month] || 0) + 1;
        }
      });

      for (let m = 0; m <= 11; m++) {
        const mShort = monthsShort[m] || String(m + 1);
        const mFull = monthsNames[m] || String(m + 1);
        const monthStr = String(m + 1).padStart(2, '0');
        const c = contagemPorMes[m] || 0;
        pontos.push({
          key: `${currentYear}-${monthStr}`,
          label: `${mShort} '${String(currentYear).slice(-2)}`,
          labelCompleto: `${mFull} de ${currentYear}`,
          count: c,
          kpiPct: c > 0 ? 100.0 : null,
        });
      }
    }

    const totalRececoes = pontos.reduce((acc, p) => acc + p.count, 0);
    const media = pontos.length > 0 ? totalRececoes / pontos.length : 0;
    const pico = pontos.reduce<PontoRececaoData | null>((maxP, curr) => {
      if (!maxP || curr.count > maxP.count) return curr;
      return maxP;
    }, null);

    const subTitulo =
      modoPeriodo === 'dia-mes-atual'
        ? `${currentMonthName} ${currentYear} (Por Dia)`
        : `Ano ${currentYear} (Por Mês)`;

    return {
      serieDados: pontos,
      estatisticas: {
        total: totalRececoes,
        media,
        pico: pico && pico.count > 0 ? pico : null,
        kpiGlobal: 100.0,
      },
      subTituloPeriodo: subTitulo,
    };
  }, [entradas, modoPeriodo, t.dashboard.months, t.dashboard.monthsShort]);

  // Dimensões do SVG do gráfico
  const svgWidth = 860;
  const svgHeight = 310;
  // Topo reservado para a linha de KPI (100,00%) + área inferior para as colunas de entradas ES
  const padding = { top: 72, right: 48, bottom: 42, left: 48 };
  const kpiLineY = 34; // Linha superior fixa para o KPI = 100,00%

  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const maxCountRaw = useMemo(() => {
    return Math.max(...serieDados.map((d) => d.count), 0);
  }, [serieDados]);

  const yMax = useMemo(() => {
    if (maxCountRaw === 0) return 5;
    if (maxCountRaw <= 5) return 5;
    if (maxCountRaw <= 10) return 10;
    if (maxCountRaw <= 20) return 20;
    if (maxCountRaw <= 50) return Math.ceil(maxCountRaw / 10) * 10;
    return Math.ceil(maxCountRaw / 20) * 20;
  }, [maxCountRaw]);

  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  // Coordenadas X/Y para as colunas de movimentos ES e para os pontos da linha KPI (apenas quando count > 0)
  const points = useMemo(() => {
    const n = serieDados.length;
    if (n === 0) return [];

    // Espaçamento centrado por coluna para que as barras das extremidades não fiquem cortadas
    const step = chartWidth / n;

    return serieDados.map((d, index) => {
      const x = padding.left + step * index + step / 2;
      const barHeight = (d.count / yMax) * chartHeight;
      const yBar = padding.top + chartHeight - barHeight;
      const yKpi = d.kpiPct !== null ? kpiLineY : null;
      return { x, yBar, barHeight, yKpi, data: d, index };
    });
  }, [serieDados, chartWidth, chartHeight, padding.left, padding.top, yMax]);

  // Caminho da linha superior de KPI (apenas para colunas com entradas > 0)
  const kpiLinePath = useMemo(() => {
    const validKpiPoints = points.filter((p) => p.yKpi !== null);
    if (validKpiPoints.length === 0) return '';
    return validKpiPoints
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.yKpi}`)
      .join(' ');
  }, [points]);

  const activeItem = hoveredIndex !== null ? serieDados[hoveredIndex] : null;
  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all">
      {/* Header do Gráfico */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-outline-variant/20">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-lime-200 via-emerald-100 to-teal-200/80 border border-lime-300/60 flex items-center justify-center text-lime-900 shadow-sm shrink-0">
            <span className="material-symbols-outlined text-2xl text-emerald-800">move_to_inbox</span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold font-headline text-on-surface">
                KPI Receções
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-lime-200/80 text-lime-950 border border-lime-300">
                ES • {subTituloPeriodo}
              </span>
              {clientName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/70 text-emerald-900 border border-emerald-200">
                  {clientName}
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/80 mt-0.5">
              Totais de movimentos de entrada de stock (ES) em colunas e linha superior de cumprimento do KPI ({formatKpi(100)})
            </p>
          </div>
        </div>

        {/* Seletor de Opção: Por Dia do Corrente Mês vs Por Mês do Corrente Ano */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setHoveredIndex(null);
                setModoPeriodo('dia-mes-atual');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                modoPeriodo === 'dia-mes-atual'
                  ? 'bg-gradient-to-r from-lime-300 to-emerald-300 text-emerald-950 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">today</span>
              <span>Por Dia (Mês Atual)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHoveredIndex(null);
                setModoPeriodo('mes-ano-atual');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                modoPeriodo === 'mes-ano-atual'
                  ? 'bg-gradient-to-r from-lime-300 to-emerald-300 text-emerald-950 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              <span>Por Mês (Ano Atual)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Corpo Principal: Coluna Lateral Esquerda de Métricas + Gráfico SVG */}
      <div className="flex flex-col lg:flex-row gap-3.5 sm:gap-4 my-4 items-stretch">
        {/* Coluna Lateral Esquerda: 4 Cartões Resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-4 gap-2.5 sm:gap-3 w-full lg:w-56 xl:w-64 shrink-0">
          {/* 1. Total de Movimentos ES */}
          <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-lime-50/90 to-emerald-50/50 border border-lime-200/70 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-lime-900/80 uppercase tracking-wide leading-snug">
                Total Entradas (ES)
              </span>
              <span className="w-2 h-2 rounded-full bg-lime-500 ring-4 ring-lime-200/50 shrink-0 mt-0.5"></span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                  {estatisticas.total.toLocaleString(locale)}
                </span>
                <span className="text-[10px] sm:text-xs font-medium text-emerald-800">
                  mov. ES
                </span>
              </div>
              <span className="text-[10px] text-emerald-700/90 font-medium leading-tight">
                {modoPeriodo === 'dia-mes-atual' ? 'Mês corrente' : 'Ano corrente'}
              </span>
            </div>
          </div>

          {/* 2. Valor do KPI Associado */}
          <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/70 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-900/80 uppercase tracking-wide leading-snug">
                KPI Receções
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-lime-300 text-emerald-950 leading-none shrink-0">
                Meta
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {formatKpi(estatisticas.kpiGlobal)}
              </span>
              <span className="text-[10px] text-emerald-700/90 font-semibold leading-tight">
                Taxa de serviço
              </span>
            </div>
          </div>

          {/* 3. Média no Período */}
          <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-lime-100/70 via-emerald-50/60 to-lime-50/80 border border-lime-300/70 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-lime-950 uppercase tracking-wide leading-snug">
                {modoPeriodo === 'dia-mes-atual' ? 'Média Diária' : 'Média Mensal'}
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
                  ES/{modoPeriodo === 'dia-mes-atual' ? 'dia' : 'mês'}
                </span>
              </div>
              <span className="text-[10px] text-emerald-800 font-medium leading-tight">
                {serieDados.length} {modoPeriodo === 'dia-mes-atual' ? 'dias' : 'meses'}
              </span>
            </div>
          </div>

          {/* 4. Pico de Receções */}
          <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-teal-50/90 to-emerald-50/60 border border-teal-200/70 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-teal-900/80 uppercase tracking-wide flex items-center gap-1 leading-snug">
                <span className="material-symbols-outlined text-[13px] text-teal-700 shrink-0">military_tech</span>
                <span>Maior Volume (ES)</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-lime-300 text-emerald-950 leading-none shrink-0">
                Máx
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                  {estatisticas.pico ? estatisticas.pico.count.toLocaleString(locale) : 0}
                </span>
                <span className="text-[10px] sm:text-xs font-medium text-emerald-800">
                  mov. ES
                </span>
              </div>
              <span className="text-[10px] text-teal-800 font-semibold leading-tight truncate max-w-[120px]">
                {estatisticas.pico ? estatisticas.pico.labelCompleto : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Área do Gráfico SVG (Colunas de Entradas ES + Linha Superior KPI 100,00%) */}
        <div
          ref={containerRef}
          className="flex-1 min-w-0 relative bg-gradient-to-b from-white via-emerald-50/20 to-lime-50/30 rounded-xl p-2.5 sm:p-3.5 border border-emerald-100/80 shadow-inner overflow-hidden flex flex-col justify-center"
        >
          {/* Legenda Superior do Gráfico */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1.5 text-[11px]">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-900">
                <span className="w-3 h-3 rounded-xs bg-gradient-to-b from-lime-300 to-emerald-400 border border-emerald-600/50 inline-block"></span>
                Movimentos Entrada de Stock (ES)
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-lime-800">
                <span className="w-4 h-0.5 bg-lime-600 inline-block relative">
                  <span className="w-2 h-2 rounded-full bg-lime-400 border border-emerald-900 absolute -top-[3px] left-1"></span>
                </span>
                Linha KPI Associado ({formatKpi(100)})
              </span>
            </div>
            <span className="font-mono font-bold text-emerald-900 bg-lime-200/70 px-2 py-0.5 rounded border border-lime-300 text-[10px]">
              KPI: {formatKpi(100)}
            </span>
          </div>

          <div className="w-full overflow-x-auto flex items-center justify-center">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto min-w-[560px] select-none"
            >
              <defs>
                <linearGradient id="barGradientKpiRec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#84cc16" />
                  <stop offset="50%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>

                <linearGradient id="barGradientKpiRecHover" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#bef264" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>

                <linearGradient id="kpiLineStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#65a30d" />
                  <stop offset="50%" stopColor="#84cc16" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>

              {/* Faixa e Linha de Referência da Zona Superior do KPI (100,00%) */}
              <rect
                x={padding.left}
                y={kpiLineY - 16}
                width={chartWidth}
                height={30}
                rx={6}
                fill="#ecfccb"
                fillOpacity="0.45"
              />
              <line
                x1={padding.left}
                y1={kpiLineY}
                x2={svgWidth - padding.right}
                y2={kpiLineY}
                stroke="#84cc16"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 8}
                y={kpiLineY + 3.5}
                textAnchor="end"
                fontSize="9.5"
                fontWeight="700"
                fill="#3f6212"
              >
                100%
              </text>
              <text
                x={svgWidth - padding.right + 6}
                y={kpiLineY + 3.5}
                textAnchor="start"
                fontSize="9.5"
                fontWeight="700"
                fill="#3f6212"
              >
                100,00%
              </text>

              {/* Linhas de grelha horizontal e rótulos Y para as Colunas ES */}
              {yTicks.map((val, idx) => {
                const y = padding.top + chartHeight - (val / yMax) * chartHeight;
                return (
                  <g key={`ytick-es-${idx}`}>
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
                      {Math.round(val)}
                    </text>
                  </g>
                );
              })}

              {/* Linha de Referência Vertical no Hover */}
              {activePoint && (
                <line
                  x1={activePoint.x}
                  y1={kpiLineY}
                  x2={activePoint.x}
                  y2={padding.top + chartHeight}
                  stroke="#65a30d"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  className="pointer-events-none"
                />
              )}

              {/* Colunas dos Movimentos de Entrada de Stock (ES) */}
              {points.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const barW =
                  modoPeriodo === 'dia-mes-atual'
                    ? Math.min(chartWidth / (points.length * 1.55), 16)
                    : Math.min(chartWidth / (points.length * 2.2), 34);

                return (
                  <g key={`col-es-${i}`}>
                    {/* Área de Hover */}
                    <rect
                      x={p.x - barW}
                      y={kpiLineY - 14}
                      width={barW * 2}
                      height={padding.top + chartHeight - (kpiLineY - 14)}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />

                    {/* Coluna ES */}
                    {p.barHeight > 0 ? (
                      <rect
                        x={p.x - barW / 2}
                        y={p.yBar}
                        width={barW}
                        height={p.barHeight}
                        rx={Math.min(barW / 2, 5)}
                        ry={Math.min(barW / 2, 5)}
                        fill={isHovered ? 'url(#barGradientKpiRecHover)' : 'url(#barGradientKpiRec)'}
                        stroke={isHovered ? '#14532d' : '#10b981'}
                        strokeWidth={isHovered ? '1.8' : '1'}
                        className="transition-all duration-150 cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    ) : (
                      <rect
                        x={p.x - barW / 2}
                        y={padding.top + chartHeight - 2}
                        width={barW}
                        height={2}
                        fill={isHovered ? '#84cc16' : '#cbd5e1'}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    )}

                    {/* Valor numérico da coluna ES */}
                    {(p.data.count > 0 || isHovered) && (
                      <text
                        x={p.x}
                        y={p.yBar - 5}
                        textAnchor="middle"
                        fontSize={modoPeriodo === 'dia-mes-atual' ? '9.5' : '10.5'}
                        fontWeight="700"
                        fill={isHovered ? '#14532d' : '#0f172a'}
                        className="pointer-events-none"
                      >
                        {p.data.count}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Linha Superior do KPI (100,00%) - apenas para colunas com entradas > 0 */}
              {points.length > 0 && (
                <>
                  {kpiLinePath && (
                    <path
                      d={kpiLinePath}
                      fill="none"
                      stroke="url(#kpiLineStrokeGrad)"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="pointer-events-none"
                    />
                  )}

                  {points.map((p, i) => {
                    if (p.yKpi === null || p.data.kpiPct === null) return null;
                    const isHovered = hoveredIndex === i;

                    return (
                      <g key={`kpi-pt-${i}`}>
                        <circle
                          cx={p.x}
                          cy={p.yKpi}
                          r={isHovered ? 5.5 : modoPeriodo === 'dia-mes-atual' ? 3.5 : 4}
                          fill={isHovered ? '#bef264' : '#a3e635'}
                          stroke={isHovered ? '#14532d' : '#3f6212'}
                          strokeWidth={isHovered ? '2.5' : '1.5'}
                          className="cursor-pointer transition-all duration-150"
                          onMouseEnter={() => setHoveredIndex(i)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        />
                        <text
                          x={p.x}
                          y={p.yKpi - 7}
                          textAnchor="middle"
                          fontSize={
                            modoPeriodo === 'dia-mes-atual'
                              ? isHovered
                                ? '6.5'
                                : '5.6'
                              : isHovered
                                ? '8.5'
                                : '7.5'
                          }
                          letterSpacing={modoPeriodo === 'dia-mes-atual' ? '-0.25' : '0'}
                          fontWeight="700"
                          fill={isHovered ? '#14532d' : '#3f6212'}
                          className="pointer-events-none"
                        >
                          {formatKpi(p.data.kpiPct)}
                        </text>
                      </g>
                    );
                  })}
                </>
              )}

              {/* Rótulos do Eixo X (Dias do Mês ou Meses do Ano) */}
              {points.map((p, i) => {
                const isHovered = hoveredIndex === i;
                return (
                  <text
                    key={`xlabel-es-${i}`}
                    x={p.x}
                    y={padding.top + chartHeight + 18}
                    textAnchor="middle"
                    fontSize={modoPeriodo === 'dia-mes-atual' ? '9.5' : '10.5'}
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

          {/* Tooltip Flutuante no Hover */}
          {activeItem && activePoint && (() => {
            const xPct = (activePoint.x / svgWidth) * 100;
            let transformX = '-50%';
            if (xPct < 20) transformX = '0%';
            else if (xPct > 80) transformX = '-100%';

            const leftPos = Math.min(Math.max(xPct, 4), 96);

            return (
              <div
                className="absolute z-20 pointer-events-none bg-slate-900/95 text-white backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-2xl border border-lime-300/40 text-xs transition-all duration-75 min-w-[215px]"
                style={{
                  left: `${leftPos}%`,
                  top: '22%',
                  transform: `translate(${transformX}, 0)`,
                }}
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1 mb-1.5">
                  <span className="font-bold text-lime-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-lime-400">event</span>
                    {activeItem.labelCompleto}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-slate-300">Movimentos Entrada (ES):</span>
                  <span className="font-bold text-sm text-white font-mono">
                    {activeItem.count.toLocaleString(locale)}
                  </span>
                </div>

                {activeItem.kpiPct !== null && (
                  <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-white/10 text-[11px]">
                    <span className="text-slate-300">Valor KPI Associado:</span>
                    <span className="font-bold text-lime-400 font-mono">
                      {formatKpi(activeItem.kpiPct)}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

