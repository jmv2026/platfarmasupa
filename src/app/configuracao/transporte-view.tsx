'use client';

import { useState } from 'react';

interface TrackingData {
  id: string;
  ref_ser: string;
  ref_comprovativo?: string | null;
  data_estado: string | null;
  hora_estado: string | null;
  ref_trans: string | null;
  cod_estado: number | null;
  cod_incide: number | null;
  data_reg_incide: string | null;
  hora_reg_incide: string | null;
  desc_estado_expedicao: string | null;
  obs_expedicao: string | null;
  created_at: string;
}

export default function TransporteView({ data }: { data: TrackingData[] }) {
  const [search, setSearch] = useState('');

  // DEBUG
  if (typeof window !== 'undefined') {
    console.log('TransporteView rendered with data length:', data?.length);
    if (search) {
      console.log('Searching for:', search, 'Found:', data?.filter(item => String(item.ref_ser).toLowerCase().includes(search.toLowerCase().trim())).length);
    }
  }

  // Como os dados vêm ordenados de forma descendente, o primeiro registo de cada ref_ser é o mais recente
  const uniqueData: TrackingData[] = [];
  const seenRefs = new Set<string>();

  for (const item of data) {
    if (item.ref_ser && !seenRefs.has(item.ref_ser)) {
      uniqueData.push(item);
      seenRefs.add(item.ref_ser);
    }
  }

  const filteredData = uniqueData.filter((item) => {
    if (!search) return true;
    const lower = search.toLowerCase().trim();
    return (
      (item.ref_ser && String(item.ref_ser).toLowerCase().includes(lower)) ||
      (item.desc_estado_expedicao && String(item.desc_estado_expedicao).toLowerCase().includes(lower))
    );
  });

  // Função helper para mostrar data em formato limpo
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-PT');
    } catch {
      return dateStr;
    }
  };

  // Função helper para extrair apenas a hora
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    // O timeStr virá como "17:14:00", vamos mostrar "17:14"
    return timeStr.substring(0, 5);
  };

  return (
    <main className="w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Banner Topo */}
      <div className="h-[50px] bg-primary-container text-on-primary rounded-xl px-5 flex items-center shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-[50px] w-full min-w-0">
          <h1 className="text-base sm:text-lg font-bold font-headline leading-none whitespace-nowrap text-white shrink-0">
            Transporte e Expedição
          </h1>
          <p className="text-xs sm:text-sm text-lime-300 font-medium truncate hidden sm:block">
            Histórico e Tracking Torrestir
          </p>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm space-y-4">
        {/* Filtro/Pesquisa */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-1 w-full sm:max-w-md items-center gap-2">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Pesquisar por referência ou estado..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/40 rounded-lg pl-9 pr-8 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface focus:outline-none flex items-center justify-center p-0.5 rounded-full hover:bg-surface-container-highest transition-colors cursor-pointer"
                  title="Limpar pesquisa"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="shrink-0 px-3 py-1.5 text-xs font-semibold text-error hover:text-error/80 bg-error/10 hover:bg-error/20 rounded-lg transition-all cursor-pointer"
              >
                Limpar Filtro
              </button>
            )}
          </div>
          <p className="text-xs font-semibold text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant/20">
            Total de Registos: {filteredData.length}
          </p>
        </div>

        {/* Tabela de Tracking */}
        <div className="overflow-x-auto rounded-xl border border-outline-variant/30">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px] border-b border-outline-variant/30">
              <tr>
                <th className="py-2.5 px-3">Ref. Sermail</th>
                <th className="py-2.5 px-3">Ref. Comprovativo</th>
                <th className="py-2.5 px-3">Ref. Transporte</th>
                <th className="py-2.5 px-3">Estado Expedição</th>
                <th className="py-2.5 px-3 text-center">Data Estado</th>
                <th className="py-2.5 px-3 text-center">Hora Estado</th>
                <th className="py-2.5 px-3">Observações</th>
                <th className="py-2.5 px-3 text-right">Data Importação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-on-surface bg-surface-container-lowest">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-on-surface-variant text-xs">
                    Nenhum registo de tracking encontrado.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-secondary">{item.ref_ser}</td>
                    <td className="py-2.5 px-3 font-mono text-on-surface-variant">{item.ref_comprovativo || '-'}</td>
                    <td className="py-2.5 px-3 font-mono">{item.ref_trans || '-'}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {item.desc_estado_expedicao || '-'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-on-surface-variant">
                      {formatDate(item.data_estado)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-on-surface-variant">
                      {formatTime(item.hora_estado)}
                    </td>
                    <td className="py-2.5 px-3 max-w-[200px] truncate" title={item.obs_expedicao || ''}>
                      {item.obs_expedicao || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-on-surface-variant opacity-75">
                      {new Date(item.created_at).toLocaleDateString('pt-PT')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
