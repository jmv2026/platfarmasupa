'use client';

import React, { useState, useMemo, useRef } from 'react';
import { DashboardStockItem, DashboardStockPedidoItem, DashboardPedidoItem } from './dashboard-view';
import { useLanguage } from '@/lib/i18n/context';

interface GraficoPrevisaoStockProps {
  stockAtual: DashboardStockItem[];
  stockPedidos?: DashboardStockPedidoItem[];
  pedidos: DashboardPedidoItem[];
  clientName?: string | null;
  selectedArticleCode?: string | null;
  onSelectArticleCode?: (codigo: string | null) => void;
}

type PeriodoRunRate = '3m' | '6m' | '12m';
type HorizontePrevisao = '3m' | '6m' | '12m';
type TipoVisualizacao = 'combinado' | 'barras' | 'tendencia';

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

interface ArtigoTopComparativo {
  rank: number;
  codigo: string;
  descricao: string;
  stockAtual: number;
  totalQtd: number;
  consumoMedioMensal: number;
  autonomiaMeses: number;
  validadeMaisProxima: string | null;
  statusRuptura: 'critico' | 'atencao' | 'estavel' | 'sem_consumo';
  isLider: boolean;
  isSelecionado: boolean;
}

interface ArtigoAlvoInfo {
  codigo: string;
  descricao: string;
  stockAtual: number;
  totalQtdPedidos: number;
  nrPedidos: number;
  validadeMaisProxima: string | null;
  consumoMedioMensal: number;
  autonomiaMeses: number;
  percentagemDoTotal: number;
  rank: number | null;
  isLider: boolean;
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
  selectedArticleCode,
  onSelectArticleCode,
}: GraficoPrevisaoStockProps) {
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-PT';

  const [internalSelectedCode, setInternalSelectedCode] = useState<string | null>(null);
  const [runRatePeriodo, setRunRatePeriodo] = useState<PeriodoRunRate>('6m');
  const [horizonte, setHorizonte] = useState<HorizontePrevisao>('6m');
  const [tipoGrafico, setTipoGrafico] = useState<TipoVisualizacao>('combinado');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeCodigoAlvo =
    selectedArticleCode !== undefined && selectedArticleCode !== null
      ? selectedArticleCode
      : internalSelectedCode;

  const handleSelectProduct = (cod: string | null) => {
    setInternalSelectedCode(cod);
    onSelectArticleCode?.(cod);
  };

  // Cálculo das Projeções e Métricas de Stock Futuro focadas no PRODUTO SELECIONADO OU LÍDER
  const {
    dadosPrevisao,
    estatisticas,
    artigosTopComparativo,
    produtoAlvo,
  } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 1. Período de Run-Rate
    let mesesRecuo = 6;
    if (runRatePeriodo === '3m') mesesRecuo = 3;
    else if (runRatePeriodo === '6m') mesesRecuo = 6;
    else if (runRatePeriodo === '12m') mesesRecuo = 12;

    const dataInicioRunRate = new Date(currentYear, currentMonth - (mesesRecuo - 1), 1);
    const nrMesesBase = mesesRecuo;

    // 2. Agrupamento de pedidos por artigo
    const pedidosPorArtigo: Record<
      string,
      { codigo: string; descricao: string; totalQtd: number; totalQtdRunRate: number; pedidosSet: Set<string> }
    > = {};

    let totalGeralPedidosUnidades = 0;

    pedidos.forEach((p) => {
      const dataPed = extrairData(p.data_pedido || p.created_at);
      const isInRunRate = dataPed && dataPed >= dataInicioRunRate;

      if (p.pedido_linhas && p.pedido_linhas.length > 0) {
        p.pedido_linhas.forEach((linha) => {
          const cod = (linha.artigo_codigo || linha.artigo_id || 'N/A').trim();
          const qtd = Number(linha.quantidade) || 0;
          totalGeralPedidosUnidades += qtd;

          if (!pedidosPorArtigo[cod]) {
            pedidosPorArtigo[cod] = {
              codigo: cod,
              descricao: linha.descricao || cod,
              totalQtd: 0,
              totalQtdRunRate: 0,
              pedidosSet: new Set(),
            };
          }
          pedidosPorArtigo[cod].totalQtd += qtd;
          if (isInRunRate) {
            pedidosPorArtigo[cod].totalQtdRunRate += qtd;
          }
          pedidosPorArtigo[cod].pedidosSet.add(p.id);
        });
      }
    });

    // 3. Mapeamento de stock por artigo
    const stockPorArtigo: Record<
      string,
      { stock: number; validadeMaisProxima: string | null; itens: DashboardStockItem[] }
    > = {};

    stockAtual.forEach((item) => {
      const artId = (item.artigo_id || 'N/A').trim();
      if (!stockPorArtigo[artId]) {
        stockPorArtigo[artId] = { stock: 0, validadeMaisProxima: item.validade || null, itens: [] };
      }
      stockPorArtigo[artId].stock += Number(item.stock || 0);
      stockPorArtigo[artId].itens.push(item);
      if (item.validade) {
        if (
          !stockPorArtigo[artId].validadeMaisProxima ||
          new Date(item.validade) < new Date(stockPorArtigo[artId].validadeMaisProxima!)
        ) {
          stockPorArtigo[artId].validadeMaisProxima = item.validade;
        }
      }
    });

    // 4. Determinar o PRODUTO A ANALISAR (selecionado ou líder #1)
    const ordenadosPorPedidos = Object.values(pedidosPorArtigo).sort((a, b) => b.totalQtd - a.totalQtd);
    const liderCodigo = ordenadosPorPedidos.length > 0 ? ordenadosPorPedidos[0].codigo : null;

    let codigoAlvo = activeCodigoAlvo || liderCodigo;

    // Se o artigo selecionado não tiver correspondência exata, tentar case-insensitive
    if (codigoAlvo && !pedidosPorArtigo[codigoAlvo] && !stockPorArtigo[codigoAlvo]) {
      const matchPed = Object.keys(pedidosPorArtigo).find(
        (k) => k.toLowerCase() === codigoAlvo?.toLowerCase()
      );
      const matchStk = Object.keys(stockPorArtigo).find(
        (k) => k.toLowerCase() === codigoAlvo?.toLowerCase()
      );
      if (matchPed) codigoAlvo = matchPed;
      else if (matchStk) codigoAlvo = matchStk;
      else codigoAlvo = liderCodigo;
    }

    // Se não houver pedidos registados, fallback para o artigo com maior stock
    if (!codigoAlvo) {
      const stockOrdenado = Object.entries(stockPorArtigo).sort((a, b) => b[1].stock - a[1].stock);
      if (stockOrdenado.length > 0) {
        codigoAlvo = stockOrdenado[0][0];
      }
    }

    const isLider = Boolean(
      liderCodigo && codigoAlvo && codigoAlvo.toLowerCase() === liderCodigo.toLowerCase()
    );
    const rankIndex = ordenadosPorPedidos.findIndex(
      (p) => p.codigo.toLowerCase() === codigoAlvo?.toLowerCase()
    );
    const rankAlvo = rankIndex !== -1 ? rankIndex + 1 : null;

    // 5. Informações do Produto em Análise
    const infoPedidoAlvo = codigoAlvo ? pedidosPorArtigo[codigoAlvo] : null;
    const infoStockAlvo = codigoAlvo ? stockPorArtigo[codigoAlvo] : null;

    const stockInicialProduto = infoStockAlvo ? infoStockAlvo.stock : 0;
    const totalQtdPedidosAlvo = infoPedidoAlvo ? infoPedidoAlvo.totalQtd : 0;
    const nrPedidosAlvo = infoPedidoAlvo ? infoPedidoAlvo.pedidosSet.size : 0;
    const validadeMaisProximaAlvo = infoStockAlvo ? infoStockAlvo.validadeMaisProxima : null;
    const descricaoAlvo = infoPedidoAlvo?.descricao || codigoAlvo || '';

    // 6. Consumo Médio Mensal (Run-Rate) do Produto em Análise
    const totalQtdRunRateAlvo = infoPedidoAlvo ? infoPedidoAlvo.totalQtdRunRate : 0;
    let consumoMedioMensal = Math.round(totalQtdRunRateAlvo / nrMesesBase);

    // Fallback se histórico for 0 mas houver stock inicial
    if (consumoMedioMensal <= 0 && stockInicialProduto > 0) {
      consumoMedioMensal = Math.round(stockInicialProduto / 12);
    }

    // 7. Determinar número de meses de horizonte
    const numMesesHorizonte = horizonte === '3m' ? 3 : horizonte === '6m' ? 6 : 12;

    // 8. Mapear validades de stock do produto em análise por mês futuro
    const stockExpirandoPorMesOffset: Record<number, number> = {};
    if (infoStockAlvo && infoStockAlvo.itens) {
      infoStockAlvo.itens.forEach((item) => {
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
    }

    // 9. Construir a projeção mês a mês para o PRODUTO EM ANÁLISE
    let stockCorrente = stockInicialProduto;
    let consumoAcumuladoTotal = 0;
    let stockExpiradoAcumuladoTotal = 0;

    const monthsNames = t.dashboard.months;
    const monthsShort = t.dashboard.monthsShort;

    const dadosPrevisao: PontoPrevisao[] = [];

    for (let offset = 0; offset <= numMesesHorizonte; offset++) {
      const d = new Date(currentYear, currentMonth + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth();

      const mShort = monthsShort[m] || String(m + 1);
      const mFull = monthsNames[m] || String(m + 1);

      const label =
        offset === 0
          ? `${mShort} (${t.dashboard.forecastMonthCurrent})`
          : `${mShort} '${String(y).slice(-2)}`;
      const labelCompleto =
        offset === 0
          ? `${mFull} ${y} (${t.dashboard.forecastMonthCurrent})`
          : language === 'pt'
          ? `${mFull} de ${y} (+${offset} ${offset === 1 ? 'mês' : 'meses'})`
          : `${mFull} ${y} (+${offset} ${language === 'en' ? (offset === 1 ? 'month' : 'months') : (offset === 1 ? 'mes' : 'meses')})`;

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

    // 10. Estatísticas do Produto em Análise
    const autonomiaMesesGlobal =
      consumoMedioMensal > 0
        ? Number((stockInicialProduto / consumoMedioMensal).toFixed(1))
        : 99;
    const autonomiaDiasGlobal = Math.round(autonomiaMesesGlobal * 30);
    const totalExpirandoNoHorizonte = Object.values(stockExpirandoPorMesOffset).reduce(
      (a, b) => a + b,
      0
    );

    const pontoEsgotamento = dadosPrevisao.find((p) => p.stockProjetado === 0 && p.mesOffset > 0);
    const mesEsgotamentoPrevisto = pontoEsgotamento ? pontoEsgotamento.labelCompleto : null;

    // 11. Comparativo dos Top Produtos (Top 10)
    const topLista = [...ordenadosPorPedidos.slice(0, 10)];
    if (
      codigoAlvo &&
      !topLista.some((p) => p.codigo.toLowerCase() === codigoAlvo!.toLowerCase())
    ) {
      const extraArt = pedidosPorArtigo[codigoAlvo];
      if (extraArt) {
        topLista.push(extraArt);
      }
    }

    const artigosTopComparativo: ArtigoTopComparativo[] = topLista.map((art, idx) => {
      const stkInfo = stockPorArtigo[art.codigo] || { stock: 0, validadeMaisProxima: null };
      const consMedio = Math.round(art.totalQtdRunRate / nrMesesBase);
      let aut = 999;
      let statusRup: 'critico' | 'atencao' | 'estavel' | 'sem_consumo' = 'estavel';

      if (consMedio > 0) {
        aut = Number((stkInfo.stock / consMedio).toFixed(1));
        if (aut <= 1) statusRup = 'critico';
        else if (aut <= 3) statusRup = 'atencao';
        else statusRup = 'estavel';
      } else {
        statusRup = stkInfo.stock > 0 ? 'sem_consumo' : 'estavel';
      }

      const rankOrig = ordenadosPorPedidos.findIndex((p) => p.codigo === art.codigo) + 1;

      return {
        rank: rankOrig > 0 ? rankOrig : idx + 1,
        codigo: art.codigo,
        descricao: art.descricao,
        stockAtual: stkInfo.stock,
        totalQtd: art.totalQtd,
        consumoMedioMensal: consMedio,
        autonomiaMeses: aut,
        validadeMaisProxima: stkInfo.validadeMaisProxima,
        statusRuptura: statusRup,
        isLider: liderCodigo ? art.codigo.toLowerCase() === liderCodigo.toLowerCase() : idx === 0,
        isSelecionado: Boolean(
          codigoAlvo && art.codigo.toLowerCase() === codigoAlvo.toLowerCase()
        ),
      };
    });

    const produtoAlvoObj: ArtigoAlvoInfo | null = codigoAlvo
      ? {
          codigo: codigoAlvo,
          descricao: descricaoAlvo,
          stockAtual: stockInicialProduto,
          totalQtdPedidos: totalQtdPedidosAlvo,
          nrPedidos: nrPedidosAlvo,
          validadeMaisProxima: validadeMaisProximaAlvo,
          consumoMedioMensal,
          autonomiaMeses: autonomiaMesesGlobal,
          percentagemDoTotal:
            totalGeralPedidosUnidades > 0
              ? Math.round((totalQtdPedidosAlvo / totalGeralPedidosUnidades) * 100)
              : 0,
          rank: rankAlvo,
          isLider,
        }
      : null;

    return {
      dadosPrevisao,
      estatisticas: {
        stockTotalInicial: stockInicialProduto,
        consumoMedioMensal,
        autonomiaMesesGlobal,
        autonomiaDiasGlobal,
        totalExpirandoNoHorizonte,
        mesEsgotamentoPrevisto,
        nivelSeguranca: Math.round(consumoMedioMensal * 1.5),
      },
      artigosTopComparativo,
      produtoAlvo: produtoAlvoObj,
    };
  }, [stockAtual, stockPedidos, pedidos, horizonte, runRatePeriodo, activeCodigoAlvo, t.dashboard.months, t.dashboard.monthsShort, t.dashboard.forecastMonthCurrent, language]);

  // Dimensões do SVG do gráfico dinâmicas para crescer até à margem direita
  const svgWidth = useMemo(() => {
    if (horizonte === '12m') return 1100;
    if (horizonte === '6m') return 880;
    return 760;
  }, [horizonte]);

  const svgHeight = 240;
  const padding = { top: 25, right: 20, bottom: 42, left: 52 };

  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // Escala Y máxima baseada no stock inicial do produto líder + margem
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

  // Nível de Segurança (Y coordinate)
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
                {t.dashboard.chartForecastTitle} {produtoAlvo ? `• ${produtoAlvo.codigo}` : ''}
              </h2>
              {clientName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100/70 text-emerald-900 border border-emerald-200">
                  {clientName}
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/80 mt-0.5">
              {t.dashboard.forecastSubtitle}
            </p>
          </div>
        </div>

        {/* Controlos e Filtros */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Seletor de Run-Rate (Base de Cálculo de Consumos: 3, 6 ou 12 meses) */}
          <div className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 shadow-2xs">
            <div className="px-2 py-0.5 text-[11px] font-bold text-emerald-950 flex items-center gap-1 border-r border-outline-variant/30 mr-1 shrink-0">
              <span className="material-symbols-outlined text-sm text-lime-700">speed</span>
              <span className="hidden sm:inline">{t.dashboard.forecastRunRateLabel}</span>
            </div>
            {(
              [
                { id: '3m', label: t.dashboard.forecastRunRate3m },
                { id: '6m', label: t.dashboard.forecastRunRate6m },
                { id: '12m', label: t.dashboard.forecastRunRate12m },
              ] as const
            ).map((opt) => (
              <button
                key={`rr-${opt.id}`}
                type="button"
                onClick={() => setRunRatePeriodo(opt.id)}
                className={`px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  runRatePeriodo === opt.id
                    ? 'bg-gradient-to-r from-lime-300 to-emerald-300 text-emerald-950 shadow-xs border border-lime-400 font-bold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Seletor de Horizonte de Previsão */}
          <div className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 shadow-2xs">
            <div className="px-2 py-0.5 text-[11px] font-bold text-emerald-950 flex items-center gap-1 border-r border-outline-variant/30 mr-1 shrink-0">
              <span className="material-symbols-outlined text-sm text-teal-700">timeline</span>
              <span className="hidden sm:inline">{t.dashboard.forecastProjectionLabel}</span>
            </div>
            {(
              [
                { id: '3m', label: '3M' },
                { id: '6m', label: '6M' },
                { id: '12m', label: '12M' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setHorizonte(opt.id)}
                className={`px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  horizonte === opt.id
                    ? 'bg-white text-emerald-900 shadow-xs border border-emerald-200/60 font-bold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Seletor de Tipo de Gráfico */}
          <div className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 shadow-2xs">
            <button
              type="button"
              onClick={() => setTipoGrafico('combinado')}
              title={t.dashboard.viewMixed}
              className={`px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                tipoGrafico === 'combinado'
                  ? 'bg-gradient-to-r from-lime-300 to-emerald-300 text-emerald-950 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
              }`}
            >
              <span className="material-symbols-outlined text-sm">area_chart</span>
              <span className="hidden md:inline">{t.dashboard.viewMixed}</span>
            </button>
            <button
              type="button"
              onClick={() => setTipoGrafico('tendencia')}
              title={t.dashboard.viewTrend}
              className={`px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                tipoGrafico === 'tendencia'
                  ? 'bg-gradient-to-r from-lime-300 to-emerald-300 text-emerald-950 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
              }`}
            >
              <span className="material-symbols-outlined text-sm">show_chart</span>
              <span className="hidden md:inline">{t.dashboard.viewTrend}</span>
            </button>
            <button
              type="button"
              onClick={() => setTipoGrafico('barras')}
              title={t.dashboard.viewBars}
              className={`px-2 sm:px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                tipoGrafico === 'barras'
                  ? 'bg-gradient-to-r from-lime-300 to-emerald-300 text-emerald-950 shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/50'
              }`}
            >
              <span className="material-symbols-outlined text-sm">bar_chart</span>
              <span className="hidden md:inline">{t.dashboard.viewBars}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cartão de Destaque do Produto em Análise */}
      {produtoAlvo && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:px-4 sm:py-3 rounded-xl border shadow-2xs my-4 transition-all ${
            produtoAlvo.isLider
              ? 'bg-gradient-to-r from-lime-100/90 via-emerald-50/80 to-teal-50/90 border-lime-300/80'
              : 'bg-gradient-to-r from-emerald-100/80 via-teal-50/70 to-lime-50/80 border-emerald-300/80'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-lg font-black flex items-center justify-center text-sm shadow-xs shrink-0 ${
                produtoAlvo.isLider
                  ? 'bg-lime-400 text-slate-950 ring-2 ring-lime-500/50'
                  : 'bg-emerald-600 text-white ring-2 ring-emerald-400/50'
              }`}
            >
              {produtoAlvo.rank ? `#${produtoAlvo.rank}` : '•'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-sm text-emerald-950">{produtoAlvo.codigo}</span>
                <span className="text-xs text-on-surface font-medium truncate max-w-[260px] sm:max-w-md">
                  {produtoAlvo.descricao}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-emerald-900 mt-0.5 flex-wrap">
                <span>
                  {t.dashboard.forecastCurrentStock}: <strong className="text-emerald-950">{produtoAlvo.stockAtual.toLocaleString(locale)} {t.dashboard.top10UnitsLabel}</strong>
                </span>
                <span>•</span>
                <span>
                  {t.dashboard.forecastTotalOrdered}: <strong className="text-emerald-950">{produtoAlvo.totalQtdPedidos.toLocaleString(locale)} {t.dashboard.top10UnitsLabel}</strong> ({produtoAlvo.nrPedidos} {produtoAlvo.nrPedidos === 1 ? t.dashboard.top10OrdersSingle : t.dashboard.top10OrdersPlural})
                </span>
                {produtoAlvo.validadeMaisProxima && (
                  <>
                    <span>•</span>
                    <span>
                      {t.dashboard.forecastNextExpiry}: <strong className="text-emerald-950">{new Date(produtoAlvo.validadeMaisProxima).toLocaleDateString(locale)}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {produtoAlvo.isLider ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-200/90 text-emerald-950 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                <span className="material-symbols-outlined text-[13px] text-emerald-800">emoji_events</span>
                <span>{t.dashboard.forecastBannerLeader.replace('{percent}', String(produtoAlvo.percentagemDoTotal))}</span>
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300/80 flex items-center gap-1 shadow-2xs">
                  <span className="material-symbols-outlined text-[13px] text-emerald-700">insights</span>
                  <span>{t.dashboard.forecastBannerSelected.replace('{rank}', String(produtoAlvo.rank || '•'))}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectProduct(null)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-lime-300 hover:bg-lime-400 text-slate-950 border border-lime-500 shadow-2xs flex items-center gap-1 cursor-pointer transition-all"
                  title={t.dashboard.forecastResetLeader}
                >
                  <span className="material-symbols-outlined text-xs">restart_alt</span>
                  <span>{t.dashboard.forecastResetLeader}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cartões de Métricas de Previsão do Produto em Análise */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 my-4 items-stretch">
        {/* 1. Consumo Médio Mensal (Run-Rate) */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-lime-100/70 via-emerald-50/60 to-lime-50/80 border border-lime-300/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-lime-950 uppercase tracking-wide flex items-center gap-1 leading-snug whitespace-normal">
              <span className="material-symbols-outlined text-[13px] text-lime-700 shrink-0">speed</span>
              <span>{t.dashboard.forecastAvgConsumption}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-lime-300 text-lime-950 leading-none shrink-0">
              {t.dashboard.forecastRunRateLabel} {runRatePeriodo.toUpperCase()}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.consumoMedioMensal.toLocaleString(locale)}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">
                {t.dashboard.top10UnitsLabel} / {language === 'en' ? 'mo' : language === 'es' ? 'mes' : 'mês'}
              </span>
            </div>
            <span className="text-[10px] text-emerald-800 font-semibold leading-tight whitespace-normal">
              {t.dashboard.forecastAvgConsumptionSub.replace(
                '{months}',
                runRatePeriodo === '3m'
                  ? language === 'en'
                    ? '3 months'
                    : '3 meses'
                  : runRatePeriodo === '6m'
                  ? language === 'en'
                    ? '6 months'
                    : '6 meses'
                  : language === 'en'
                  ? '12 months'
                  : '12 meses'
              )}
            </span>
          </div>
        </div>

        {/* 2. Autonomia Estimada */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-900/80 uppercase tracking-wide leading-snug whitespace-normal">
              {t.dashboard.forecastRunway}
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
                ? (language === 'en' ? 'Stable' : language === 'es' ? 'Estable' : 'Estável')
                : estatisticas.autonomiaMesesGlobal >= 3
                ? (language === 'en' ? 'Warning' : language === 'es' ? 'Atención' : 'Atenção')
                : (language === 'en' ? 'Critical' : language === 'es' ? 'Crítico' : 'Crítico')}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.autonomiaMesesGlobal >= 99 ? '>12' : estatisticas.autonomiaMesesGlobal}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">
                {language === 'en' ? 'months' : 'meses'}
              </span>
            </div>
            <span className="text-[10px] text-emerald-700 font-medium leading-tight whitespace-normal">
              {t.dashboard.forecastRunwayDays.replace('{days}', String(estatisticas.autonomiaDiasGlobal))}
            </span>
          </div>
        </div>

        {/* 3. Lotes a Expirar no Horizonte */}
        <div className="min-h-[75px] p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-gradient-to-br from-teal-50/90 to-emerald-50/60 border border-teal-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-bold text-teal-900/80 uppercase tracking-wide leading-snug whitespace-normal">
              {t.dashboard.forecastExpiringBatches}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-200 text-teal-950 leading-none shrink-0">
              {language === 'en' ? 'Next' : language === 'es' ? 'Próx.' : 'Próx.'} {horizonte.toUpperCase()}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-1 flex-wrap pt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-emerald-950 leading-none">
                {estatisticas.totalExpirandoNoHorizonte.toLocaleString(locale)}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-emerald-800">{t.dashboard.top10UnitsLabel}</span>
            </div>
            <span className="text-[10px] text-teal-800 font-medium leading-tight whitespace-normal">
              {estatisticas.mesEsgotamentoPrevisto
                ? t.dashboard.forecastStockoutExpected.replace('{month}', estatisticas.mesEsgotamentoPrevisto)
                : t.dashboard.forecastSufficientStock}
            </span>
          </div>
        </div>
      </div>

      {/* Área do Gráfico SVG de Previsão de Stock com Suporte a Hover & Tooltip */}
      <div
        ref={containerRef}
        className="relative bg-gradient-to-b from-white via-emerald-50/20 to-lime-50/30 rounded-xl p-2.5 sm:p-3.5 border border-emerald-100/80 shadow-inner overflow-hidden"
      >
        {/* Legenda Dinâmica no Topo Direito */}
        <div className="absolute top-2.5 right-3.5 z-10 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-xs border border-lime-300/80 shadow-2xs text-[10px] sm:text-[11px] font-bold text-emerald-950">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-lime-500 inline-block"></span>
            <span>{t.dashboard.forecastLegendProjected}</span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-600 inline-block"></span>
            <span>{t.dashboard.forecastLegendConsumption}</span>
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-rose-500 inline-block border-t border-dashed border-rose-500"></span>
            <span>{t.dashboard.forecastLegendBuffer}</span>
          </span>
        </div>

        {dadosPrevisao.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto min-w-[550px] max-h-[250px] select-none"
            >
              <defs>
                <linearGradient id="areaStockPrevisao" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#84cc16" stopOpacity="0.45" />
                  <stop offset="40%" stopColor="#a3e635" stopOpacity="0.25" />
                  <stop offset="75%" stopColor="#6ee7b7" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.01" />
                </linearGradient>

                <linearGradient id="strokeStockPrevisao" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#65a30d" />
                  <stop offset="50%" stopColor="#84cc16" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>

                <linearGradient id="strokeConsumoPrevisao" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0d9488" />
                  <stop offset="100%" stopColor="#0f766e" />
                </linearGradient>

                <linearGradient id="barStockPrevisao" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#bef264" />
                  <stop offset="50%" stopColor="#86efac" />
                  <stop offset="100%" stopColor="#6ee7b7" />
                </linearGradient>

                <linearGradient id="barStockPrevisaoHover" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d9f99d" />
                  <stop offset="100%" stopColor="#a3e635" />
                </linearGradient>

                <filter id="glowPrevisao" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Linhas de Grelha Horizontal e Ticks Y */}
              {yTicks.map((val, idx) => {
                const y = padding.top + chartHeight - (val / maxYValue) * chartHeight;
                return (
                  <g key={`ytick-prev-${idx}`}>
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
                      fontSize="9.5"
                      fontWeight="600"
                      fill="#64748b"
                    >
                      {val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : val.toLocaleString(locale)}
                    </text>
                  </g>
                );
              })}

              {/* Linha de Nível de Segurança */}
              <line
                x1={padding.left}
                y1={yNivelSeguranca}
                x2={svgWidth - padding.right}
                y2={yNivelSeguranca}
                stroke="#f43f5e"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                className="opacity-70"
              />
              <text
                x={svgWidth - padding.right}
                y={yNivelSeguranca - 4}
                textAnchor="end"
                fontSize="9"
                fontWeight="700"
                fill="#e11d48"
              >
                {t.dashboard.forecastLegendBuffer} ({estatisticas.nivelSeguranca.toLocaleString(locale)} {t.dashboard.top10UnitsLabel})
              </text>

              {/* Barras Verticais de Stock Residual Mensal */}
              {(tipoGrafico === 'barras' || tipoGrafico === 'combinado') &&
                points.map((p, i) => {
                  const isHovered = hoveredIndex === i;
                  const barWidth = Math.min(chartWidth / (points.length * 2.8), 28);
                  const bHeight = ((p.data.stockProjetado / maxYValue) * chartHeight) || 0;
                  const bY = padding.top + chartHeight - bHeight;

                  return (
                    <g key={`bar-group-prev-${i}`}>
                      <rect
                        x={p.x - barWidth / 2}
                        y={padding.top}
                        width={barWidth}
                        height={chartHeight}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />

                      {bHeight > 0 && (
                        <rect
                          x={p.x - barWidth / 2}
                          y={bY}
                          width={barWidth}
                          height={bHeight}
                          rx={Math.min(barWidth / 2, 6)}
                          ry={Math.min(barWidth / 2, 6)}
                          fill={isHovered ? 'url(#barStockPrevisaoHover)' : 'url(#barStockPrevisao)'}
                          stroke={isHovered ? '#15803d' : '#86efac'}
                          strokeWidth={isHovered ? '2' : '1'}
                          opacity={tipoGrafico === 'combinado' ? 0.65 : 0.95}
                          className="transition-all duration-200 cursor-pointer hover:opacity-100"
                          onMouseEnter={() => setHoveredIndex(i)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        />
                      )}

                      {/* Rótulo de Valor de Stock no Topo da Barra */}
                      {(isHovered || tipoGrafico === 'barras') && p.data.stockProjetado > 0 && (
                        <text
                          x={p.x}
                          y={bY - 5}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="700"
                          fill={isHovered ? '#14532d' : '#334155'}
                        >
                          {p.data.stockProjetado >= 1000
                            ? `${(p.data.stockProjetado / 1000).toFixed(1)}k`
                            : p.data.stockProjetado.toLocaleString(locale)}
                        </text>
                      )}
                    </g>
                  );
                })}

              {/* Área e Linha Contínua de Projeção de Stock */}
              {(tipoGrafico === 'combinado' || tipoGrafico === 'tendencia') && (
                <>
                  <path
                    d={areaStockPath}
                    fill="url(#areaStockPrevisao)"
                    className="transition-all duration-300 pointer-events-none"
                  />
                  <path
                    d={lineStockPath}
                    fill="none"
                    stroke="url(#strokeStockPrevisao)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glowPrevisao)"
                    className="transition-all duration-300 pointer-events-none"
                  />

                  {/* Curva de Consumo Acumulado */}
                  <path
                    d={lineConsumoPath}
                    fill="none"
                    stroke="url(#strokeConsumoPrevisao)"
                    strokeWidth="2.5"
                    strokeDasharray="5 3"
                    strokeLinecap="round"
                    className="transition-all duration-300 pointer-events-none opacity-80"
                  />

                  {/* Pontos de Stock */}
                  {points.map((p, i) => {
                    const isHovered = hoveredIndex === i;
                    const isFirst = i === 0;
                    const isCritical = p.data.status === 'critico';

                    return (
                      <g key={`point-prev-${i}`}>
                        <circle
                          cx={p.x}
                          cy={p.yStock}
                          r={isHovered ? 7 : isFirst ? 5.5 : 4}
                          fill={
                            isHovered
                              ? '#bef264'
                              : isCritical
                              ? '#f43f5e'
                              : isFirst
                              ? '#a3e635'
                              : '#d9f99d'
                          }
                          stroke={
                            isHovered
                              ? '#14532d'
                              : isCritical
                              ? '#9f1239'
                              : isFirst
                              ? '#4d7c0f'
                              : '#059669'
                          }
                          strokeWidth={isHovered ? '3' : '2'}
                          className="transition-all duration-150 cursor-pointer"
                          onMouseEnter={() => setHoveredIndex(i)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        />

                        {isHovered && (
                          <circle
                            cx={p.x}
                            cy={p.yStock}
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

              {/* Rótulos do Eixo X (Meses da Projeção) */}
              {points.map((p, i) => {
                const isHovered = hoveredIndex === i;
                const isFirst = i === 0;

                return (
                  <g
                    key={`xlabel-prev-${i}`}
                    className="cursor-pointer transition-colors duration-150"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <text
                      x={p.x}
                      y={padding.top + chartHeight + 16}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight={isHovered ? '800' : isFirst ? '700' : '600'}
                      fill={isHovered ? '#15803d' : isFirst ? '#166534' : '#475569'}
                    >
                      {p.data.label}
                    </text>

                    {/* Offset Mês (+1m, +2m...) */}
                    {p.data.mesOffset > 0 && (
                      <text
                        x={p.x}
                        y={padding.top + chartHeight + 28}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="600"
                        fill={isHovered ? '#166534' : '#94a3b8'}
                      >
                        +{p.data.mesOffset}m
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="py-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">
              analytics
            </span>
            <p className="text-sm font-medium">
              {t.dashboard.noOrdersData}
            </p>
          </div>
        )}

        {/* Tooltip Detalhado Flutuante */}
        {activeItem && activePoint && (() => {
          const xPct = (activePoint.x / svgWidth) * 100;
          const yPct = (activePoint.yStock / svgHeight) * 100;
          const isUpperHalf = yPct < 45;

          let transformX = '-50%';
          if (xPct < 25) {
            transformX = '0%';
          } else if (xPct > 75) {
            transformX = '-100%';
          }

          const leftPos = Math.min(Math.max(xPct, 3), 97);
          const topPos = isUpperHalf ? Math.min(yPct + 8, 50) : Math.max(yPct - 6, 12);
          const transformY = isUpperHalf ? '0%' : '-100%';

          return (
            <div
              className="absolute z-20 pointer-events-none bg-slate-900/95 text-white backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-2xl border border-lime-300/40 text-xs transition-all duration-75 max-w-[280px] min-w-[220px]"
              style={{
                left: `${leftPos}%`,
                top: `${topPos}%`,
                transform: `translate(${transformX}, ${transformY})`,
              }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1 mb-1.5">
                <span className="font-bold text-lime-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">calendar_month</span>
                  <span>{activeItem.labelCompleto}</span>
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    activeItem.status === 'critico'
                      ? 'bg-rose-500 text-white'
                      : activeItem.status === 'alerta'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-lime-400 text-slate-950'
                  }`}
                >
                  {activeItem.status === 'critico'
                    ? (language === 'en' ? 'Stockout' : language === 'es' ? 'Agotamiento' : 'Ruptura')
                    : activeItem.status === 'alerta'
                    ? t.dashboard.forecastTooltipBufferLow
                    : (language === 'en' ? 'Stable' : language === 'es' ? 'Estable' : 'Estável')}
                </span>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-slate-300">{t.dashboard.forecastLegendProjected}:</span>
                  <span className="font-bold text-sm text-lime-300">
                    {activeItem.stockProjetado.toLocaleString(locale)}{' '}
                    <span className="text-[10px] font-normal text-slate-300">{t.dashboard.top10UnitsLabel}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-300">{t.dashboard.forecastLegendConsumption}:</span>
                  <span className="font-semibold text-teal-300">
                    {activeItem.consumoAcumulado.toLocaleString(locale)} {t.dashboard.top10UnitsLabel}
                  </span>
                </div>

                {activeItem.stockExpiradoMes > 0 && (
                  <div className="flex items-center justify-between gap-4 text-rose-300 font-semibold">
                    <span>{t.dashboard.forecastExpiringBatches}:</span>
                    <span>{activeItem.stockExpiradoMes.toLocaleString(locale)} {t.dashboard.top10UnitsLabel}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-1">
                  <span className="text-slate-400">{t.dashboard.forecastTableColRunway}:</span>
                  <span className="font-semibold text-emerald-300">
                    {activeItem.autonomiaRestanteMeses >= 99
                      ? `>12 ${language === 'en' ? 'months' : 'meses'}`
                      : `${activeItem.autonomiaRestanteMeses} ${language === 'en' ? 'months' : 'meses'}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Seção Inferior: Tabela Comparativa dos Top Produtos & Autonomia */}
      {artigosTopComparativo.length > 0 && (
        <div className="mt-5 pt-4 border-t border-outline-variant/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-700 text-lg">leaderboard</span>
              <h3 className="text-xs sm:text-sm font-bold text-on-surface">
                {t.dashboard.forecastTableTitle}
              </h3>
            </div>
            <span className="text-[11px] text-on-surface-variant font-medium">
              {t.dashboard.forecastTableSubtitle}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-outline-variant/30">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-semibold border-b border-outline-variant/30 text-[11px]">
                  <th className="py-2 px-3">{t.dashboard.forecastTableColRank}</th>
                  <th className="py-2 px-3">{t.dashboard.forecastTableColCode}</th>
                  <th className="py-2 px-3">{t.dashboard.forecastTableColDesc}</th>
                  <th className="py-2 px-3 text-right">{t.dashboard.forecastTableColStock}</th>
                  <th className="py-2 px-3 text-right">{t.dashboard.forecastTableColTotalOrdered}</th>
                  <th className="py-2 px-3 text-right">{t.dashboard.forecastTableColAvgCons} ({runRatePeriodo.toUpperCase()})</th>
                  <th className="py-2 px-3 text-right">{t.dashboard.forecastTableColRunway}</th>
                  <th className="py-2 px-3 text-center">{t.dashboard.forecastTableColStatus}</th>
                  <th className="py-2 px-3 text-center">{t.dashboard.forecastTableColExpiry}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 bg-white">
                {artigosTopComparativo.map((art) => (
                  <tr
                    key={art.codigo}
                    className={`transition-colors cursor-pointer ${
                      art.isSelecionado
                        ? 'bg-lime-100/90 hover:bg-lime-200/80 font-semibold ring-1 ring-lime-400'
                        : art.isLider
                        ? 'bg-lime-50/60 hover:bg-lime-100/50'
                        : 'hover:bg-lime-50/30'
                    }`}
                    onClick={() => handleSelectProduct(art.codigo)}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        {art.isLider ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-lime-400 text-slate-950 border border-lime-500 shadow-2xs">
                            {t.dashboard.top10LeaderBadge}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-bold text-[11px]">
                            #{art.rank}
                          </span>
                        )}
                        {art.isSelecionado && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-700 text-white shadow-2xs">
                            {t.dashboard.forecastActionAnalyzing}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProduct(art.codigo);
                        }}
                        className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1.5 transition-all text-left cursor-pointer shadow-2xs ${
                          art.isSelecionado
                            ? 'bg-lime-400 text-slate-950 border border-lime-600 font-black'
                            : 'bg-lime-100/80 hover:bg-lime-300 text-emerald-950 hover:text-slate-950 border border-lime-300/80'
                        }`}
                        title={`${t.dashboard.top10TooltipClick} - ${art.codigo}`}
                      >
                        <span className="material-symbols-outlined text-xs text-lime-800">
                          {art.isSelecionado ? 'check_circle' : 'trending_up'}
                        </span>
                        <span>{art.codigo}</span>
                      </button>
                    </td>
                    <td className="py-2 px-3 text-on-surface font-medium max-w-[240px] truncate">
                      {art.descricao}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800">
                      {art.stockAtual.toLocaleString(locale)} {t.dashboard.top10UnitsLabel}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700 font-medium">
                      {art.totalQtd.toLocaleString(locale)} {t.dashboard.top10UnitsLabel}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {art.consumoMedioMensal > 0
                        ? `${art.consumoMedioMensal.toLocaleString(locale)} ${t.dashboard.top10UnitsLabel}`
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-900">
                      {art.autonomiaMeses >= 99
                        ? `>12 ${language === 'en' ? 'months' : 'meses'}`
                        : `${art.autonomiaMeses} ${language === 'en' ? 'months' : 'meses'}`}
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
                          ? t.dashboard.forecastStatusCritical
                          : art.statusRuptura === 'atencao'
                          ? t.dashboard.forecastStatusWarning
                          : art.statusRuptura === 'sem_consumo'
                          ? t.dashboard.forecastStatusNoOutflow
                          : t.dashboard.forecastStatusStable}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center text-slate-600 text-[11px]">
                      {art.validadeMaisProxima
                        ? new Date(art.validadeMaisProxima).toLocaleDateString(locale)
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
