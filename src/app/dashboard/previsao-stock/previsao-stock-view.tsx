'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Client, UserProfile } from '@/lib/supabase/types';
import { useLanguage } from '@/lib/i18n/context';
import GraficoPrevisaoStock from '../grafico-previsao-stock';
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
      {/* Top Bar com Botão de Retorno ao Dashboard e Título da Página */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side: Botão Voltar ao Dashboard & Título */}
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-lime-100/70 hover:bg-lime-200/80 text-emerald-950 font-extrabold text-xs sm:text-sm border border-lime-500 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
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

        {/* Right Side: Pull-down de seleção de cliente para Administradores e Gestores */}
        {isManagerOrAdmin && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
              <span className="material-symbols-outlined text-secondary text-base">filter_alt</span>
              <span>{t.dashboard.filterByClient}</span>
            </div>
            {selectedClientObj && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/10 border border-secondary/20 text-xs font-semibold text-secondary">
                [{selectedClientObj.sigla}] {selectedClientObj.name}
              </span>
            )}
            <select
              id="forecast-client-select"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="px-3 py-1.5 bg-surface-container-low text-on-surface border border-outline-variant/40 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer shadow-xs min-w-[200px]"
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

      {/* Componente Gráfico Previsão de Stock Completo com Controlos e Tabela Comparativa */}
      <div className="transition-all">
        <GraficoPrevisaoStock
          stockAtual={filteredStockAtual}
          stockPedidos={filteredStockPedidos}
          pedidos={filteredPedidos}
          clientName={selectedClientObj ? `[${selectedClientObj.sigla}] ${selectedClientObj.name}` : null}
          selectedArticleCode={selectedArticleCode}
          onSelectArticleCode={setSelectedArticleCode}
        />
      </div>
    </main>
  );
}
