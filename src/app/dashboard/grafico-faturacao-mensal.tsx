'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DashboardFaturacaoItem } from './dashboard-view';
import { useLanguage } from '@/lib/i18n/context';

interface GraficoFaturacaoMensalProps {
  faturacao: DashboardFaturacaoItem[];
  clientName?: string | null;
}

type PeriodoFiltro = 'mes-atual' | '3m' | '6m' | '12m' | 'ano-atual' | 'todos';
type TipoVisualizacao = 'barras' | 'area' | 'combinado';
type TipoMetrica = 'faturacao' | 'unidades';

interface MesData {
  key: string; // "2026-03"
  year: number;
  month: number; // 0-11
  label: string; // "Mar '26"
  labelCompleto: string; // "Março 2026"
  total_quantidade: number;
  total_docs: number;
  total_merc: number;
  total_iva: number;
  total_desc: number;
  total_liquido: number; // total_merc - total_iva - total_desc
  diffAnterior: number | null; // % vs mes anterior (baseado em total_liquido)
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

export default function GraficoFaturacaoMensal({ faturacao, clientName }: GraficoFaturacaoMensalProps) {
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-PT';

  // Verifica se existe valor monetário na faturação
  const hasMonetaryData = useMemo(() => {
    return faturacao.some((f) => (Number(f.total_merc) || 0) > 0);
  }, [faturacao]);

  const [periodo, setPeriodo] = useState<PeriodoFiltro>('12m');
  const [tipoGrafico, setTipoGrafico] = useState<TipoVisualizacao>('barras');
  const [tipoMetrica, setTipoMetrica] = useState<TipoMetrica>(hasMonetaryData ? 'faturacao' : 'unidades');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMonetaryData && tipoMetrica === 'faturacao') {
      setTipoMetrica('unidades');
    }
  }, [hasMonetaryData]);

  // Processamento e agrupamento mensal de faturacao / movimentos
  const { dadosMensais, estatisticas, maxValor } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Mapeia todas as contagens por "YYYY-MM"
    const contagemPorMes: Record<
      string,
      { quantidade: number; docs: number; merc: number; iva: number; desc: number }
    > = {};
    const todosAnosDisponiveis = new Set<number>();

    faturacao.forEach((p) => {
      const dataRaw = p.data;
      const parsed = extrairAnoMes(dataRaw);
      if (parsed) {
        const key = `${parsed.year}-${String(parsed.month + 1).padStart(2, '0')}`;
        if (!contagemPorMes[key]) {
          contagemPorMes[key] = { quantidade: 0, docs: 0, merc: 0, iva: 0, desc: 0 };
        }
        contagemPorMes[key].quantidade += Number(p.total_quantidade) || 0;
        contagemPorMes[key].docs += Number(p.total_docs) || 0;
        contagemPorMes[key].merc += Number(p.total_merc) || 0;
        contagemPorMes[key].iva += Number(p.total_iva) || 0;
        contagemPorMes[key].desc += Number(p.total_desc) || 0;
        todosAnosDisponiveis.add(parsed.year);
      }
    });

    todosAnosDisponiveis.add(currentYear);

    // Determina o intervalo de meses a gerar baseado no filtro selecionado
    const mesesParaGerar: { year: number; month: number }[] = [];

    if (periodo === 'mes-atual') {
      mesesParaGerar.push({ year: currentYear, month: currentMonth });
    } else if (periodo === '3m') {
      for (let i = 2; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        mesesParaGerar.push({ year: d.getFullYear(), month: d.getMonth() });
      }
    } else if (periodo === '6m') {
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
    let prevVal: number | null = null;
    const resultado: MesData[] = mesesParaGerar.map(({ year, month }) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const mesData = contagemPorMes[key] || { quantidade: 0, docs: 0, merc: 0, iva: 0, desc: 0 };
      const total_quantidade = mesData.quantidade;
      const total_docs = mesData.docs;
      const total_merc = mesData.merc;
      const total_iva = mesData.iva;
      const total_desc = mesData.desc;
      // Faturação Líquida = Mercadoria - IVA - Descontos
      const total_liquido = total_merc - total_iva - total_desc;

      const mShort = monthsShort[month] || String(month + 1);
      const mFull = monthsNames[month] || String(month + 1);
      const label = `${mShort} '${String(year).slice(-2)}`;
      const labelCompleto = language === 'pt' ? `${mFull} de ${year}` : `${mFull} ${year}`;

      const valorComparacao = tipoMetrica === 'unidades' ? total_quantidade : total_liquido;

      let diffAnterior: number | null = null;
      if (prevVal !== null) {
        if (prevVal === 0) {
          diffAnterior = valorComparacao > 0 ? 100 : 0;
        } else {
          diffAnterior = Math.round(((valorComparacao - prevVal) / prevVal) * 100);
        }
      }
      prevVal = valorComparacao;

      return {
        key,
        year,
        month,
        label,
        labelCompleto,
        total_quantidade,
        total_docs,
        total_merc,
        total_iva,
        total_desc,
        total_liquido,
        diffAnterior,
      };
    });

    // Estatísticas resumidas do período
    const totalLiquidoPeriodo = resultado.reduce((acc, curr) => acc + curr.total_liquido, 0);
    const totalMercPeriodo = resultado.reduce((acc, curr) => acc + curr.total_merc, 0);
    const totalDescPeriodo = resultado.reduce((acc, curr) => acc + curr.total_desc, 0);
    const totalIvaPeriodo = resultado.reduce((acc, curr) => acc + curr.total_iva, 0);
    const totalQuantidadePeriodo = resultado.reduce((acc, curr) => acc + curr.total_quantidade, 0);
    const totalDocsPeriodo = resultado.reduce((acc, curr) => acc + curr.total_docs, 0);

    const mediaMensalLiquida = resultado.length > 0 ? totalLiquidoPeriodo / resultado.length : 0;
    const mediaMensalUnidades = resultado.length > 0 ? totalQuantidadePeriodo / resultado.length : 0;

    const mesPico = resultado.reduce<MesData | null>((pico, curr) => {
      const valAtual = tipoMetrica === 'unidades' ? curr.total_quantidade : curr.total_liquido;
      const valPico = pico
        ? tipoMetrica === 'unidades'
          ? pico.total_quantidade
          : pico.total_liquido
        : -1;
      if (!pico || valAtual > valPico) {
        return curr;
      }
      return pico;
    }, null);

    // Último mês com dados ou mês corrente
    const ultimoMes = resultado[resultado.length - 1];
    const penultimoMes = resultado.length > 1 ? resultado[resultado.length - 2] : null;
    let variacaoUltimoMes = 0;
    const valUltimo = tipoMetrica === 'unidades' ? ultimoMes?.total_quantidade || 0 : ultimoMes?.total_liquido || 0;
    const valPenultimo = tipoMetrica === 'unidades' ? penultimoMes?.total_quantidade || 0 : penultimoMes?.total_liquido || 0;

    if (valPenultimo > 0 && ultimoMes) {
      variacaoUltimoMes = Math.round(((valUltimo - valPenultimo) / valPenultimo) * 100);
    } else if (valUltimo > 0 && valPenultimo === 0) {
      variacaoUltimoMes = 100;
    }

    // Escala máxima: no modo faturação, tem em conta tanto a coluna líquida como a coluna de descontos
    const maxVal = Math.max(
      ...resultado.map((d) =>
        tipoMetrica === 'unidades'
          ? d.total_quantidade
          : Math.max(d.total_liquido, d.total_desc, d.total_merc)
      ),
      0
    );

    return {
      dadosMensais: resultado,
      maxValor: maxVal,
      estatisticas: {
        totalLiquido: totalLiquidoPeriodo,
        totalMerc: totalMercPeriodo,
        totalDesc: totalDescPeriodo,
        totalIva: totalIvaPeriodo,
        totalQuantidade: totalQuantidadePeriodo,
        totalDocs: totalDocsPeriodo,
        mediaLiquida: mediaMensalLiquida,
        mediaUnidades: mediaMensalUnidades,
        pico: mesPico,
        ultimoMes,
        variacaoUltimoMes,
      },
    };
  }, [faturacao, periodo, tipoMetrica, t.dashboard.months, t.dashboard.monthsShort, language]);

  // Dimensões do SVG do gráfico
  const svgWidth = 800;
  const svgHeight = 250;
  const padding = { top: 38, right: 25, bottom: 40, left: 60 };

  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // Escala Y máxima adaptativa (com headroom para rótulos no topo das colunas)
  const yMax = useMemo(() => {
    const paddedMax = maxValor * 1.12; // 12% de margem no topo para rótulos
    if (paddedMax <= 0) return 10;
    if (paddedMax <= 10) return 10;
    if (paddedMax <= 50) return Math.ceil(paddedMax / 10) * 10;
    if (paddedMax <= 500) return Math.ceil(paddedMax / 50) * 50;
    if (paddedMax <= 2000) return Math.ceil(paddedMax / 200) * 200;
    if (paddedMax <= 10000) return Math.ceil(paddedMax / 1000) * 1000;
    if (paddedMax <= 50000) return Math.ceil(paddedMax / 5000) * 5000;
    return Math.ceil(paddedMax / 10000) * 10000;
  }, [maxValor]);

  // Linhas de grelha Y
  const yTicks = [0, Math.round(yMax * 0.25), Math.round(yMax * 0.5), Math.round(yMax * 0.75), yMax];

  // Cálculo das coordenadas dos pontos (para o modo área e curva Bézier)
  const points = useMemo(() => {
    const numPoints = dadosMensais.length;
    if (numPoints === 0) return [];

    return dadosMensais.map((d, index) => {
      const x =
        numPoints === 1
          ? padding.left + chartWidth / 2
          : padding.left + (index / (numPoints - 1)) * chartWidth;
      const valorGrafico = tipoMetrica === 'unidades' ? d.total_quantidade : d.total_liquido;
      const y = padding.top + chartHeight - (valorGrafico / yMax) * chartHeight;
      return { x, y, data: d, index, valorGrafico };
    });
  }, [dadosMensais, chartWidth, chartHeight, padding, yMax, tipoMetrica]);

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

  // Formatador curto para os ticks do eixo Y
  const formatShortTick = (val: number) => {
    if (tipoMetrica === 'faturacao') {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M€`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}k€`;
      return `${val}€`;
    }
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return String(val);
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all">
      {/* Header do Gráfico */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-outline-variant/20">
        <div className="flex items-start gap-3.5">
          {/* Ícone com gradiente Verde Sermail */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sermail-green-dark via-sermail-green to-emerald-600 border border-sermail-lime-border/40 flex items-center justify-center text-sermail-lime-border shadow-sm shrink-0">
            <span className="material-symbols-outlined text-2xl">monitoring</span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold font-headline text-on-surface">
                Evolução Mensal de Faturação
              </h2>
              {clientName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/80 text-emerald-900 border border-emerald-200">
                  {clientName}
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/80 mt-0.5">
              Comparativo de Faturação Líquida (Mercadoria − IVA − Descontos) e Total de Descontos por mês
            </p>
          </div>
        </div>

        {/* Controlos e Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Tipo de Gráfico */}
          <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setTipoGrafico('barras')}
              title="Visualização em Colunas Paralelas"
              className={`px-2 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${tipoGrafico === 'barras'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <span className="material-symbols-outlined text-sm">bar_chart</span>
            </button>
            <button
              type="button"
              onClick={() => setTipoGrafico('area')}
              title={t.dashboard.viewArea}
              className={`px-2 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${tipoGrafico === 'area'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <span className="material-symbols-outlined text-sm">area_chart</span>
            </button>
            <button
              type="button"
              onClick={() => setTipoGrafico('combinado')}
              title="Visualização Combinada (Colunas + Tendência)"
              className={`px-2 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${tipoGrafico === 'combinado'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <span className="material-symbols-outlined text-sm">stacked_line_chart</span>
            </button>
          </div>

          {/* Seletor de Período */}
          <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-2xs">
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
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${periodo === opt.id
                  ? 'bg-white text-emerald-950 shadow-xs border border-slate-200 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerta informativo caso PVA esteja a 0 */}
      {tipoMetrica === 'faturacao' && !hasMonetaryData && (
        <div className="mt-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-amber-600 shrink-0">info</span>
            <span>
              O preço unitário (PVA) dos artigos encontra-se atualmente a 0,00 €. O cálculo da mercadoria avalia a 0,00 €.
              Pode consultar os dados em <strong>Unidades</strong> ou configurar o PVA na aba Configuração.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTipoMetrica('unidades')}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 transition-colors cursor-pointer shrink-0"
          >
            Ver Unidades
          </button>
        </div>
      )}

      {/* Cartões de Métricas e Destaques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 my-4 items-stretch">
        {/* 1. Total Faturado Líquido (Mercadoria - IVA - Descontos) */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-lime-50/90 to-emerald-50/50 border border-lime-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-lime-900/80 uppercase tracking-wide leading-snug">
              {tipoMetrica === 'faturacao' ? 'Faturação Líquida' : 'Total Expedido'}
            </span>
            <span className="w-2 h-2 rounded-full bg-lime-500 ring-4 ring-lime-200/50 shrink-0 mt-0.5"></span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {tipoMetrica === 'faturacao'
                  ? formatCurrency(estatisticas.totalLiquido)
                  : `${estatisticas.totalQuantidade.toLocaleString(locale)} un`}
              </span>
            </div>
            <span className="text-[10px] text-emerald-700/90 font-medium leading-tight">
              {tipoMetrica === 'faturacao'
                ? `Mercadoria: ${formatCurrency(estatisticas.totalMerc)}`
                : `${estatisticas.totalDocs.toLocaleString(locale)} documentos`}
            </span>
          </div>
        </div>

        {/* 2. Total de Descontos (Coluna Paralela) */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-rose-50/90 to-amber-50/50 border border-rose-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-rose-900/80 uppercase tracking-wide leading-snug">
              Total Descontos
            </span>
            <span className="w-2 h-2 rounded-full bg-rose-500 ring-4 ring-rose-200/50 shrink-0 mt-0.5"></span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-rose-950 leading-none">
                {formatCurrency(estatisticas.totalDesc)}
              </span>
            </div>
            <span className="text-[10px] text-rose-700/90 font-medium leading-tight">
              {estatisticas.totalMerc > 0
                ? `${((estatisticas.totalDesc / estatisticas.totalMerc) * 100).toFixed(1)}% da mercadoria`
                : 'Coluna paralela'}
            </span>
          </div>
        </div>

        {/* 3. Média Mensal */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-900/80 uppercase tracking-wide leading-snug">
              Média Mensal
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-200/50 shrink-0 mt-0.5"></span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {tipoMetrica === 'faturacao'
                  ? formatCurrency(estatisticas.mediaLiquida)
                  : `${Math.round(estatisticas.mediaUnidades).toLocaleString(locale)} un`}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">
                /{language === 'en' ? 'mo' : 'mês'}
              </span>
            </div>
            <span className="text-[10px] text-emerald-700/90 font-medium leading-tight">
              {dadosMensais.length} meses analisados
            </span>
          </div>
        </div>

        {/* 4. Mês Mais Recente & Tendência */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-teal-50/90 to-emerald-50/60 border border-teal-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-teal-900/80 uppercase tracking-wide leading-snug">
              Mês Mais Recente
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold leading-none shrink-0 ${estatisticas.variacaoUltimoMes > 0
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
                {tipoMetrica === 'faturacao'
                  ? formatCurrency(estatisticas.ultimoMes?.total_liquido || 0)
                  : `${(estatisticas.ultimoMes?.total_quantidade || 0).toLocaleString(locale)} un`}
              </span>
            </div>
            <span className="text-[10px] text-teal-800 font-medium leading-tight">
              vs. mês anterior
            </span>
          </div>
        </div>
      </div>

      {/* Legenda Explicativa das Colunas Paralelas */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2 px-1">
        <div className="flex items-center gap-5 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-gradient-to-br from-lime-400 to-emerald-600 border border-emerald-700/60 shadow-2xs inline-block"></span>
            <span className="text-slate-800">
              {tipoMetrica === 'faturacao'
                ? 'Faturação Líquida (Mercadoria − IVA − Descontos)'
                : 'Unidades Expedidas'}
            </span>
          </div>
          {tipoMetrica === 'faturacao' && (
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-gradient-to-br from-rose-400 to-rose-600 border border-rose-700/60 shadow-2xs inline-block"></span>
              <span className="text-slate-800">Total Descontos</span>
            </div>
          )}
        </div>

        <span className="text-[11px] text-slate-500 font-medium">
          {tipoGrafico === 'barras' || tipoGrafico === 'combinado'
            ? 'Colunas paralelas por mês'
            : 'Curva de evolução'}
        </span>
      </div>

      {/* Área do Gráfico SVG com Suporte a Hover & Tooltips */}
      <div
        ref={containerRef}
        className="relative bg-gradient-to-b from-white via-emerald-50/20 to-lime-50/30 rounded-xl p-2.5 sm:p-3.5 border border-emerald-100/80 shadow-inner overflow-hidden"
      >
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto min-w-[580px] max-h-[260px] select-none"
          >
            <defs>
              <linearGradient id="areaGradientVerdeLima" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#84cc16" stopOpacity="0.45" />
                <stop offset="40%" stopColor="#a3e635" stopOpacity="0.25" />
                <stop offset="75%" stopColor="#6ee7b7" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.01" />
              </linearGradient>

              <linearGradient id="strokeGradientLima" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#65a30d" />
                <stop offset="35%" stopColor="#84cc16" />
                <stop offset="70%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>

              {/* Gradiente para a Coluna 1: Faturação Líquida */}
              <linearGradient id="barGradientLiquido" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#84cc16" />
                <stop offset="40%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>

              <linearGradient id="barGradientLiquidoHover" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#bef264" />
                <stop offset="40%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>

              {/* Gradiente para a Coluna 2: Total Descontos */}
              <linearGradient id="barGradientDescontos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="50%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#e11d48" />
              </linearGradient>

              <linearGradient id="barGradientDescontosHover" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fda4af" />
                <stop offset="50%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#f43f5e" />
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
                    {formatShortTick(val)}
                  </text>
                </g>
              );
            })}

            {/* Colunas Paralelas Agrupadas (se modo 'barras' ou 'combinado') */}
            {(tipoGrafico === 'barras' || tipoGrafico === 'combinado') &&
              points.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const isPeak = estatisticas.pico?.key === p.data.key && p.data.total_liquido > 0;

                const slotWidth = Math.min(chartWidth / points.length, 64);
                const hasTwoBars = tipoMetrica === 'faturacao';
                const spacing = 3;
                const barW = hasTwoBars
                  ? Math.max(Math.min((slotWidth - 10) / 2, 16), 6)
                  : Math.max(Math.min(slotWidth * 0.65, 26), 8);

                // Coluna 1: Total Líquido (Mercadoria - IVA - Descontos) ou Unidades
                const val1 = tipoMetrica === 'unidades' ? p.data.total_quantidade : p.data.total_liquido;
                const bHeight1 = ((val1 / yMax) * chartHeight) || 0;
                const bY1 = padding.top + chartHeight - bHeight1;
                const bX1 = hasTwoBars ? p.x - barW - spacing / 2 : p.x - barW / 2;

                // Coluna 2: Total Descontos (Coluna Paralela)
                const val2 = p.data.total_desc;
                const bHeight2 = ((val2 / yMax) * chartHeight) || 0;
                const bY2 = padding.top + chartHeight - bHeight2;
                const bX2 = p.x + spacing / 2;

                return (
                  <g key={`bar-group-${i}`}>
                    {/* Hitbox transparente que engloba ambas as colunas paralelas */}
                    <rect
                      x={p.x - slotWidth / 2}
                      y={padding.top}
                      width={slotWidth}
                      height={chartHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />

                    {/* Coluna 1: Faturação Líquida */}
                    {bHeight1 > 0 && (
                      <rect
                        x={bX1}
                        y={bY1}
                        width={barW}
                        height={bHeight1}
                        rx={Math.min(barW / 2, 4)}
                        ry={Math.min(barW / 2, 4)}
                        fill={isHovered ? 'url(#barGradientLiquidoHover)' : 'url(#barGradientLiquido)'}
                        stroke={isHovered ? '#14532d' : '#15803d'}
                        strokeWidth={isHovered ? '2' : '1'}
                        opacity={tipoGrafico === 'combinado' ? 0.8 : 0.95}
                        className="transition-all duration-200 cursor-pointer hover:opacity-100"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    )}

                    {/* Coluna 2: Total de Descontos (Paralela à Coluna 1) */}
                    {hasTwoBars && bHeight2 > 0 && (
                      <rect
                        x={bX2}
                        y={bY2}
                        width={barW}
                        height={bHeight2}
                        rx={Math.min(barW / 2, 4)}
                        ry={Math.min(barW / 2, 4)}
                        fill={isHovered ? 'url(#barGradientDescontosHover)' : 'url(#barGradientDescontos)'}
                        stroke={isHovered ? '#9f1239' : '#be123c'}
                        strokeWidth={isHovered ? '2' : '1'}
                        opacity={tipoGrafico === 'combinado' ? 0.8 : 0.95}
                        className="transition-all duration-200 cursor-pointer hover:opacity-100"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    )}

                    {/* Rótulo Permanente do Valor Líquido no Topo da Coluna */}
                    {bHeight1 > 0 && (
                      <g className="pointer-events-none transition-opacity duration-200">
                        <text
                          x={hasTwoBars ? bX1 + barW / 2 : p.x}
                          y={bY1 - 6}
                          textAnchor="middle"
                          fontSize="9.5"
                          fontWeight={isHovered ? '800' : '700'}
                          fill={isHovered ? '#14532d' : '#166534'}
                          className="font-mono tracking-tight"
                        >
                          {formatShortTick(val1)}
                        </text>
                      </g>
                    )}

                    {/* Rótulo de Descontos no Topo ao passar o cursor ou se hovered */}
                    {hasTwoBars && bHeight2 > 0 && isHovered && (
                      <g className="pointer-events-none">
                        <text
                          x={bX2 + barW / 2}
                          y={bY2 - 6}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="800"
                          fill="#be123c"
                          className="font-mono tracking-tight"
                        >
                          {formatShortTick(val2)}
                        </text>
                      </g>
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
                  const isPeak = estatisticas.pico?.key === p.data.key && p.valorGrafico > 0;

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
                          r={13}
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
        {activeItem && activePoint && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 text-white backdrop-blur-md px-4 py-3 rounded-xl shadow-2xl border border-lime-300/40 text-xs transition-all duration-75 min-w-[240px]"
            style={{
              right: '16px',
              top: '16px',
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1 mb-2">
              <span className="font-bold text-lime-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-lime-400">event</span>
                {activeItem.labelCompleto}
              </span>
              {activeItem.total_liquido === estatisticas.pico?.total_liquido && activeItem.total_liquido > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-lime-400 text-slate-950">
                  Máx
                </span>
              )}
            </div>

            {/* Detalhe da Decomposição */}
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-slate-300 font-semibold">Total Mercadorias:</span>
                <span className="font-bold text-xs text-slate-200">
                  {formatCurrency(activeItem.total_merc)}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-4">
                <span className="text-slate-300 font-semibold">Total IVA:</span>
                <span className="font-bold text-xs text-amber-300">
                  {formatCurrency(activeItem.total_iva)}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-4 text-rose-300">
                <span className="font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                  Coluna 2 (Descontos):
                </span>
                <span className="font-bold text-xs">
                  {formatCurrency(activeItem.total_desc)}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-4 pt-1.5 border-t border-white/20 text-lime-300">
                <span className="font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-lime-400 inline-block"></span>
                  Coluna 1 (Líquido):
                </span>
                <span className="font-extrabold text-sm text-lime-300">
                  {formatCurrency(activeItem.total_liquido)}
                </span>
              </div>

              {/* Total de Artigos Vendidos */}
              <div className="flex items-baseline justify-between gap-4 pt-1.5 border-t border-white/20 text-sky-300">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-sky-400">inventory_2</span>
                  Total Artigos Vendidos:
                </span>
                <span className="font-bold text-xs text-sky-200">
                  {activeItem.total_quantidade.toLocaleString(locale)} un
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 mt-2 pt-1.5 border-t border-white/15 text-[10px] text-slate-300">
              <span>Documentos: <strong>{activeItem.total_docs}</strong></span>
              <span className="text-slate-400">Faturação Mensal</span>
            </div>

            {activeItem.diffAnterior !== null && (
              <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-white/10 text-[10px]">
                <span className="text-slate-400">vs. Mês Anterior:</span>
                <span
                  className={`font-semibold flex items-center gap-0.5 ${activeItem.diffAnterior > 0
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
        )}
      </div>
    </div>
  );
}
