'use client';

import { useState, useMemo, useRef } from 'react';
import { DashboardSaidaItem } from './dashboard-view';
import { useLanguage } from '@/lib/i18n/context';

interface GraficoFaturacaoArtigoProps {
  saidas: DashboardSaidaItem[];
  clientName?: string | null;
}

type PeriodoFiltro = 'mes-atual' | '3m' | '6m' | '12m' | 'ano-atual' | 'todos';
type TopLimit = 'top5' | 'top10' | 'top25' | 'todos';

interface ArtigoFaturacaoRanking {
  rank: number;
  codigo: string;
  descricao: string;
  quantidade: number;
  nrDocs: number;
  valorLiquido: number;
  valorDesconto: number;
  valorBruto: number;
  percentagemTotal: number;
}

function extrairAnoMes(dateStr: string | null | undefined): { year: number; month: number } | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (!str) return null;

  const datePart = str.split('T')[0].split(' ')[0];
  if (datePart.includes('-')) {
    const parts = datePart.split('-');
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

export default function GraficoFaturacaoArtigo({
  saidas,
  clientName,
}: GraficoFaturacaoArtigoProps) {
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-PT';

  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes-atual');
  const [topLimit, setTopLimit] = useState<TopLimit>('top10');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (val: number) =>
    val.toLocaleString(locale, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatShortTick = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M€`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k€`;
    return `${Math.round(val)}€`;
  };

  // Agrupamento dos totais de faturação por artigo de acordo com os filtros temporais
  const { artigosList, estatisticas, maxValor } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Determinar o conjunto de meses (YYYY-MM) abrangidos pelo filtro temporal
    const allowedMonths = new Set<string>();
    if (periodo === 'mes-atual') {
      allowedMonths.add(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`);
    } else if (periodo === '3m') {
      for (let i = 2; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        allowedMonths.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    } else if (periodo === '6m') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        allowedMonths.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    } else if (periodo === '12m') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        allowedMonths.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    } else if (periodo === 'ano-atual') {
      for (let m = 0; m <= 11; m++) {
        allowedMonths.add(`${currentYear}-${String(m + 1).padStart(2, '0')}`);
      }
    }

    const agrupamento: Record<
      string,
      {
        codigo: string;
        descricao: string;
        quantidade: number;
        valorLiquido: number;
        valorDesconto: number;
        valorBruto: number;
        docsSet: Set<string>;
      }
    > = {};

    let totalGeralLiquido = 0;
    let totalGeralDesconto = 0;
    let totalGeralBruto = 0;
    let totalGeralUnidades = 0;

    (saidas || []).forEach((s) => {
      if (periodo !== 'todos') {
        const rawDate = s.data || s.data_movimento || s.created_at;
        const parsed = extrairAnoMes(rawDate);
        if (!parsed) return;
        const key = `${parsed.year}-${String(parsed.month + 1).padStart(2, '0')}`;
        if (!allowedMonths.has(key)) return;
      }

      const cod = String(s.artigo_id || s.artigo || s.artigo_codigo || s.artigo_cli || 'N/A').trim();
      const desc = String(s.descricao || s.artigo_descricao || s.artigo || cod).trim();
      const qtd = Math.abs(Number(s.quantidade) || 0);
      const valUnit = Number(s.valor_unitario) || 0;
      const valAdic = Number(s.valor_adicional) || 0;
      const valAbat = Number(s.valor_abater) || 0;

      const linhaLiquido = qtd * valUnit + valAdic;
      const linhaDesconto = valAbat;
      const linhaBruto = linhaLiquido + linhaDesconto;

      // Incluir linhas de artigos com valor de faturação ou desconto
      if (linhaBruto <= 0 && linhaLiquido <= 0 && linhaDesconto <= 0) {
        return;
      }

      if (!agrupamento[cod]) {
        agrupamento[cod] = {
          codigo: cod,
          descricao: desc,
          quantidade: 0,
          valorLiquido: 0,
          valorDesconto: 0,
          valorBruto: 0,
          docsSet: new Set<string>(),
        };
      } else if (desc && (agrupamento[cod].descricao === cod || desc.length > agrupamento[cod].descricao.length)) {
        agrupamento[cod].descricao = desc;
      }

      // Contabilizar unidades apenas nas linhas normais (quando valor_abater == 0 ou valor_unitario > 0)
      if (valUnit > 0 || valAbat === 0) {
        agrupamento[cod].quantidade += qtd;
        totalGeralUnidades += qtd;
      }

      agrupamento[cod].valorLiquido += linhaLiquido;
      agrupamento[cod].valorDesconto += linhaDesconto;
      agrupamento[cod].valorBruto += linhaBruto;

      totalGeralLiquido += linhaLiquido;
      totalGeralDesconto += linhaDesconto;
      totalGeralBruto += linhaBruto;

      const docRef = s.documento_ref || s.id;
      if (docRef) {
        agrupamento[cod].docsSet.add(docRef);
      }
    });

    const ordenados = Object.values(agrupamento).sort((a, b) => b.valorLiquido - a.valorLiquido);
    const selecionadosRaw =
      topLimit === 'top5'
        ? ordenados.slice(0, 5)
        : topLimit === 'top10'
          ? ordenados.slice(0, 10)
          : topLimit === 'top25'
            ? ordenados.slice(0, 25)
            : ordenados;

    const listaFinal: ArtigoFaturacaoRanking[] = selecionadosRaw.map((item, idx) => ({
      rank: idx + 1,
      codigo: item.codigo,
      descricao: item.descricao,
      quantidade: item.quantidade,
      nrDocs: item.docsSet.size,
      valorLiquido: item.valorLiquido,
      valorDesconto: item.valorDesconto,
      valorBruto: item.valorBruto,
      percentagemTotal:
        totalGeralLiquido > 0 ? Math.round((item.valorLiquido / totalGeralLiquido) * 1000) / 10 : 0,
    }));

    const maxVal = Math.max(
      ...listaFinal.map((d) => d.valorLiquido),
      0
    );

    const artigoLider = ordenados[0] || null;
    const totalArtigosDistintos = ordenados.length;
    const mediaPorArtigo = totalArtigosDistintos > 0 ? totalGeralLiquido / totalArtigosDistintos : 0;

    return {
      artigosList: listaFinal,
      maxValor: maxVal,
      estatisticas: {
        totalLiquido: totalGeralLiquido,
        totalDesconto: totalGeralDesconto,
        totalBruto: totalGeralBruto,
        totalUnidades: totalGeralUnidades,
        totalArtigosDistintos,
        mediaPorArtigo,
        artigoLider,
      },
    };
  }, [saidas, periodo, topLimit]);

  // Configuração dinâmica de dimensões e fontes em função do TOP / número de artigos
  const configDimensoes = useMemo(() => {
    const n = artigosList.length;

    // Se estiver em Top 5 (ou até 5 artigos)
    if (n <= 5) {
      return {
        rowHeight: 52,
        barHeight: 26,
        fontSizeLabel: 12,
        fontSizeValue: 12,
        fontSizeTicks: 11,
        paddingLeft: 270,
        paddingRight: 110,
        paddingTop: 24,
        paddingBottom: 32,
        truncateLen: 36,
      };
    }

    // Se estiver em Top 10 (ou até 10 artigos)
    if (n <= 10) {
      return {
        rowHeight: 32,
        barHeight: 18,
        fontSizeLabel: 10.5,
        fontSizeValue: 10.5,
        fontSizeTicks: 10,
        paddingLeft: 260,
        paddingRight: 105,
        paddingTop: 22,
        paddingBottom: 30,
        truncateLen: 34,
      };
    }

    // Se estiver em Top 25 (ou até 25 artigos)
    if (n <= 25) {
      return {
        rowHeight: 16.5,
        barHeight: 9.5,
        fontSizeLabel: 8.5,
        fontSizeValue: 8.5,
        fontSizeTicks: 9,
        paddingLeft: 230,
        paddingRight: 95,
        paddingTop: 18,
        paddingBottom: 28,
        truncateLen: 32,
      };
    }

    // Se for 'Todos' com mais de 25 artigos
    return {
      rowHeight: 14,
      barHeight: 7.5,
      fontSizeLabel: 7.5,
      fontSizeValue: 7.5,
      fontSizeTicks: 8.5,
      paddingLeft: 215,
      paddingRight: 90,
      paddingTop: 16,
      paddingBottom: 26,
      truncateLen: 30,
    };
  }, [artigosList.length]);

  // Dimensões do Gráfico de Barras Horizontais
  const svgWidth = 860;
  const padding = {
    top: configDimensoes.paddingTop,
    right: configDimensoes.paddingRight,
    bottom: configDimensoes.paddingBottom,
    left: configDimensoes.paddingLeft,
  };
  const contentHeight = Math.max(artigosList.length * configDimensoes.rowHeight, 140);
  const svgHeight = padding.top + contentHeight + padding.bottom;
  const chartWidth = svgWidth - padding.left - padding.right;

  const xMax = useMemo(() => {
    const paddedMax = maxValor * 1.15;
    if (paddedMax <= 0) return 100;
    if (paddedMax <= 50) return Math.ceil(paddedMax / 10) * 10;
    if (paddedMax <= 500) return Math.ceil(paddedMax / 50) * 50;
    if (paddedMax <= 2000) return Math.ceil(paddedMax / 200) * 200;
    if (paddedMax <= 10000) return Math.ceil(paddedMax / 1000) * 1000;
    if (paddedMax <= 50000) return Math.ceil(paddedMax / 5000) * 5000;
    return Math.ceil(paddedMax / 10000) * 10000;
  }, [maxValor]);

  const xTicks = [0, Math.round(xMax * 0.25), Math.round(xMax * 0.5), Math.round(xMax * 0.75), xMax];

  const bars = useMemo(() => {
    return artigosList.map((d, index) => {
      const yCenter = padding.top + index * configDimensoes.rowHeight + configDimensoes.rowHeight / 2;
      const yBar = yCenter - configDimensoes.barHeight / 2;
      const barW = Math.max((d.valorLiquido / xMax) * chartWidth, 2);
      const xBar = padding.left;
      return {
        index,
        data: d,
        yCenter,
        yBar,
        xBar,
        barW,
      };
    });
  }, [artigosList, chartWidth, padding.left, padding.top, configDimensoes.rowHeight, configDimensoes.barHeight, xMax]);

  const activeItem = hoveredIndex !== null ? artigosList[hoveredIndex] : null;
  const activeBar = hoveredIndex !== null ? bars[hoveredIndex] : null;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all">
      {/* Header do Gráfico */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-outline-variant/20">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sermail-green-dark via-sermail-green to-emerald-600 border border-sermail-lime-border/40 flex items-center justify-center text-sermail-lime-border shadow-sm shrink-0">
            <span className="material-symbols-outlined text-2xl">format_align_left</span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold font-headline text-on-surface">
                Faturação Artigo
              </h2>
              {clientName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/80 text-emerald-900 border border-emerald-200">
                  {clientName}
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/80 mt-0.5">
              Ranking de faturação líquida por artigo (barras horizontais) no período selecionado
            </p>
          </div>
        </div>

        {/* Controlos e Filtros (Mesmos filtros temporais do gráfico Faturação Mensal) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor Top Artigos */}
          <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-2xs gap-1">
            {(
              [
                { id: 'top5', label: 'Top 5' },
                { id: 'top10', label: 'Top 10' },
                { id: 'top25', label: 'Top 25' },
                { id: 'todos', label: 'Todos' },
              ] as const
            ).map((lim) => (
              <button
                key={lim.id}
                type="button"
                onClick={() => {
                  setHoveredIndex(null);
                  setTopLimit(lim.id);
                }}
                className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  topLimit === lim.id
                    ? 'bg-white text-emerald-950 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lim.label}
              </button>
            ))}
          </div>

          {/* Seletor de Período Temporal (Idêntico ao Gráfico Faturação Mensal) */}
          <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-2xs gap-1">
            {(
              [
                { id: 'mes-atual', label: t.dashboard.periodCurrentMonth },
                { id: '3m', label: t.dashboard.period3m },
                { id: '6m', label: t.dashboard.period6m },
                { id: '12m', label: t.dashboard.period12m },
                { id: 'ano-atual', label: t.dashboard.periodCurrentYear },
                { id: 'todos', label: t.dashboard.periodAll },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setHoveredIndex(null);
                  setPeriodo(opt.id);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  periodo === opt.id
                    ? 'bg-white text-emerald-950 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda Explicativa */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-1 my-2">
        <div className="flex items-center gap-5 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-gradient-to-r from-lime-400 via-emerald-500 to-sermail-green-dark border border-emerald-700/60 shadow-2xs inline-block"></span>
            <span className="text-slate-800">Faturação Líquida (€)</span>
          </div>
          <span className="text-[11px] text-slate-500 font-normal">
            (Passe o cursor sobre qualquer barra para inspecionar os descontos e mercadoria bruta)
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-600">
          {estatisticas.totalArtigosDistintos} artigo(s) com faturação no período
        </span>
      </div>

      {/* Corpo Principal: 4 Cartões Resumo à Esquerda + Gráfico SVG com Barras Horizontais */}
      <div className="flex flex-col lg:flex-row gap-3.5 sm:gap-4 my-2.5 items-stretch">
        {/* Coluna Esquerda: 4 Cartões Resumo Sermail */}
        <div className="w-full lg:w-72 xl:w-80 flex flex-col justify-between gap-2.5 shrink-0">
          {/* 1. Total Faturação Líquida */}
          <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-emerald-50/90 to-lime-50/50 border border-emerald-200/70 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-950 uppercase tracking-wide leading-snug">
                Faturação Líquida
              </span>
              <div className="w-6 h-6 rounded-md bg-sermail-green/10 text-sermail-green flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-sm">payments</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
              <span className="text-xl sm:text-2xl font-extrabold font-headline text-sermail-green-dark leading-none">
                {formatCurrency(estatisticas.totalLiquido)}
              </span>
              <span className="text-[10px] text-sermail-green font-semibold leading-tight">
                {estatisticas.totalUnidades.toLocaleString(locale)} un.
              </span>
            </div>
          </div>

          {/* 2. Total Descontos */}
          <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-rose-50/80 to-amber-50/50 border border-rose-200/70 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-rose-950 uppercase tracking-wide leading-snug">
                Total Descontos
              </span>
              <div className="w-6 h-6 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-sm">percent</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
              <span className="text-lg sm:text-xl font-bold font-headline text-rose-700 leading-none">
                {formatCurrency(estatisticas.totalDesconto)}
              </span>
              <span className="text-[10px] text-rose-700 font-semibold leading-tight">
                {estatisticas.totalBruto > 0
                  ? `${((estatisticas.totalDesconto / estatisticas.totalBruto) * 100).toFixed(1)}% do bruto`
                  : '0,0%'}
              </span>
            </div>
          </div>

          {/* 3. Média por Artigo */}
          <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/70 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-900/80 uppercase tracking-wide leading-snug">
                Média por Artigo
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-200/50 shrink-0 mt-0.5"></span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
              <span className="text-lg sm:text-xl font-bold font-headline text-emerald-950 leading-none">
                {formatCurrency(estatisticas.mediaPorArtigo)}
              </span>
              <span className="text-[10px] text-emerald-700/90 font-medium leading-tight">
                {estatisticas.totalArtigosDistintos} artigo(s)
              </span>
            </div>
          </div>

          {/* 4. Artigo Líder em Faturação */}
          <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-lime-100/70 via-emerald-50/60 to-lime-50/80 border border-lime-300/70 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-lime-950 uppercase tracking-wide flex items-center gap-1 leading-snug">
                <span className="material-symbols-outlined text-[13px] text-lime-700 shrink-0">emoji_events</span>
                <span>Maior Faturação</span>
              </span>
              {estatisticas.artigoLider && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-lime-300 text-lime-950 leading-none shrink-0">
                  {estatisticas.artigoLider.codigo}
                </span>
              )}
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
              <span className="text-base sm:text-lg font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.artigoLider ? formatCurrency(estatisticas.artigoLider.valorLiquido) : '0,00 €'}
              </span>
              <span
                className="text-[10px] text-emerald-800 font-semibold leading-tight truncate max-w-[140px]"
                title={estatisticas.artigoLider?.descricao || '-'}
              >
                {estatisticas.artigoLider ? estatisticas.artigoLider.descricao : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Janela do Gráfico SVG de Barras Horizontais */}
        <div
          ref={containerRef}
          className="flex-1 min-w-0 relative bg-gradient-to-b from-white via-emerald-50/20 to-lime-50/30 rounded-xl p-2.5 sm:p-3.5 border border-emerald-100/80 shadow-inner overflow-hidden flex flex-col justify-start"
        >
          {artigosList.length > 0 ? (
            <div className="w-full max-h-[500px] overflow-y-auto overflow-x-auto custom-scrollbar">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-auto min-w-[620px] select-none"
              >
                <defs>
                  <linearGradient id="barGradHorizLiq" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="60%" stopColor="#84cc16" />
                    <stop offset="100%" stopColor="#a3e635" />
                  </linearGradient>

                  <linearGradient id="barGradHorizLiqHover" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#059669" />
                    <stop offset="50%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#bef264" />
                  </linearGradient>
                </defs>

                {/* Grelha Vertical e Ticks X */}
                {xTicks.map((val, idx) => {
                  const x = padding.left + (val / xMax) * chartWidth;
                  return (
                    <g key={`xtick-fa-${idx}`}>
                      <line
                        x1={x}
                        y1={padding.top}
                        x2={x}
                        y2={padding.top + contentHeight}
                        stroke={idx === 0 ? '#94a3b8' : '#e2e8f0'}
                        strokeWidth={idx === 0 ? '1.5' : '1'}
                        strokeDasharray={idx === 0 ? 'none' : '4 4'}
                      />
                      <text
                        x={x}
                        y={padding.top + contentHeight + 16}
                        textAnchor="middle"
                        fontSize={configDimensoes.fontSizeTicks}
                        fontWeight="600"
                        fill="#64748b"
                      >
                        {formatShortTick(val)}
                      </text>
                    </g>
                  );
                })}

                {/* Linha vertical divisória do Eixo Y */}
                <line
                  x1={padding.left}
                  y1={padding.top}
                  x2={padding.left}
                  y2={padding.top + contentHeight}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />

                {/* Barras Horizontais e Rótulos do Eixo Y */}
                {bars.map((bar) => {
                  const isHovered = hoveredIndex === bar.index;
                  const labelCompleto = `${bar.data.codigo} - ${bar.data.descricao}`;
                  const labelDisplay =
                    labelCompleto.length > configDimensoes.truncateLen
                      ? labelCompleto.slice(0, configDimensoes.truncateLen - 2) + '…'
                      : labelCompleto;

                  return (
                    <g key={`bar-horiz-${bar.data.codigo}`}>
                      {/* Zona de hover cobrindo a linha inteira */}
                      <rect
                        x={0}
                        y={padding.top + bar.index * configDimensoes.rowHeight}
                        width={svgWidth}
                        height={configDimensoes.rowHeight}
                        fill={isHovered ? '#10b981' : 'transparent'}
                        fillOpacity={isHovered ? 0.08 : 0}
                        className="cursor-pointer transition-all duration-100"
                        onMouseEnter={() => setHoveredIndex(bar.index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />

                      {/* Rótulo Eixo Y: Artigo - Descrição */}
                      <text
                        x={padding.left - 10}
                        y={bar.yCenter}
                        dominantBaseline="central"
                        textAnchor="end"
                        fontSize={isHovered ? configDimensoes.fontSizeLabel + 0.5 : configDimensoes.fontSizeLabel}
                        fontWeight={isHovered ? '700' : '600'}
                        fill={isHovered ? '#047857' : '#1e293b'}
                        className="cursor-pointer transition-colors"
                        onMouseEnter={() => setHoveredIndex(bar.index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        <title>{labelCompleto}</title>
                        {labelDisplay}
                      </text>

                      {/* Barra Horizontal */}
                      <rect
                        x={bar.xBar}
                        y={bar.yBar}
                        width={bar.barW}
                        height={configDimensoes.barHeight}
                        rx={Math.min(configDimensoes.barHeight / 2, 4)}
                        fill={isHovered ? 'url(#barGradHorizLiqHover)' : 'url(#barGradHorizLiq)'}
                        stroke={isHovered ? '#064e3b' : '#059669'}
                        strokeWidth={isHovered ? '1.5' : '0.8'}
                        className="cursor-pointer transition-all duration-150 shadow-sm"
                        onMouseEnter={() => setHoveredIndex(bar.index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />

                      {/* Valor Líquido no final da barra horizontal */}
                      <text
                        x={bar.xBar + bar.barW + 8}
                        y={bar.yCenter}
                        dominantBaseline="central"
                        textAnchor="start"
                        fontSize={isHovered ? configDimensoes.fontSizeValue + 0.5 : configDimensoes.fontSizeValue}
                        fontWeight={isHovered ? '800' : '700'}
                        fill={isHovered ? '#064e3b' : '#0f172a'}
                        className="pointer-events-none transition-colors"
                      >
                        {formatCurrency(bar.data.valorLiquido)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">
                medication_liquid
              </span>
              <p className="text-xs sm:text-sm font-semibold">
                Sem registos de faturação por artigo no período selecionado.
              </p>
            </div>
          )}

          {/* Tooltip Flutuante no Hover */}
          {activeItem && activeBar && (() => {
            return (
              <div
                className="absolute z-20 pointer-events-none bg-slate-900/95 text-white backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-2xl border border-lime-400/40 text-xs transition-all duration-75 min-w-[250px] max-w-[320px]"
                style={{
                  left: `${Math.min(padding.left + activeBar.barW + 25, 540)}px`,
                  top: `${Math.max(activeBar.yCenter - 45, 12)}px`,
                }}
              >
                <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-1 mb-1.5">
                  <span className="font-mono font-bold text-lime-300">
                    #{activeItem.rank} • {activeItem.codigo}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-emerald-200">
                    {activeItem.percentagemTotal}% do total
                  </span>
                </div>
                <p className="font-semibold text-white text-[11px] mb-2 line-clamp-2">
                  {activeItem.descricao}
                </p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-300">Faturação Líquida:</span>
                    <span className="font-mono font-bold text-lime-300">
                      {formatCurrency(activeItem.valorLiquido)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-300">Descontos:</span>
                    <span className="font-mono font-semibold text-rose-300">
                      {formatCurrency(activeItem.valorDesconto)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-300">Mercadoria Bruta:</span>
                    <span className="font-mono text-white">
                      {formatCurrency(activeItem.valorBruto)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/10">
                    <span className="text-slate-300">Unidades / Docs:</span>
                    <span className="font-mono text-emerald-200">
                      {activeItem.quantidade.toLocaleString(locale)} un • {activeItem.nrDocs} doc(s)
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
