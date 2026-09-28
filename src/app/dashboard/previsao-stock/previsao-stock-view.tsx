'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Client, UserProfile } from '@/lib/supabase/types';
import { useLanguage } from '@/lib/i18n/context';
import GraficoPrevisaoStock, {
  PeriodoRunRate,
  HorizontePrevisao,
  TipoVisualizacao,
} from '../grafico-previsao-stock';
import {
  DashboardStockItem,
  DashboardStockPedidoItem,
  DashboardPedidoItem,
} from '../dashboard-view';

interface PrevisaoStockViewProps {
  clients: Client[];
  stockAtual: DashboardStockItem[];
  stockPedidos: DashboardStockPedidoItem[];
  pedidos: DashboardPedidoItem[];
  currentUserProfile: UserProfile | null;
  isManagerOrAdmin: boolean;
}

export default function PrevisaoStockView({
  clients,
  stockAtual,
  stockPedidos,
  pedidos,
  currentUserProfile,
  isManagerOrAdmin,
}: PrevisaoStockViewProps) {
  const searchParams = useSearchParams();
  const initialCodigo = searchParams.get('codigo') || null;
  const initialCliente = searchParams.get('cliente') || 'todos';

  const { t } = useLanguage();
  const [selectedClientId, setSelectedClientId] = useState<string>(initialCliente);
  const [selectedArticleCode, setSelectedArticleCode] = useState<string | null>(initialCodigo);
  const [runRatePeriodo, setRunRatePeriodo] = useState<PeriodoRunRate>('6m');
  const [horizonte, setHorizonte] = useState<HorizontePrevisao>('6m');
  const [tipoGrafico, setTipoGrafico] = useState<TipoVisualizacao>('combinado');

  // Sincroniza se o query param mudar
  useEffect(() => {
    const paramCodigo = searchParams.get('codigo');
    if (paramCodigo) {
      setSelectedArticleCode(paramCodigo);
    }
    const paramCliente = searchParams.get('cliente');
    if (paramCliente) {
      setSelectedClientId(paramCliente);
    }
  }, [searchParams]);

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

  const selectedClientObj = useMemo(() => {
    if (selectedClientId === 'todos') return null;
    return clients.find((c) => c.id === selectedClientId);
  }, [clients, selectedClientId]);

  return (
    <main className="w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Top Bar com Botão de Retorno ao Dashboard, Título da Página e Seletores */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Left Side: Botão Voltar ao Dashboard & Título */}
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-lime-100/70 hover:bg-lime-200/80 text-emerald-950 font-extrabold text-xs sm:text-sm border border-lime-500 shadow-2xs hover:shadow-xs transition-all cursor-pointer group shrink-0"
          >
            <span className="material-symbols-outlined text-base sm:text-lg group-hover:-translate-x-1 transition-transform text-emerald-800">
              arrow_back
            </span>
            <span>{t.dashboard.backToDashboard}</span>
          </Link>

          <div className="h-6 w-px bg-outline-variant/40 hidden sm:block"></div>

          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-700 text-lg sm:text-xl">trending_up</span>
              <h1 className="text-base sm:text-lg font-extrabold font-headline text-on-surface">
                {t.dashboard.stockForecastPageTitle}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-800">
                Preditivo
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-medium mt-0.5">
              {t.dashboard.stockForecastPageSubtitle}
            </p>
          </div>
        </div>

        {/* Right Side: Seletores de Média Consumo, Projeção, Tipo de Gráfico e Cliente */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Seletor de Cliente para Administradores e Gestores */}
          {isManagerOrAdmin && (
            <div className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 shadow-2xs">
              <div className="px-2 py-0.5 text-[11px] font-bold text-on-surface flex items-center gap-1 border-r border-outline-variant/30 mr-1 shrink-0">
                <span className="material-symbols-outlined text-secondary text-sm">filter_alt</span>
                <span className="hidden sm:inline">{t.dashboard.filterByClient}</span>
              </div>
              <select
                id="forecast-client-select"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="px-2.5 py-1 bg-transparent text-on-surface text-xs font-bold focus:outline-none cursor-pointer max-w-[170px] truncate"
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

          {/* Seletor de Média Consumo (Base de Cálculo de Consumos: 3, 6 ou 12 meses) */}
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

      {/* Componente Gráfico Previsão de Stock Completo com Controlos e Tabela Comparativa */}
      <div className="transition-all">
        <GraficoPrevisaoStock
          stockAtual={filteredStockAtual}
          stockPedidos={filteredStockPedidos}
          pedidos={filteredPedidos}
          clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
          selectedArticleCode={selectedArticleCode}
          onSelectArticleCode={setSelectedArticleCode}
          runRatePeriodo={runRatePeriodo}
          onRunRatePeriodoChange={setRunRatePeriodo}
          horizonte={horizonte}
          onHorizonteChange={setHorizonte}
          tipoGrafico={tipoGrafico}
          onTipoGraficoChange={setTipoGrafico}
          hideHeaderControls={true}
        />
      </div>
    </main>
  );
}
