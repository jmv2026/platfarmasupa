'use client';

import React, { useState, useMemo, useRef } from 'react';
import { DashboardStockItem, DashboardStockPedidoItem, DashboardPedidoItem } from './dashboard-view';

interface GraficoPrevisaoStockProps {
  stockAtual: DashboardStockItem[];
  stockPedidos?: DashboardStockPedidoItem[];
  pedidos: DashboardPedidoItem[];
  clientName?: string | null;
}

type HorizontePrevisao = '3m' | '6m' | '12m';
type TipoVisualizacao = 'combinado' | 'barras' | 'tendencia';

const MESES_NOMES = [
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

const MESES_ABREV = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

interface PontoPrevisao {
  index: number;
  year: number;
  month: number;
  label: string;
  labelCompleto: string;
  mesOffset: number; // 0 = mês atual, 1 = +1m, etc.
  stockProjetado: number;
  consumoMes: number;
  consumoAcumulado: number;
  stockExpiradoMes: number;
  stockExpiradoAcumulado: number;
  autonomiaRestanteMeses: number;
  status: 'seguro' | 'alerta' | 'critico';
}

interface ArtigoPrevisaoRisco {
  codigo: string;
  descricao: string;
  stockAtual: number;
  consumoMedioMensal: number;
  autonomiaMeses: number;
  validadeMaisProxima: string | null;
  statusRuptura: 'critico' | 'atencao' | 'estavel' | 'sem_consumo';
}

function extrairData(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const d = new Date(str.includes('T') ? str : `${str}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

export default function GraficoPrevisaoStock({
  stockAtual,
  stockPedidos,
  pedidos,
  clientName,
}: GraficoPrevisaoStockProps) {
  const [horizonte, setHorizonte] = useState<HorizontePrevisao>('6m');
  const [tipoGrafico, setTipoGrafico] = useState<TipoVisualizacao>('combinado');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cálculo das Projeções e Métricas de Stock Futuro
  const {
    dadosPrevisao,
    estatisticas,
    artigosRisco,
  } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 1. Stock Total Inicial
    let stockTotalInicial = 0;
    if (stockPedidos && stockPedidos.length > 0) {
      stockTotalInicial = stockPedidos.reduce((acc, curr) => acc + Number(curr.stock || 0), 0);
    } else {
      stockTotalInicial = stockAtual.reduce((acc, curr) => acc + Number(curr.stock || 0), 0);
    }

    // Mapa de stock por artigo_id/artigo_codigo
    const stockPorArtigo: Record<string, { stock: number; validadeMaisProxima: string | null }> = {};
    stockAtual.forEach((item) => {
      const artId = item.artigo_id || 'N/A';
      if (!stockPorArtigo[artId]) {
        stockPorArtigo[artId] = { stock: 0, validadeMaisProxima: item.validade || null };
      }
      stockPorArtigo[artId].stock += Number(item.stock || 0);
      if (item.validade) {
        if (
          !stockPorArtigo[artId].validadeMaisProxima ||
          new Date(item.validade) < new Date(stockPorArtigo[artId].validadeMaisProxima!)
        ) {
          stockPorArtigo[artId].validadeMaisProxima = item.validade;
        }
      }
    });

    // 2. Histórico de consumo nos últimos 6 meses para estimar taxa mensal (run-rate)
    const seisMesesAtras = new Date(currentYear, currentMonth - 5, 1);
    let totalConsumoHistorico = 0;
    const mesesComMovimento = new Set<string>();
    const consumoPorArtigo: Record<string, { codigo: string; descricao: string; totalQtd: number }> = {};

    pedidos.forEach((p) => {
      const dataPed = extrairData(p.data_pedido || p.created_at);
      if (dataPed && dataPed >= seisMesesAtras) {
        const keyMes = `${dataPed.getFullYear()}-${dataPed.getMonth()}`;
        mesesComMovimento.add(keyMes);

        if (p.pedido_linhas && p.pedido_linhas.length > 0) {
          p.pedido_linhas.forEach((linha) => {
            const qtd = Number(linha.quantidade) || 0;
            totalConsumoHistorico += qtd;

            const cod = linha.artigo_codigo || linha.artigo_id || 'N/A';
            if (!consumoPorArtigo[cod]) {
              consumoPorArtigo[cod] = {
                codigo: cod,
                descricao: linha.descricao || cod,
                totalQtd: 0,
              };
            }
            consumoPorArtigo[cod].totalQtd += qtd;
          });
        }
      }
    });

    const nrMesesBase = Math.max(mesesComMovimento.size, 1);
    // Consumo médio mensal global
    let consumoMedioMensal = Math.round(totalConsumoHistorico / nrMesesBase);

    // Se o histórico de pedidos for pequeno ou 0, definir um valor proporcional realista para simulação/previsão
    if (consumoMedioMensal <= 0 && stockTotalInicial > 0) {
      consumoMedioMensal = Math.round(stockTotalInicial / 12); // ~8.3% ao mês
    }

    // 3. Determinar número de meses de horizonte
    const numMesesHorizonte = horizonte === '3m' ? 3 : horizonte === '6m' ? 6 : 12;

    // 4. Mapear validades de stock por mês futuro
    const stockExpirandoPorMesOffset: Record<number, number> = {};
    stockAtual.forEach((item) => {
      if (item.validade) {
        const valDate = new Date(item.validade);
        if (!isNaN(valDate.getTime())) {
          const diffAnos = valDate.getFullYear() - currentYear;
          const diffMeses = diffAnos * 12 + (valDate.getMonth() - currentMonth);
          if (diffMeses >= 0 && diffMeses <= numMesesHorizonte) {
            stockExpirandoPorMesOffset[diffMeses] =
              (stockExpirandoPorMesOffset[diffMeses] || 0) + Number(item.stock || 0);
          }
        }
      }
    });

    // 5. Construir a projeção mês a mês a partir do mês atual (offset 0 até numMesesHorizonte)
    let stockCorrente = stockTotalInicial;
    let consumoAcumuladoTotal = 0;
    let stockExpiradoAcumuladoTotal = 0;

    const dadosPrevisao: PontoPrevisao[] = [];

    for (let offset = 0; offset <= numMesesHorizonte; offset++) {
      const d = new Date(currentYear, currentMonth + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth();

      const label =
        offset === 0
          ? `${MESES_ABREV[m]} (Atual)`
          : `${MESES_ABREV[m]} '${String(y).slice(-2)} (+${offset}m)`;
      const labelCompleto =
        offset === 0
          ? `${MESES_NOMES[m]} ${y} (Mês Atual)`
          : `${MESES_NOMES[m]} de ${y} (+${offset} meses)`;

      const expMes = stockExpirandoPorMesOffset[offset] || 0;
      const consMes = offset === 0 ? 0 : consumoMedioMensal;

      if (offset > 0) {
        consumoAcumuladoTotal += consMes;
        stockExpiradoAcumuladoTotal += expMes;
        stockCorrente = Math.max(0, stockCorrente - consMes - expMes);
      }

      const autonomiaRestante =
        consumoMedioMensal > 0
          ? Number((stockCorrente / consumoMedioMensal).toFixed(1))
          : 99;

      let status: 'seguro' | 'alerta' | 'critico' = 'seguro';
      if (stockCorrente <= 0 || autonomiaRestante < 1) {
        status = 'critico';
      } else if (autonomiaRestante < 3) {
        status = 'alerta';
      }

      dadosPrevisao.push({
        index: offset,
        year: y,
        month: m,
        label,
        labelCompleto,
        mesOffset: offset,
        stockProjetado: stockCorrente,
        consumoMes: consMes,
        consumoAcumulado: consumoAcumuladoTotal,
        stockExpiradoMes: expMes,
        stockExpiradoAcumulado: stockExpiradoAcumuladoTotal,
        autonomiaRestanteMeses: autonomiaRestante,
        status,
      });
    }

    // 6. Estatísticas Globais
    const autonomiaMesesGlobal =
      consumoMedioMensal > 0
        ? Number((stockTotalInicial / consumoMedioMensal).toFixed(1))
        : 99;
    const autonomiaDiasGlobal = Math.round(autonomiaMesesGlobal * 30);
    const totalExpirandoNoHorizonte = Object.values(stockExpirandoPorMesOffset).reduce(
      (a, b) => a + b,
      0
    );

    // Mês estimado de esgotamento total (stockout)
    const pontoEsgotamento = dadosPrevisao.find((p) => p.stockProjetado === 0 && p.mesOffset > 0);
    const mesEsgotamentoPrevisto = pontoEsgotamento ? pontoEsgotamento.labelCompleto : null;

    // 7. Lista de Artigos em Risco de Ruptura / Autonomia
    const artigosRiscoList: ArtigoPrevisaoRisco[] = [];
    const todosCodigos = new Set([
      ...Object.keys(stockPorArtigo),
      ...Object.keys(consumoPorArtigo),
    ]);

    todosCodigos.forEach((cod) => {
      const stkInfo = stockPorArtigo[cod] || { stock: 0, validadeMaisProxima: null };
      const consInfo = consumoPorArtigo[cod] || {
        codigo: cod,
        descricao: cod,
        totalQtd: 0,
      };

      const consMedioArtigo = Math.round(consInfo.totalQtd / nrMesesBase);
      let autMeses = 999;
      let statusRup: 'critico' | 'atencao' | 'estavel' | 'sem_consumo' = 'estavel';

      if (consMedioArtigo > 0) {
        autMeses = Number((stkInfo.stock / consMedioArtigo).toFixed(1));
        if (autMeses <= 1) statusRup = 'critico';
        else if (autMeses <= 3) statusRup = 'atencao';
        else statusRup = 'estavel';
      } else {
        statusRup = stkInfo.stock > 0 ? 'sem_consumo' : 'estavel';
      }

      if (stkInfo.stock > 0 || consMedioArtigo > 0) {
        artigosRiscoList.push({
          codigo: consInfo.codigo || cod,
          descricao: consInfo.descricao || cod,
          stockAtual: stkInfo.stock,
          consumoMedioMensal: consMedioArtigo,
          autonomiaMeses: autMeses,
          validadeMaisProxima: stkInfo.validadeMaisProxima,
          statusRuptura: statusRup,
        });
      }
    });

    // Ordenar artigos por menor autonomia (maior risco primeiro)
    artigosRiscoList.sort((a, b) => a.autonomiaMeses - b.autonomiaMeses);

    return {
      dadosPrevisao,
      estatisticas: {
        stockTotalInicial,
        consumoMedioMensal,
        autonomiaMesesGlobal,
        autonomiaDiasGlobal,
        totalExpirandoNoHorizonte,
        mesEsgotamentoPrevisto,
        nivelSeguranca: Math.round(consumoMedioMensal * 1.5), // 1.5 meses de stock de segurança
      },
      artigosRisco: artigosRiscoList.slice(0, 6),
    };
  }, [stockAtual, stockPedidos, pedidos, horizonte]);

  // Dimensões do SVG do gráfico otimizadas para layout sermail
  const svgWidth = 800;
  const svgHeight = 240;
  const padding = { top: 25, right: 30, bottom: 42, left: 60 };

  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // Escala Y máxima baseada no stock inicial + margem
  const maxYValue = useMemo(() => {
    const maxStock = Math.max(
      ...dadosPrevisao.map((d) => Math.max(d.stockProjetado, d.consumoAcumulado)),
      estatisticas.stockTotalInicial,
      100
    );
    if (maxStock <= 100) return 100;
    if (maxStock <= 500) return Math.ceil(maxStock / 50) * 50;
    if (maxStock <= 2000) return Math.ceil(maxStock / 200) * 200;
    if (maxStock <= 10000) return Math.ceil(maxStock / 1000) * 1000;
    return Math.ceil(maxStock / 5000) * 5000;
  }, [dadosPrevisao, estatisticas.stockTotalInicial]);

  const yTicks = [0, maxYValue * 0.25, maxYValue * 0.5, maxYValue * 0.75, maxYValue];

  // Coordenadas dos pontos de projeção no gráfico
  const points = useMemo(() => {
    const num = dadosPrevisao.length;
    if (num === 0) return [];

    return dadosPrevisao.map((p, index) => {
      const x =
        num === 1
          ? padding.left + chartWidth / 2
          : padding.left + (index / (num - 1)) * chartWidth;
      const yStock =
        padding.top + chartHeight - (p.stockProjetado / maxYValue) * chartHeight;
      const yConsumo =
        padding.top + chartHeight - (p.consumoAcumulado / maxYValue) * chartHeight;

      return {
        x,
        yStock,
        yConsumo,
        data: p,
        index,
      };
    });
  }, [dadosPrevisao, chartWidth, chartHeight, padding, maxYValue]);

  // Caminhos Bézier Spline para o Gráfico de Previsão
  const { lineStockPath, areaStockPath, lineConsumoPath } = useMemo(() => {
    if (points.length === 0) {
      return { lineStockPath: '', areaStockPath: '', lineConsumoPath: '' };
    }
    if (points.length === 1) {
      const p = points[0];
      return {
        lineStockPath: `M ${p.x} ${p.yStock}`,
        areaStockPath: `M ${p.x - 20} ${padding.top + chartHeight} L ${p.x - 20} ${p.yStock} L ${p.x + 20} ${p.yStock} L ${p.x + 20} ${padding.top + chartHeight} Z`,
        lineConsumoPath: `M ${p.x} ${p.yConsumo}`,
      };
    }

    // Linha de Stock
    let dStock = `M ${points[0].x} ${points[0].yStock}`;
    let dConsumo = `M ${points[0].x} ${points[0].yConsumo}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpx = p0.x + (p1.x - p0.x) / 2;

      dStock += ` C ${cpx} ${p0.yStock} ${cpx} ${p1.yStock} ${p1.x} ${p1.yStock}`;
      dConsumo += ` C ${cpx} ${p0.yConsumo} ${cpx} ${p1.yConsumo} ${p1.x} ${p1.yConsumo}`;
    }

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const bottomY = padding.top + chartHeight;
    const area = `${dStock} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;

    return {
      lineStockPath: dStock,
      areaStockPath: area,
      lineConsumoPath: dConsumo,
    };
  }, [points, chartHeight, padding]);

  // Nível de Segurança (Y coordenate)
  const yNivelSeguranca = useMemo(() => {
    return (
      padding.top +
      chartHeight -
      (Math.min(estatisticas.nivelSeguranca, maxYValue) / maxYValue) * chartHeight
    );
  }, [estatisticas.nivelSeguranca, maxYValue, chartHeight, padding]);

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;
  const activeItem = hoveredIndex !== null ? dadosPrevisao[hoveredIndex] : null;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-all">
      {/* Header do Gráfico */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-outline-variant/20">
        <div className="flex items-start gap-3.5">
          {/* Ícone com gradiente Lima & Verde Esmeralda */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-lime-200 via-emerald-100 to-teal-200/80 border border-lime-300/60 flex items-center justify-center text-lime-900 shadow-sm shrink-0">
            <span className="material-symbols-outlined text-2xl text-emerald-800">trending_up</span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold font-headline text-on-surface">
                Previsão de Stock
              </h2>
              {clientName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/70 text-emerald-900 border border-emerald-200">
                  {clientName}
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/80 mt-0.5">
              Projeção de consumo, curva de autonomia e estimativa de esgotamento de existências
            </p>
          </div>
        </div>

        {/* Controlos e Filtros */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Tipo de Gráfico */}
          <div className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
            <button
              type="button"
              onClick={() => setTipoGrafico('combinado')}
              title="Visão Mista (Curva + Área)"
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                tipoGrafico === 'combinado'
                  ? 'bg-gradient-to-r from-lime-300 to-emerald-300 text-emerald-950 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">area_chart</span>
              <span className="hidden sm:inline">Misto</span>
            </button>
            <button
              type="button"
              onClick={() => setTipoGrafico('tendencia')}
              title="Linhas de Tendência & Buffer"
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                tipoGrafico === 'tendencia'
                  ? 'bg-gradient-to-r from-lime-300 to-emerald-300 text-emerald-950 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">show_chart</span>
              <span className="hidden sm:inline">Tendência</span>
            </button>
            <button
              type="button"
              onClick={() => setTipoGrafico('barras')}
              title="Colunas Mensais"
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                tipoGrafico === 'barras'
                  ? 'bg-gradient-to-r from-lime-300 to-emerald-300 text-emerald-950 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">bar_chart</span>
              <span className="hidden sm:inline">Barras</span>
            </button>
          </div>

          {/* Seletor de Horizonte de Previsão */}
          <div className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
            {(
              [
                { id: '3m', label: '3 Meses' },
                { id: '6m', label: '6 Meses' },
                { id: '12m', label: '12 Meses' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setHorizonte(opt.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  horizonte === opt.id
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

      {/* Cartões de Métricas de Previsão (Tons Verde Pastel & Lima) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 my-4 items-stretch">
        {/* 1. Stock Atual Disponível */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-lime-50/90 to-emerald-50/50 border border-lime-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-lime-900/80 uppercase tracking-wide leading-snug whitespace-normal">
              Stock Atual
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-200/50 shrink-0 mt-0.5"></span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.stockTotalInicial.toLocaleString('pt-PT')}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">un</span>
            </div>
            <span className="text-[10px] text-emerald-700/90 font-medium leading-tight whitespace-normal">
              Existências ativas
            </span>
          </div>
        </div>

        {/* 2. Consumo Médio Mensal (Run-Rate) */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-lime-100/70 via-emerald-50/60 to-lime-50/80 border border-lime-300/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-lime-950 uppercase tracking-wide flex items-center gap-1 leading-snug whitespace-normal">
              <span className="material-symbols-outlined text-[13px] text-lime-700 shrink-0">speed</span>
              <span>Consumo Médio</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-lime-300 text-lime-950 leading-none shrink-0">
              Run-rate
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.consumoMedioMensal.toLocaleString('pt-PT')}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">un / mês</span>
            </div>
            <span className="text-[10px] text-emerald-800 font-semibold leading-tight whitespace-normal">
              Histórico recente
            </span>
          </div>
        </div>

        {/* 3. Autonomia Global Estimada */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-900/80 uppercase tracking-wide leading-snug whitespace-normal">
              Autonomia Global
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold leading-none shrink-0 ${
                estatisticas.autonomiaMesesGlobal >= 6
                  ? 'bg-emerald-200 text-emerald-950'
                  : estatisticas.autonomiaMesesGlobal >= 3
                  ? 'bg-amber-200 text-amber-950'
                  : 'bg-rose-200 text-rose-950'
              }`}
            >
              {estatisticas.autonomiaMesesGlobal >= 6
                ? 'Estável'
                : estatisticas.autonomiaMesesGlobal >= 3
                ? 'Atenção'
                : 'Crítico'}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.autonomiaMesesGlobal >= 99 ? '>12' : estatisticas.autonomiaMesesGlobal}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">meses</span>
            </div>
            <span className="text-[10px] text-emerald-700/90 font-medium leading-tight whitespace-normal">
              ~{estatisticas.autonomiaDiasGlobal} dias de cobertura
            </span>
          </div>
        </div>

        {/* 4. Validade no Horizonte */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-teal-50/90 to-emerald-50/60 border border-teal-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-teal-900/80 uppercase tracking-wide leading-snug whitespace-normal">
              Lotes a Expirar ({horizonte.toUpperCase()})
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500 ring-4 ring-amber-200/50 shrink-0 mt-0.5"></span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.totalExpirandoNoHorizonte.toLocaleString('pt-PT')}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">un</span>
            </div>
            <span className="text-[10px] text-teal-800 font-medium leading-tight whitespace-normal">
              expiram no período
            </span>
          </div>
        </div>
      </div>

      {/* Legenda Dinâmica e Rótulos */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-on-surface-variant/90 mb-2 px-1">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-emerald-500 to-lime-500 border border-emerald-600/30"></span>
            <span className="font-semibold text-emerald-950">Stock Remanescente Projetado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-teal-600"></span>
            <span className="font-medium text-slate-700">Consumo Acumulado Previsto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0 border-t-2 border-dashed border-amber-500"></span>
            <span className="font-medium text-amber-900">Buffer de Segurança (~1.5 meses)</span>
          </div>
        </div>

        <div className="text-[11px] font-semibold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
          Horizonte Selecionado: <span className="font-bold">{horizonte.toUpperCase()}</span>
        </div>
      </div>

      {/* Área do Gráfico SVG com Suporte a Hover & Tooltips */}
      <div
        ref={containerRef}
        className="relative bg-gradient-to-b from-white via-emerald-50/20 to-lime-50/30 rounded-xl p-2.5 sm:p-3.5 border border-emerald-100/80 shadow-inner overflow-hidden"
      >
        {dadosPrevisao.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto min-w-[550px] max-h-[250px] select-none"
            >
              <defs>
                {/* Gradiente de Área de Previsão */}
                <linearGradient id="areaPrevisaoStock" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                  <stop offset="35%" stopColor="#84cc16" stopOpacity="0.25" />
                  <stop offset="70%" stopColor="#a3e635" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#d9f99d" stopOpacity="0.01" />
                </linearGradient>

                {/* Gradiente da Linha de Stock */}
                <linearGradient id="strokePrevisaoStock" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="40%" stopColor="#10b981" />
                  <stop offset="80%" stopColor="#84cc16" />
                  <stop offset="100%" stopColor="#65a30d" />
                </linearGradient>

                {/* Gradiente das Barras */}
                <linearGradient id="barPrevisaoStock" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#a7f3d0" />
                </linearGradient>
              </defs>

              {/* Linhas de Grelha Horizontais e Valores do Eixo Y */}
              {yTicks.map((val, i) => {
                const yPos = padding.top + chartHeight - (val / maxYValue) * chartHeight;
                return (
                  <g key={`ytick-${i}`} className="transition-all duration-300">
                    <line
                      x1={padding.left}
                      y1={yPos}
                      x2={padding.left + chartWidth}
                      y2={yPos}
                      stroke="#e2e8f0"
                      strokeDasharray={val === 0 ? undefined : '3 3'}
                      strokeWidth={val === 0 ? 1.5 : 1}
                    />
                    <text
                      x={padding.left - 8}
                      y={yPos + 3.5}
                      textAnchor="end"
                      className="text-[10px] fill-slate-400 font-medium"
                    >
                      {val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : val}
                    </text>
                  </g>
                );
              })}

              {/* Linha Tracejada do Nível de Segurança Recomendado */}
              {estatisticas.nivelSeguranca > 0 && yNivelSeguranca >= padding.top && (
                <g>
                  <line
                    x1={padding.left}
                    y1={yNivelSeguranca}
                    x2={padding.left + chartWidth}
                    y2={yNivelSeguranca}
                    stroke="#f59e0b"
                    strokeDasharray="5 4"
                    strokeWidth="1.5"
                  />
                  <text
                    x={padding.left + chartWidth - 6}
                    y={yNivelSeguranca - 4}
                    textAnchor="end"
                    className="text-[9px] font-bold fill-amber-700"
                  >
                    Nível de Segurança ({estatisticas.nivelSeguranca.toLocaleString('pt-PT')} un)
                  </text>
                </g>
              )}

              {/* Modo BARRAS */}
              {tipoGrafico === 'barras' &&
                points.map((p) => {
                  const bWidth = Math.min(Math.max((chartWidth / points.length) * 0.45, 20), 48);
                  const bHeight = padding.top + chartHeight - p.yStock;
                  const isHovered = hoveredIndex === p.index;

                  return (
                    <g key={`bar-${p.index}`}>
                      <rect
                        x={p.x - bWidth / 2}
                        y={p.yStock}
                        width={bWidth}
                        height={Math.max(bHeight, 2)}
                        rx={4}
                        fill="url(#barPrevisaoStock)"
                        stroke={isHovered ? '#059669' : '#10b981'}
                        strokeWidth={isHovered ? 2 : 1}
                        className="transition-all cursor-pointer hover:opacity-95"
                        onMouseEnter={() => setHoveredIndex(p.index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                      {/* Valor no Topo da Barra */}
                      <text
                        x={p.x}
                        y={p.yStock - 5}
                        textAnchor="middle"
                        className="text-[9.5px] font-bold fill-emerald-950 select-none"
                      >
                        {p.data.stockProjetado.toLocaleString('pt-PT')}
                      </text>
                    </g>
                  );
                })}

              {/* Modo COMBINADO / TENDÊNCIA */}
              {tipoGrafico !== 'barras' && (
                <>
                  {/* Área Sombreada */}
                  {tipoGrafico === 'combinado' && areaStockPath && (
                    <path
                      d={areaStockPath}
                      fill="url(#areaPrevisaoStock)"
                      className="transition-all duration-300"
                    />
                  )}

                  {/* Linha de Consumo Acumulado */}
                  {lineConsumoPath && (
                    <path
                      d={lineConsumoPath}
                      fill="none"
                      stroke="#0f766e"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      className="transition-all duration-300"
                    />
                  )}

                  {/* Linha Principal de Stock Projetado */}
                  {lineStockPath && (
                    <path
                      d={lineStockPath}
                      fill="none"
                      stroke="url(#strokePrevisaoStock)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-300 drop-shadow-xs"
                    />
                  )}

                  {/* Pontos de Projeção */}
                  {points.map((p) => {
                    const isHovered = hoveredIndex === p.index;
                    const isZero = p.data.stockProjetado === 0;

                    return (
                      <g key={`pt-${p.index}`} className="cursor-pointer">
                        {/* Círculo do Consumo Acumulado */}
                        <circle
                          cx={p.x}
                          cy={p.yConsumo}
                          r={3}
                          fill="#0f766e"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />

                        {/* Círculo de Pulsação no Hover */}
                        {isHovered && (
                          <circle
                            cx={p.x}
                            cy={p.yStock}
                            r={11}
                            fill="#84cc16"
                            fillOpacity="0.25"
                            className="animate-pulse"
                          />
                        )}

                        {/* Ponto Principal de Stock */}
                        <circle
                          cx={p.x}
                          cy={p.yStock}
                          r={isHovered ? 6 : 4.5}
                          fill={isZero ? '#f43f5e' : isHovered ? '#059669' : '#84cc16'}
                          stroke="#ffffff"
                          strokeWidth={2}
                          className="transition-all duration-150"
                        />

                        {/* Valor acima do Ponto */}
                        <text
                          x={p.x}
                          y={p.yStock - (isHovered ? 10 : 8)}
                          textAnchor="middle"
                          className={`text-[9.5px] font-bold select-none ${
                            isHovered ? 'fill-emerald-950 font-extrabold text-[10.5px]' : 'fill-slate-700'
                          }`}
                        >
                          {p.data.stockProjetado.toLocaleString('pt-PT')}
                        </text>
                      </g>
                    );
                  })}
                </>
              )}

              {/* Rótulos do Eixo X (Meses) e Colunas Transparentes para Hover */}
              {points.map((p) => {
                const isHovered = hoveredIndex === p.index;
                const colWidth = chartWidth / points.length;

                return (
                  <g key={`xaxis-${p.index}`}>
                    {/* Área Retangular Transparente para capturar Hover facilmente */}
                    <rect
                      x={p.x - colWidth / 2}
                      y={padding.top}
                      width={colWidth}
                      height={chartHeight + padding.bottom}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(p.index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />

                    {/* Linha vertical de referência no Hover */}
                    {isHovered && (
                      <line
                        x1={p.x}
                        y1={padding.top}
                        x2={p.x}
                        y2={padding.top + chartHeight}
                        stroke="#10b981"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        className="pointer-events-none"
                      />
                    )}

                    {/* Texto do Mês */}
                    <text
                      x={p.x}
                      y={padding.top + chartHeight + 16}
                      textAnchor="middle"
                      className={`text-[10px] select-none transition-colors ${
                        isHovered
                          ? 'fill-emerald-950 font-bold'
                          : 'fill-slate-600 font-medium'
                      }`}
                    >
                      {p.data.label}
                    </text>

                    {/* Indicador de Offset (+1m, +2m, etc.) */}
                    <text
                      x={p.x}
                      y={padding.top + chartHeight + 28}
                      textAnchor="middle"
                      className="text-[8.5px] fill-slate-400 font-medium select-none"
                    >
                      {p.data.mesOffset === 0 ? 'Base' : `${p.data.autonomiaRestanteMeses}m auto.`}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="py-12 text-center text-on-surface-variant text-xs">
            Sem dados suficientes para calcular projeção de stock.
          </div>
        )}

        {/* Tooltip Flutuante / Detalhado ao Passar o Rato */}
        {activePoint && activeItem && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700/60 backdrop-blur-sm transition-all duration-100 text-xs min-w-[220px]"
            style={{
              left: Math.min(
                Math.max(activePoint.x - 110, 10),
                (containerRef.current?.clientWidth || 700) - 230
              ),
              top: Math.max(10, activePoint.yStock - 110),
            }}
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-700">
              <span className="font-bold text-lime-300">{activeItem.labelCompleto}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  activeItem.status === 'seguro'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : activeItem.status === 'alerta'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {activeItem.status === 'seguro'
                  ? 'Estável'
                  : activeItem.status === 'alerta'
                  ? 'Atenção'
                  : 'Crítico'}
              </span>
            </div>

            <div className="space-y-1 pt-1.5 text-[11px]">
              <div className="flex justify-between items-center text-slate-300">
                <span>Stock Projetado:</span>
                <span className="font-bold text-white">
                  {activeItem.stockProjetado.toLocaleString('pt-PT')} un
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Consumo Previsto no Mês:</span>
                <span className="font-semibold text-teal-300">
                  {activeItem.consumoMes.toLocaleString('pt-PT')} un
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Consumo Acumulado:</span>
                <span className="font-semibold text-slate-200">
                  {activeItem.consumoAcumulado.toLocaleString('pt-PT')} un
                </span>
              </div>
              {activeItem.stockExpiradoMes > 0 && (
                <div className="flex justify-between items-center text-amber-300 font-semibold">
                  <span>Lotes a Expirar no Mês:</span>
                  <span>{activeItem.stockExpiradoMes.toLocaleString('pt-PT')} un</span>
                </div>
              )}
              <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800 text-[10px]">
                <span>Autonomia restante:</span>
                <span className="text-lime-400 font-bold">
                  {activeItem.autonomiaRestanteMeses} meses
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Seção Inferior: Tabela Resumo dos Artigos com Maior Risco de Ruptura / Esgotamento */}
      {artigosRisco.length > 0 && (
        <div className="mt-5 pt-4 border-t border-outline-variant/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 text-lg">warning</span>
              <h3 className="text-xs sm:text-sm font-bold text-on-surface">
                Artigos com Menor Cobertura de Stock (Risco de Ruptura)
              </h3>
            </div>
            <span className="text-[11px] text-on-surface-variant font-medium">
              Top Artigos por Taxa de Esgotamento
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-outline-variant/30">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-semibold border-b border-outline-variant/30 text-[11px]">
                  <th className="py-2 px-3">Código</th>
                  <th className="py-2 px-3">Descrição</th>
                  <th className="py-2 px-3 text-right">Stock Atual</th>
                  <th className="py-2 px-3 text-right">Consumo Médio/Mês</th>
                  <th className="py-2 px-3 text-right">Autonomia Prevista</th>
                  <th className="py-2 px-3 text-center">Estado</th>
                  <th className="py-2 px-3 text-center">Próxima Validade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 bg-white">
                {artigosRisco.map((art) => (
                  <tr key={art.codigo} className="hover:bg-lime-50/40 transition-colors">
                    <td className="py-2 px-3 font-bold text-emerald-950 font-mono text-[11px]">
                      {art.codigo}
                    </td>
                    <td className="py-2 px-3 text-on-surface font-medium max-w-[200px] truncate">
                      {art.descricao}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800">
                      {art.stockAtual.toLocaleString('pt-PT')} un
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {art.consumoMedioMensal > 0
                        ? `${art.consumoMedioMensal.toLocaleString('pt-PT')} un`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-900">
                      {art.autonomiaMeses >= 99
                        ? '>12 meses'
                        : `${art.autonomiaMeses} meses`}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          art.statusRuptura === 'critico'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : art.statusRuptura === 'atencao'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : art.statusRuptura === 'sem_consumo'
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {art.statusRuptura === 'critico'
                          ? 'Crítico (< 1m)'
                          : art.statusRuptura === 'atencao'
                          ? 'Atenção (< 3m)'
                          : art.statusRuptura === 'sem_consumo'
                          ? 'Sem Saídas Recentes'
                          : 'Estável (> 3m)'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center text-slate-600 text-[11px]">
                      {art.validadeMaisProxima
                        ? new Date(art.validadeMaisProxima).toLocaleDateString('pt-PT')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
