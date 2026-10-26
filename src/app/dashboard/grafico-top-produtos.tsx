'use client';

import { useState, useMemo, useRef } from 'react';
import { DashboardSaidaItem } from './dashboard-view';
import { useLanguage } from '@/lib/i18n/context';

interface GraficoTopProdutosProps {
  saidas: DashboardSaidaItem[];
  clientName?: string | null;
  onSelectProdutoPrevisao?: (codigo: string) => void;
}

type PeriodoFiltro = 'mes-atual' | '3m' | '6m' | '12m' | 'ano-atual' | 'todos';
type TipoVisualizacao = 'barras' | 'area' | 'combinado';
type TopLimit = 'top5' | 'top10' | 'top25';

interface ProdutoRanking {
  rank: number;
  codigo: string;
  descricao: string;
  tipo_desc: string;
  quantidade: number;
  nrPedidos: number;
  percentagemTop: number;
}

// Extrai ano e mês/data com segurança para múltiplos formatos (ISO com T, PostgreSQL com espaço/fuso, YYYY-MM-DD)
function extrairData(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (!str) return null;

  // Se for apenas data no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Se contiver espaço e fuso (ex: "2026-04-27 00:00:00+00")
  if (str.includes(' ') && !str.includes('T')) {
    const isoStr = str.replace(' ', 'T');
    const d = new Date(isoStr);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Se tiver pelo menos 10 caracteres no formato YYYY-MM-DD
  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(`${str.slice(0, 10)}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export default function GraficoTopProdutos({
  saidas,
  clientName,
  onSelectProdutoPrevisao,
}: GraficoTopProdutosProps) {
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-PT';

  const [topLimit, setTopLimit] = useState<TopLimit>('top10');
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('12m');
  const [tipoGrafico, setTipoGrafico] = useState<TipoVisualizacao>('combinado');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Agrupamento dos 10 produtos com mais saídas no período a partir exclusivamente da view vw_saidas
  const { topProdutos, estatisticas } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Data de corte com base no período
    let dataInicio: Date | null = null;
    if (periodo === 'mes-atual') {
      dataInicio = new Date(currentYear, currentMonth, 1);
    } else if (periodo === '3m') {
      dataInicio = new Date(currentYear, currentMonth - 2, 1);
    } else if (periodo === '6m') {
      dataInicio = new Date(currentYear, currentMonth - 5, 1);
    } else if (periodo === '12m') {
      dataInicio = new Date(currentYear, currentMonth - 11, 1);
    } else if (periodo === 'ano-atual') {
      dataInicio = new Date(currentYear, 0, 1);
    } // 'todos' => dataInicio = null

    // Filtrar saídas no período
    const saidasFiltradas = (saidas || []).filter((s) => {
      if (!dataInicio) return true;
      const dataMov = extrairData(s.data_movimento || s.created_at);
      if (!dataMov) return true;
      return dataMov >= dataInicio;
    });

    // Agrupar exclusivamente por artigo da view vw_saidas
    const agrupamento: Record<
      string,
      { codigo: string; descricao: string; tipo_desc: string; quantidade: number; docsSet: Set<string> }
    > = {};

    let totalGeralUnidades = 0;

    saidasFiltradas.forEach((s) => {
      const cod = s.artigo_id || s.artigo || s.artigo_codigo || s.artigo_cli || 'N/A';
      const desc = s.descricao || s.artigo_descricao || s.artigo || cod;
      const qtd = Number(s.quantidade) || 0;
      totalGeralUnidades += qtd;

      if (!agrupamento[cod]) {
        agrupamento[cod] = {
          codigo: cod,
          descricao: desc,
          tipo_desc: s.tipo_desc || '',
          quantidade: 0,
          docsSet: new Set(),
        };
      } else {
        const melhorDesc = s.descricao || s.artigo_descricao;
        if (melhorDesc && (agrupamento[cod].descricao === cod || melhorDesc.length > agrupamento[cod].descricao.length)) {
          agrupamento[cod].descricao = melhorDesc;
        }
      }
      agrupamento[cod].quantidade += qtd;
      const docRef = s.documento_ref || s.id;
      if (docRef) {
        agrupamento[cod].docsSet.add(docRef);
      }
    });

    // Ordenar por maior quantidade e selecionar de acordo com o filtro (Top 5, Top 10 ou Top 25)
    const ordenados = Object.values(agrupamento).sort((a, b) => b.quantidade - a.quantidade);
    const selecionadosRaw =
      topLimit === 'top5'
        ? ordenados.slice(0, 5)
        : topLimit === 'top10'
        ? ordenados.slice(0, 10)
        : ordenados.slice(0, 25);

    const totalSelecionados = selecionadosRaw.reduce((acc, curr) => acc + curr.quantidade, 0);

    const topProdutos: ProdutoRanking[] = selecionadosRaw.map((p, idx) => ({
      rank: idx + 1,
      codigo: p.codigo,
      descricao: p.descricao,
      tipo_desc: p.tipo_desc,
      quantidade: p.quantidade,
      nrPedidos: p.docsSet.size,
      percentagemTop: totalSelecionados > 0 ? Math.round((p.quantidade / totalSelecionados) * 100) : 0,
    }));

    const produtoLider = topProdutos[0] || null;
    const mediaPorProduto =
      topProdutos.length > 0 ? Math.round(totalSelecionados / topProdutos.length) : 0;
    const concentracaoGeral =
      totalGeralUnidades > 0 ? Math.round((totalSelecionados / totalGeralUnidades) * 100) : 0;

    return {
      topProdutos,
      estatisticas: {
        totalTop10: totalSelecionados,
        totalGeralUnidades,
        produtoLider,
        mediaPorProduto,
        concentracaoGeral,
        totalProdutosDistintos: Object.keys(agrupamento).length,
      },
    };
  }, [saidas, periodo, topLimit]);

  // Dimensões do SVG do gráfico otimizadas: largura dinâmica se houver muitos produtos no modo 'top25'
  const svgWidth = useMemo(() => {
    const count = topProdutos.length;
    if (count <= 10) return 850;
    // No modo 'top25', atribui ~70px por artigo para permitir scroll horizontal limpo
    return Math.max(850, count * 70);
  }, [topProdutos.length]);

  const svgHeight = 280;
  const padding = { top: 25, right: 30, bottom: 42, left: 70 };

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

  // Largura de cada barra
  const barWidth = useMemo(() => {
    const n = topProdutos.length;
    if (n === 0) return 24;
    const available = chartWidth / n;
    return Math.min(Math.max(available * 0.52, 14), 38);
  }, [topProdutos.length, chartWidth]);

  // Coordenadas dos pontos no gráfico com margem de afastamento para a 1ª coluna não encostar na escala Y
  const points = useMemo(() => {
    const num = topProdutos.length;
    if (num === 0) return [];

    const xOffset = Math.max(barWidth * 0.9, 32);
    const availableWidth = Math.max(chartWidth - xOffset * 2, 0);

    return topProdutos.map((p, index) => {
      const x =
        num === 1
          ? padding.left + chartWidth / 2
          : padding.left + xOffset + (index / (num - 1)) * availableWidth;
      const y = padding.top + chartHeight - (p.quantidade / yMax) * chartHeight;

      return {
        x,
        y,
        data: p,
        index,
      };
    });
  }, [topProdutos, chartWidth, chartHeight, padding, yMax, barWidth]);

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

  const activeItem = hoveredIndex !== null ? topProdutos[hoveredIndex] : null;
  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all">
      {/* Header do Gráfico */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3.5 pb-3.5 border-b border-outline-variant/20">
        <div className="flex items-start gap-3.5 2xl:w-1/3">
          {/* Ícone com gradiente Verde Pastel e Lima */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-lime-200 via-emerald-100 to-teal-200/80 border border-lime-300/60 flex items-center justify-center text-lime-900 shadow-sm shrink-0">
            <span className="material-symbols-outlined text-2xl text-emerald-800">leaderboard</span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold font-headline text-on-surface">
                {topLimit === 'top5'
                  ? 'Top 5 Artigos Mais Pedidos'
                  : topLimit === 'top10'
                  ? 'Top 10 Artigos Mais Pedidos'
                  : 'Top 25 Artigos Mais Pedidos'}
              </h2>
              {clientName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/70 text-emerald-900 border border-emerald-200">
                  {clientName}
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/80 mt-0.5">
              {topLimit === 'top5'
                ? 'Os 5 artigos líderes com maior volume de saídas'
                : topLimit === 'top10'
                ? 'Os 10 artigos com maior quantidade expedida'
                : 'Os 25 artigos com maior quantidade expedida'}
            </p>
          </div>
        </div>

        {/* Seletor de Escopo CENTRALIZADO E EVIDENCIADO: Top 5 / Top 10 / Top 25 */}
        <div className="flex justify-center items-center my-1.5 2xl:my-0 2xl:w-1/3">
          <div className="inline-flex items-center p-1.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-lime-50/70 to-emerald-50 border-2 border-emerald-400/90 shadow-sm ring-2 ring-emerald-500/15 gap-1">
            {(
              [
                { id: 'top5', label: 'Top 5' },
                { id: 'top10', label: 'Top 10' },
                { id: 'top25', label: 'Top 25' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTopLimit(opt.id)}
                className={`px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                  topLimit === opt.id
                    ? 'bg-gradient-to-r from-emerald-700 to-teal-800 text-white shadow-md shadow-emerald-900/30 scale-[1.04] ring-1 ring-white/40'
                    : 'text-emerald-950/80 hover:text-emerald-950 hover:bg-emerald-200/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Controlos e Filtros (Tipo de Gráfico e Período) */}
        <div className="flex flex-wrap items-center justify-start 2xl:justify-end gap-2.5 2xl:w-1/3">
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

      {/* Corpo Principal: Cards na Lateral Esquerda + Gráfico no Espaço Restante */}
      <div className="flex flex-col lg:flex-row gap-3.5 sm:gap-4 my-4 items-stretch">
        {/* Coluna Lateral Esquerda: Cartões de Métricas e Destaques */}
        <div className="grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-4 gap-2.5 sm:gap-3 w-full lg:w-56 xl:w-64 shrink-0">
          {/* 1. Total Unidades Selecionadas */}
          <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-lime-50/90 to-emerald-50/50 border border-lime-200/70 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-lime-900/80 uppercase tracking-wide leading-snug whitespace-normal">
                {topLimit === 'top5' ? 'Total Unidades Top 5' : topLimit === 'top10' ? t.dashboard.top10TotalUnits : 'Total Unidades Top 25'}
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

          {/* 3. Média por Produto Selecionado */}
          <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/70 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-900/80 uppercase tracking-wide leading-snug whitespace-normal">
                {topLimit === 'top5' ? 'Média por Artigo Top 5' : topLimit === 'top10' ? t.dashboard.top10AveragePerItem : 'Média por Artigo Top 25'}
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
                {topLimit === 'top5' ? 'Top 5' : topLimit === 'top10' ? 'Top 10' : 'Top 25'}
              </span>
            </div>
          </div>

          {/* 4. Concentração */}
          <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-teal-50/90 to-emerald-50/60 border border-teal-200/70 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-teal-900/80 uppercase tracking-wide leading-snug whitespace-normal">
                {topLimit === 'top5' ? 'Quota Top 5 no Total' : topLimit === 'top10' ? t.dashboard.top10ShareOfTotal : 'Quota Top 25 no Total'}
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
          className="flex-1 min-w-0 relative bg-gradient-to-b from-white via-emerald-50/20 to-lime-50/30 rounded-xl p-2.5 sm:p-3.5 border border-emerald-100/80 shadow-inner overflow-hidden flex flex-col justify-center"
        >
          {topProdutos.length > 0 ? (
            <div className="w-full overflow-x-auto flex items-center justify-center">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-auto min-w-[500px] select-none"
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
                      x={padding.left - 10}
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
                          fill="#10b981"
                          stroke="#059669"
                          strokeWidth="1"
                          opacity={tipoGrafico === 'combinado' ? 0.8 : isHovered ? 1 : 0.92}
                          className="transition-all duration-150 cursor-pointer"
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
                          r={isHovered ? 6 : isFirst ? 5.5 : 4}
                          fill={isHovered ? '#10b981' : isFirst ? '#a3e635' : '#d9f99d'}
                          stroke={isHovered ? '#059669' : isFirst ? '#4d7c0f' : '#059669'}
                          strokeWidth={isHovered ? '2.5' : '2'}
                          className="transition-all duration-150"
                          onMouseEnter={() => setHoveredIndex(i)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        />
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
              className="absolute z-20 pointer-events-none bg-slate-900/95 text-white backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-2xl border border-lime-300/40 text-xs transition-all duration-75 max-w-[300px] min-w-[220px]"
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
                <div className="mt-2 pt-1.5 border-t border-white/15 text-xs text-lime-300 font-semibold flex items-center gap-1.5 justify-center">
                  <span className="material-symbols-outlined text-sm">touch_app</span>
                  <span>{t.dashboard.top10TooltipClick}</span>
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
