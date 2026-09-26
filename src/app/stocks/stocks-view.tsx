'use client';

import { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { useLanguage } from '@/lib/i18n/context';
import {
  StockAtual,
  StockPedido,
  Client,
  TIPO_ARTIGO_LABELS,
  TIPO_ARMAZENAMENTO_LABELS,
  TIPO_ARMAZEM_LABELS,
  TipoArtigo,
  TipoArmazenamento,
  TipoArmazem,
  UserProfile,
} from '@/lib/supabase/types';


interface StocksViewProps {
  stockAtual: StockAtual[];
  stockPedidos: StockPedido[];
  clients: Client[];
  currentUserProfile: UserProfile | null;
}

type TabType = 'pedidos' | 'consolidado' | 'artigos' | 'validade';

export default function StocksView({
  stockAtual,
  stockPedidos,
  clients,
  currentUserProfile,
}: StocksViewProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('pedidos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('todos');
  const [selectedArmazenamento, setSelectedArmazenamento] = useState<string>('todos');
  const [selectedTipoArtigo, setSelectedTipoArtigo] = useState<string>('todos');
  const [selectedTipoArmazem, setSelectedTipoArmazem] = useState<string>('todos');


  const isManagerOrAdmin =
    currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'gestor';

  // Helper para calcular dias até à validade
  const getDaysUntilExpiry = (dateStr: string | null) => {
    if (!dateStr) return null;
    const expiry = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // KPIs
  const totalStockVenda = useMemo(() => {
    return stockPedidos.reduce((acc, curr) => acc + Number(curr.stock || 0), 0);
  }, [stockPedidos]);

  const totalStockOutros = useMemo(() => {
    return stockAtual
      .filter((s) => s.tipo_armazem !== '01')
      .reduce((acc, curr) => acc + Number(curr.stock || 0), 0);
  }, [stockAtual]);

  const totalLotes = useMemo(() => {
    const lotesSet = new Set<string>();
    stockAtual.forEach((s) => {
      if (s.lote) lotesSet.add(`${s.artigo_id}_${s.lote}`);
    });
    return lotesSet.size;
  }, [stockAtual]);

  const artigosDistintos = useMemo(() => {
    const artigosSet = new Set<string>();
    stockAtual.forEach((s) => artigosSet.add(s.artigo_id));
    return artigosSet.size;
  }, [stockAtual]);

  const artigosAlertaValidadeMH = useMemo(() => {
    const artigosSet = new Set<string>();
    stockAtual.forEach((s) => {
      // A validade de 180 dias apenas se aplica a medicamentos de uso humano (MH)
      const tipo = s.tipo_artigo ? String(s.tipo_artigo).trim().toUpperCase() : '';
      const isMH = tipo === 'MH' || tipo.startsWith('MH') || tipo.includes('HUMANO');
      if (isMH) {
        const days = getDaysUntilExpiry(s.validade);
        if (days !== null && days < 180) {
          artigosSet.add(s.artigo_id);
        }
      }
    });
    return artigosSet.size;
  }, [stockAtual]);

  const artigosAlertaValidadeDM = useMemo(() => {
    const artigosSet = new Set<string>();
    stockAtual.forEach((s) => {
      // Contabilizar todos os artigos do tipo DM cuja validade esteja expirada (<= 0 dias)
      const tipo = s.tipo_artigo ? String(s.tipo_artigo).trim().toUpperCase() : '';
      const isDM = tipo === 'DM' || tipo.startsWith('DM') || tipo.includes('DISPOSITIVO');
      if (isDM) {
        const days = getDaysUntilExpiry(s.validade);
        if (days !== null && days <= 0) {
          artigosSet.add(s.artigo_id);
        }
      }
    });
    return artigosSet.size;
  }, [stockAtual]);

  const artigosAlertaValidadeDCSA = useMemo(() => {
    const artigosSet = new Set<string>();
    stockAtual.forEach((s) => {
      // Contabilizar todos os artigos do tipo DC e SA cuja validade esteja expirada (<= 0 dias)
      const tipo = s.tipo_artigo ? String(s.tipo_artigo).trim().toUpperCase() : '';
      const isDCSA =
        tipo === 'DC' ||
        tipo === 'SA' ||
        tipo.startsWith('DC') ||
        tipo.startsWith('SA') ||
        tipo.includes('DERMO') ||
        tipo.includes('COSM') ||
        tipo.includes('SUPL');

      if (isDCSA) {
        const days = getDaysUntilExpiry(s.validade);
        if (days !== null && days <= 0) {
          artigosSet.add(s.artigo_id);
        }
      }
    });
    return artigosSet.size;
  }, [stockAtual]);

  // Filtragem para Stock de Venda (vw_stock_pedidos)
  const filteredStockPedidos = useMemo(() => {
    return stockPedidos.filter((item) => {
      if (selectedClientId !== 'todos' && item.client_id !== selectedClientId) {
        return false;
      }
      if (
        selectedArmazenamento !== 'todos' &&
        item.tipo_armazenamento !== selectedArmazenamento
      ) {
        return false;
      }
      if (
        selectedTipoArtigo !== 'todos' &&
        item.tipo_artigo !== selectedTipoArtigo
      ) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchCod = item.artigo_codigo?.toLowerCase().includes(query);
        const matchDesc = item.artigo_descricao?.toLowerCase().includes(query);
        const matchLote = item.lote?.toLowerCase().includes(query);
        const matchCli = item.cliente_sigla?.toLowerCase().includes(query) || item.cliente_nome?.toLowerCase().includes(query);
        if (!matchCod && !matchDesc && !matchLote && !matchCli) {
          return false;
        }
      }
      return true;
    });
  }, [stockPedidos, selectedClientId, selectedArmazenamento, selectedTipoArtigo, searchTerm]);

  // Filtragem para Stock Consolidado (vw_stock_atual)
  const filteredStockAtual = useMemo(() => {
    return stockAtual.filter((item) => {
      if (selectedClientId !== 'todos' && item.client_id !== selectedClientId) {
        return false;
      }
      if (
        selectedArmazenamento !== 'todos' &&
        item.tipo_armazenamento !== selectedArmazenamento
      ) {
        return false;
      }
      if (
        selectedTipoArtigo !== 'todos' &&
        item.tipo_artigo !== selectedTipoArtigo
      ) {
        return false;
      }
      if (
        selectedTipoArmazem !== 'todos' &&
        item.tipo_armazem !== selectedTipoArmazem
      ) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchCod = item.artigo_codigo?.toLowerCase().includes(query);
        const matchDesc = item.artigo_descricao?.toLowerCase().includes(query);
        const matchLote = item.lote?.toLowerCase().includes(query);
        const matchArmLoc = item.armazem_loc?.toLowerCase().includes(query);
        const matchCli = item.cliente_sigla?.toLowerCase().includes(query) || item.cliente_nome?.toLowerCase().includes(query);
        if (!matchCod && !matchDesc && !matchLote && !matchArmLoc && !matchCli) {
          return false;
        }
      }
      return true;
    });
  }, [stockAtual, selectedClientId, selectedArmazenamento, selectedTipoArtigo, selectedTipoArmazem, searchTerm]);

  // Agrupamento por Artigo
  const resumoArtigos = useMemo(() => {
    const map = new Map<
      string,
      {
        artigo_id: string;
        artigo_codigo: string;
        artigo_descricao: string;
        cliente_sigla: string;
        tipo_artigo: TipoArtigo;
        tipo_armazenamento: TipoArmazenamento;
        stockVenda: number;
        stockOutros: number;
        stockTotal: number;
        lotesCount: Set<string>;
        primeiraValidade: string | null;
      }
    >();

    filteredStockAtual.forEach((item) => {
      const key = `${item.client_id}_${item.artigo_id}`;
      if (!map.has(key)) {
        map.set(key, {
          artigo_id: item.artigo_id,
          artigo_codigo: item.artigo_codigo,
          artigo_descricao: item.artigo_descricao,
          cliente_sigla: item.cliente_sigla,
          tipo_artigo: item.tipo_artigo,
          tipo_armazenamento: item.tipo_armazenamento,
          stockVenda: 0,
          stockOutros: 0,
          stockTotal: 0,
          lotesCount: new Set<string>(),
          primeiraValidade: item.validade,
        });
      }

      const obj = map.get(key)!;
      const qtd = Number(item.stock || 0);
      obj.stockTotal += qtd;
      if (item.tipo_armazem === '01') {
        obj.stockVenda += qtd;
      } else {
        obj.stockOutros += qtd;
      }
      if (item.lote) {
        obj.lotesCount.add(item.lote);
      }
      if (item.validade) {
        if (!obj.primeiraValidade || new Date(item.validade) < new Date(obj.primeiraValidade)) {
          obj.primeiraValidade = item.validade;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.stockTotal - a.stockTotal);
  }, [filteredStockAtual]);

  // Lotes para Alerta de Validade (FEFO)
  const lotesValidade = useMemo(() => {
    return [...filteredStockAtual]
      .filter((s) => s.validade)
      .sort((a, b) => {
        if (!a.validade) return 1;
        if (!b.validade) return -1;
        return new Date(a.validade).getTime() - new Date(b.validade).getTime();
      });
  }, [filteredStockAtual]);

  // Exportar CSV
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (activeTab === 'pedidos') {
      csvContent += 'Cliente,Codigo Artigo,Descricao,Tipo Artigo,Conservacao,Lote,Validade,Stock Disponivel\n';
      filteredStockPedidos.forEach((r) => {
        csvContent += `"${r.cliente_sigla}","${r.artigo_codigo}","${r.artigo_descricao.replace(/"/g, '""')}","${r.tipo_artigo}","${r.tipo_armazenamento}","${r.lote || ''}","${r.validade || ''}",${r.stock}\n`;
      });
    } else if (activeTab === 'consolidado') {
      csvContent += 'Cliente,Codigo Artigo,Descricao,Lote,Validade,Armazem Loc,Tipo Armazem,Descricao Armazem,Stock\n';
      filteredStockAtual.forEach((r) => {
        csvContent += `"${r.cliente_sigla}","${r.artigo_codigo}","${r.artigo_descricao.replace(/"/g, '""')}","${r.lote || ''}","${r.validade || ''}","${r.armazem_loc}","${r.tipo_armazem}","${r.armazem_descricao || ''}",${r.stock}\n`;
      });
    } else if (activeTab === 'artigos') {
      csvContent += 'Cliente,Codigo Artigo,Descricao,Tipo Artigo,Conservacao,Stock Venda,Stock Outros,Stock Total,Lotes\n';
      resumoArtigos.forEach((r) => {
        csvContent += `"${r.cliente_sigla}","${r.artigo_codigo}","${r.artigo_descricao.replace(/"/g, '""')}","${r.tipo_artigo}","${r.tipo_armazenamento}",${r.stockVenda},${r.stockOutros},${r.stockTotal},${r.lotesCount.size}\n`;
      });
    } else {
      csvContent += 'Cliente,Codigo Artigo,Descricao,Lote,Validade,Dias Restantes,Armazem Loc,Stock\n';
      lotesValidade.forEach((r) => {
        const days = getDaysUntilExpiry(r.validade);
        csvContent += `"${r.cliente_sigla}","${r.artigo_codigo}","${r.artigo_descricao.replace(/"/g, '""')}","${r.lote || ''}","${r.validade || ''}",${days ?? ''},"${r.armazem_loc}",${r.stock}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stocks_export_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar Excel (.xlsx) com formatação rica via ExcelJS
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheetTitles: Record<TabType, string> = {
      pedidos: 'Stock Disponível',
      consolidado: 'Stock Consolidado',
      artigos: 'Resumo por Artigo',
      validade: 'Controlo de Validades',
    };

    const worksheet = workbook.addWorksheet(sheetTitles[activeTab] || 'Stocks');

    if (activeTab === 'pedidos') {
      worksheet.columns = [
        { header: 'Cliente', key: 'cliente_sigla', width: 12 },
        { header: 'Código Artigo', key: 'artigo_codigo', width: 18 },
        { header: 'Descrição Artigo', key: 'artigo_descricao', width: 38 },
        { header: 'Tipo Artigo', key: 'tipo_artigo', width: 16 },
        { header: 'Conservação', key: 'tipo_armazenamento', width: 16 },
        { header: 'Lote', key: 'lote', width: 18 },
        { header: 'Validade', key: 'validade', width: 14 },
        { header: 'Stock Disponível', key: 'stock', width: 18 },
      ];

      filteredStockPedidos.forEach((r) => {
        worksheet.addRow({
          cliente_sigla: r.cliente_sigla,
          artigo_codigo: r.artigo_codigo,
          artigo_descricao: r.artigo_descricao,
          tipo_artigo: TIPO_ARTIGO_LABELS[r.tipo_artigo as TipoArtigo] || r.tipo_artigo,
          tipo_armazenamento: TIPO_ARMAZENAMENTO_LABELS[r.tipo_armazenamento as TipoArmazenamento] || r.tipo_armazenamento,
          lote: r.lote || '-',
          validade: r.validade ? new Date(r.validade).toLocaleDateString('pt-PT') : '-',
          stock: Number(r.stock),
        });
      });
    } else if (activeTab === 'consolidado') {
      worksheet.columns = [
        { header: 'Cliente', key: 'cliente_sigla', width: 12 },
        { header: 'Código Artigo', key: 'artigo_codigo', width: 18 },
        { header: 'Descrição Artigo', key: 'artigo_descricao', width: 38 },
        { header: 'Lote', key: 'lote', width: 18 },
        { header: 'Validade', key: 'validade', width: 14 },
        { header: 'Armazém Loc', key: 'armazem_loc', width: 16 },
        { header: 'Tipo Armazém', key: 'tipo_armazem', width: 14 },
        { header: 'Descrição Armazém', key: 'armazem_descricao', width: 22 },
        { header: 'Stock', key: 'stock', width: 14 },
      ];

      filteredStockAtual.forEach((r) => {
        worksheet.addRow({
          cliente_sigla: r.cliente_sigla,
          artigo_codigo: r.artigo_codigo,
          artigo_descricao: r.artigo_descricao,
          lote: r.lote || '-',
          validade: r.validade ? new Date(r.validade).toLocaleDateString('pt-PT') : '-',
          armazem_loc: r.armazem_loc,
          tipo_armazem: r.tipo_armazem,
          armazem_descricao: r.armazem_descricao || `Armazém ${r.tipo_armazem}`,
          stock: Number(r.stock),
        });
      });
    } else if (activeTab === 'artigos') {
      worksheet.columns = [
        { header: 'Cliente', key: 'cliente_sigla', width: 12 },
        { header: 'Código Artigo', key: 'artigo_codigo', width: 18 },
        { header: 'Descrição Artigo', key: 'artigo_descricao', width: 38 },
        { header: 'Tipo Artigo', key: 'tipo_artigo', width: 16 },
        { header: 'Conservação', key: 'tipo_armazenamento', width: 16 },
        { header: 'Stock Venda (01)', key: 'stockVenda', width: 18 },
        { header: 'Stock Outros', key: 'stockOutros', width: 16 },
        { header: 'Stock Total', key: 'stockTotal', width: 16 },
        { header: 'Lotes Distintos', key: 'lotesCount', width: 16 },
      ];

      resumoArtigos.forEach((r) => {
        worksheet.addRow({
          cliente_sigla: r.cliente_sigla,
          artigo_codigo: r.artigo_codigo,
          artigo_descricao: r.artigo_descricao,
          tipo_artigo: TIPO_ARTIGO_LABELS[r.tipo_artigo as TipoArtigo] || r.tipo_artigo,
          tipo_armazenamento: TIPO_ARMAZENAMENTO_LABELS[r.tipo_armazenamento as TipoArmazenamento] || r.tipo_armazenamento,
          stockVenda: r.stockVenda,
          stockOutros: r.stockOutros,
          stockTotal: r.stockTotal,
          lotesCount: r.lotesCount.size,
        });
      });
    } else {
      worksheet.columns = [
        { header: 'Cliente', key: 'cliente_sigla', width: 12 },
        { header: 'Código Artigo', key: 'artigo_codigo', width: 18 },
        { header: 'Descrição Artigo', key: 'artigo_descricao', width: 38 },
        { header: 'Lote', key: 'lote', width: 18 },
        { header: 'Validade', key: 'validade', width: 14 },
        { header: 'Dias Restantes', key: 'dias_restantes', width: 16 },
        { header: 'Armazém Loc', key: 'armazem_loc', width: 16 },
        { header: 'Stock', key: 'stock', width: 14 },
      ];

      lotesValidade.forEach((r) => {
        const days = getDaysUntilExpiry(r.validade);
        worksheet.addRow({
          cliente_sigla: r.cliente_sigla,
          artigo_codigo: r.artigo_codigo,
          artigo_descricao: r.artigo_descricao,
          lote: r.lote || '-',
          validade: r.validade ? new Date(r.validade).toLocaleDateString('pt-PT') : '-',
          dias_restantes: days ?? '-',
          armazem_loc: r.armazem_loc,
          stock: Number(r.stock),
        });
      });
    }

    // Estilo elegante de cabeçalho
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B4332' }, // Verde floresta escuro Sermail
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    headerRow.height = 26;

    // Gerar buffer e download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stocks_export_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedClientId !== 'todos' ||
    selectedArmazenamento !== 'todos' ||
    selectedTipoArtigo !== 'todos' ||
    selectedTipoArmazem !== 'todos';

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedClientId('todos');
    setSelectedArmazenamento('todos');
    setSelectedTipoArtigo('todos');
    setSelectedTipoArmazem('todos');
  };

  return (
    <main className="w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Banner */}
      <div className="h-[50px] bg-primary-container text-on-primary rounded-xl px-5 flex items-center shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-[50px] w-full min-w-0">
          <h1 className="text-base sm:text-lg font-bold font-headline leading-none whitespace-nowrap text-white shrink-0">
            {t.stocks.bannerTitle}
          </h1>
          <p className="text-xs sm:text-sm text-lime-300 font-medium truncate hidden sm:block">
            {t.stocks.bannerSubtitle}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* KPIs Grid (4 Indicadores atualizados dinamicamente - Formatação adaptável do Dashboard) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch">
          {/* 1. Stock Outros Armazéns */}
          <div className="min-h-[100px] p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1.5">
              <span className="text-[11px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider leading-snug whitespace-normal break-words">
                Stock Outros Armazéns
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                <span className="material-symbols-outlined text-lg">warehouse</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-1.5 flex-wrap pt-1">
              <span className="text-xl sm:text-2xl font-bold font-headline text-on-surface leading-none">
                {totalStockOutros.toLocaleString('pt-PT')}{' '}
                <span className="text-xs font-normal text-on-surface-variant">un</span>
              </span>
              <span className="text-[10px] sm:text-[11px] text-amber-700 font-medium flex items-center gap-0.5 leading-tight whitespace-normal">
                <span className="material-symbols-outlined text-xs shrink-0">info</span>
                <span>Quarentena / Devoluções</span>
              </span>
            </div>
          </div>

          {/* 2. Alertas Validade DM (Expirados - Dispositivos Médicos) */}
          <div className="min-h-[100px] p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider leading-snug whitespace-normal break-words">
                  {t.stocks.alertsDm}
                </span>
                <span className="text-[9.5px] sm:text-[10px] font-medium text-rose-800/90 leading-tight whitespace-normal mt-0.5">
                  Dispositivos Médicos
                </span>
              </div>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                artigosAlertaValidadeDM > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'
              }`}>
                <span className="material-symbols-outlined text-lg">block</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-1.5 flex-wrap pt-1">
              <span className={`text-xl sm:text-2xl font-bold font-headline leading-none ${
                artigosAlertaValidadeDM > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}>
                {artigosAlertaValidadeDM}
              </span>
              <span className={`text-[10px] sm:text-[11px] font-medium flex items-center gap-0.5 leading-tight whitespace-normal ${
                artigosAlertaValidadeDM > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                <span className="material-symbols-outlined text-xs shrink-0">error</span>
                <span>{t.stocks.expired}</span>
              </span>
            </div>
          </div>

          {/* 3. Alertas Validade DC e SA (Expirados - Dermocosméticos e Suplementos Alimentares) */}
          <div className="min-h-[100px] p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider leading-snug whitespace-normal break-words">
                  {t.stocks.alertsDcSa}
                </span>
                <span className="text-[9.5px] sm:text-[10px] font-medium text-rose-800/90 leading-tight whitespace-normal mt-0.5">
                  Dermocosméticos, Suplementos
                </span>
              </div>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                artigosAlertaValidadeDCSA > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'
              }`}>
                <span className="material-symbols-outlined text-lg">block</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-1.5 flex-wrap pt-1">
              <span className={`text-xl sm:text-2xl font-bold font-headline leading-none ${
                artigosAlertaValidadeDCSA > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}>
                {artigosAlertaValidadeDCSA}
              </span>
              <span className={`text-[10px] sm:text-[11px] font-medium flex items-center gap-0.5 leading-tight whitespace-normal ${
                artigosAlertaValidadeDCSA > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                <span className="material-symbols-outlined text-xs shrink-0">error</span>
                <span>{t.stocks.expired}</span>
              </span>
            </div>
          </div>

          {/* 4. Alertas Validade MH (< 180 dias - Medicamentos Uso Humano) */}
          <div className="min-h-[100px] p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider leading-snug whitespace-normal break-words">
                  {t.stocks.alertsMh}
                </span>
                <span className="text-[9.5px] sm:text-[10px] font-medium text-amber-800/90 leading-tight whitespace-normal mt-0.5">
                  Medicamentos Uso Humano
                </span>
              </div>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                artigosAlertaValidadeMH > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'
              }`}>
                <span className="material-symbols-outlined text-lg">warning</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-1.5 flex-wrap pt-1">
              <span className={`text-xl sm:text-2xl font-bold font-headline leading-none ${
                artigosAlertaValidadeMH > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {artigosAlertaValidadeMH}
              </span>
              <span className={`text-[10px] sm:text-[11px] font-medium flex items-center gap-0.5 leading-tight whitespace-normal ${
                artigosAlertaValidadeMH > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}>
                <span className="material-symbols-outlined text-xs shrink-0">schedule</span>
                <span>{t.stocks.inRisk} (&lt; 180d)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Painel de Filtros e Busca */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Barra de Pesquisa */}
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.stocks.searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant/40 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>

            {/* Botões de Exportação */}
            <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap sm:flex-nowrap">
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 rounded-xl transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                  {t.common.cancel}
                </button>
              )}
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2.5 bg-surface-container border border-outline-variant/40 text-on-surface hover:bg-surface-container-high font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                title="Exportar CSV"
              >
                <span className="material-symbols-outlined text-sm text-secondary">description</span>
                CSV
              </button>
              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-98"
                title="Exportar Excel (.xlsx)"
              >
                <span className="material-symbols-outlined text-sm text-emerald-200">table_view</span>
                {t.stocks.exportExcel}
              </button>
            </div>
          </div>

          {/* Linha de Filtros Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-outline-variant/15">
            {/* Filtro Cliente (Apenas se Admin/Gestor) */}
            {isManagerOrAdmin ? (
              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                  {t.stocks.filterClient}
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
                >
                  <option value="todos">{t.stocks.allClients}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.sigla} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                  {t.stocks.filterClient}
                </label>
                <div className="px-3 py-1.5 bg-surface-container/40 border border-outline-variant/30 rounded-lg text-xs font-mono font-bold text-secondary">
                  {currentUserProfile?.empresa || 'Cliente Associado'}
                </div>
              </div>
            )}

            {/* Filtro Conservação */}
            <div>
              <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                {t.stocks.filterStorage}
              </label>
              <select
                value={selectedArmazenamento}
                onChange={(e) => setSelectedArmazenamento(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
              >
                <option value="todos">{t.stocks.allStorage}</option>
                <option value="TF">TF - Frio (2-8 ºC)</option>
                <option value="TC">TC - Controlada (15-25 ºC)</option>
                <option value="TA">TA - Temperatura Ambiente</option>
              </select>
            </div>

            {/* Filtro Tipo Artigo */}
            <div>
              <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                {t.stocks.filterArticleType}
              </label>
              <select
                value={selectedTipoArtigo}
                onChange={(e) => setSelectedTipoArtigo(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
              >
                <option value="todos">{t.stocks.allTypes}</option>
                <option value="MH">MH - Medicamento Humano</option>
                <option value="MV">MV - Medicamento Veterinário</option>
                <option value="DM">DM - Dispositivo Médico</option>
                <option value="DC">DC - Dermo-Cosmético</option>
                <option value="SC">SC - Substância Controlada</option>
              </select>
            </div>

            {/* Filtro Tipo Armazém */}
            <div>
              <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                {t.stocks.filterWarehouse}
              </label>
              <select
                value={selectedTipoArmazem}
                onChange={(e) => setSelectedTipoArmazem(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
              >
                <option value="todos">{t.stocks.allWarehouses}</option>
                <option value="01">01 - Venda (Disponível)</option>
                <option value="05">05 - Quarentena</option>
                <option value="04">04 - Devoluções</option>
                <option value="02">02 - Expirados</option>
                <option value="03">03 - Danificados</option>
                <option value="06">06 - Destruição</option>
                <option value="07">07 - Farmacoteca</option>
                <option value="09">09 - Validade</option>
                <option value="10">10 - MIA</option>
              </select>
            </div>
          </div>
        </div>

        {/* Abas de Navegação de Stock */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-outline-variant/20 px-6 pt-4 bg-surface-container/20">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('pedidos')}
                className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'pedidos'
                    ? 'border-secondary text-secondary bg-surface-container-lowest rounded-t-xl shadow-sm'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container/40 rounded-t-xl'
                }`}
              >
                <span className="material-symbols-outlined text-base">shopping_cart_checkout</span>
                {t.stocks.tabVenda}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container text-on-secondary-container">
                  {filteredStockPedidos.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('consolidado')}
                className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'consolidado'
                    ? 'border-secondary text-secondary bg-surface-container-lowest rounded-t-xl shadow-sm'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container/40 rounded-t-xl'
                }`}
              >
                <span className="material-symbols-outlined text-base">inventory</span>
                {t.stocks.tabConsolidado}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container text-on-secondary-container">
                  {filteredStockAtual.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('artigos')}
                className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'artigos'
                    ? 'border-secondary text-secondary bg-surface-container-lowest rounded-t-xl shadow-sm'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container/40 rounded-t-xl'
                }`}
              >
                <span className="material-symbols-outlined text-base">category</span>
                {t.stocks.tabArtigos}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container text-on-secondary-container">
                  {resumoArtigos.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('validade')}
                className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'validade'
                    ? 'border-secondary text-secondary bg-surface-container-lowest rounded-t-xl shadow-sm'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container/40 rounded-t-xl'
                }`}
              >
                <span className="material-symbols-outlined text-base">notification_important</span>
                {t.stocks.tabValidades}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary-container text-on-secondary-container">
                  {lotesValidade.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo da Aba Ativa */}
        <div className="p-6">

          {/* TAB 1: Stock Venda Livre (vw_stock_pedidos) */}
          {activeTab === 'pedidos' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-outline-variant/15 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">check_circle</span>
                    Stock Alocável para Pedidos e Expedição Comercial
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Artigos em Armazém 01 disponíveis para saída imediata com ordenação inteligente FEFO.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[650px] rounded-xl border border-outline-variant/30 shadow-2xs relative">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface-container text-on-surface-variant font-bold uppercase tracking-wider text-[10px] border-b border-outline-variant/30 shadow-xs">
                    <tr>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Cliente</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Código</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Descrição do Artigo</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Tipo Artigo</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Conservação</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Lote</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Validade</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0 text-right">Stock Disponível</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {filteredStockPedidos.length > 0 ? (
                      filteredStockPedidos.map((item, idx) => {
                        const days = getDaysUntilExpiry(item.validade);
                        const isExpired = days !== null && days <= 0;
                        const isWarning = days !== null && days > 0 && days <= 90;

                        return (
                          <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                            <td className="py-3 px-3 font-semibold">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                                {item.cliente_sigla}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-medium">{item.artigo_codigo}</td>
                            <td className="py-3 px-3 font-medium">{item.artigo_descricao}</td>
                            <td className="py-3 px-3">
                              <span className="text-[11px] text-on-surface-variant">
                                {TIPO_ARTIGO_LABELS[item.tipo_artigo as TipoArtigo] || item.tipo_artigo}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  item.tipo_armazenamento === 'TF'
                                    ? 'bg-cyan-100 text-cyan-800'
                                    : item.tipo_armazenamento === 'TC'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[12px]">
                                  {item.tipo_armazenamento === 'TF' ? 'ac_unit' : 'thermostat'}
                                </span>
                                {TIPO_ARMAZENAMENTO_LABELS[item.tipo_armazenamento as TipoArmazenamento] ||
                                  item.tipo_armazenamento}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-semibold text-secondary">
                              {item.lote}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-on-surface-variant">
                                  {item.validade
                                    ? new Date(item.validade).toLocaleDateString('pt-PT')
                                    : '-'}
                                </span>
                                {isExpired && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                                    Expirado
                                  </span>
                                )}
                                {isWarning && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                    {days}d
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                              {Number(item.stock).toLocaleString('pt-PT')}{' '}
                              <span className="text-xs font-normal text-on-surface-variant">un</span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-3xl mb-1 text-on-surface-variant/40 block">
                            inventory_2
                          </span>
                          Nenhum artigo com stock de venda livre encontrado com os filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Stock Consolidado (vw_stock_atual) */}
          {activeTab === 'consolidado' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-outline-variant/15">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">warehouse</span>
                  Visão Consolidada por Armazém Físico e Localização
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Registo detalhado de todos os lotes por armazém (<code className="text-xs bg-surface-container px-1 py-0.5 rounded font-mono text-secondary">armazem_loc</code>), incluindo Venda, Quarentena, Devoluções e Expirados.
                </p>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[650px] rounded-xl border border-outline-variant/30 shadow-2xs relative">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface-container text-on-surface-variant font-bold uppercase tracking-wider text-[10px] border-b border-outline-variant/30 shadow-xs">
                    <tr>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Cliente</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Código</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Descrição Artigo</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Lote</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Validade</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Armazém Loc</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Tipo Armazém</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {filteredStockAtual.length > 0 ? (
                      filteredStockAtual.map((item, idx) => (
                        <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                              {item.cliente_sigla}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-medium">{item.artigo_codigo}</td>
                          <td className="py-3 px-3 font-medium">{item.artigo_descricao}</td>
                          <td className="py-3 px-3 font-mono text-secondary font-semibold">
                            {item.lote}
                          </td>
                          <td className="py-3 px-3 font-mono text-on-surface-variant">
                            {item.validade
                              ? new Date(item.validade).toLocaleDateString('pt-PT')
                              : '-'}
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold text-secondary-600">
                            {item.armazem_loc}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                                item.tipo_armazem === '01'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.tipo_armazem === '05'
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.tipo_armazem === '02'
                                  ? 'bg-rose-100 text-rose-800'
                                  : item.tipo_armazem === '09'
                                  ? 'bg-purple-100 text-purple-800'
                                  : item.tipo_armazem === '10'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {item.armazem_descricao || `Armazém ${item.tipo_armazem}`}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                            {Number(item.stock).toLocaleString('pt-PT')}{' '}
                            <span className="text-xs font-normal text-on-surface-variant">un</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-3xl mb-1 text-on-surface-variant/40 block">
                            warehouse
                          </span>
                          Nenhum registo consolidado encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Resumo por Artigo */}
          {activeTab === 'artigos' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-outline-variant/15">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">category</span>
                  Stock Total Agregado por Artigo
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Consolidação do stock total em todos os armazéns e lotes para cada artigo.
                </p>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[650px] rounded-xl border border-outline-variant/30 shadow-2xs relative">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface-container text-on-surface-variant font-bold uppercase tracking-wider text-[10px] border-b border-outline-variant/30 shadow-xs">
                    <tr>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Cliente</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Código</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Descrição do Artigo</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Tipo Artigo</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Conservação</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0 text-center">Nº Lotes</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Próx. Validade</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0 text-right">Stock Venda</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0 text-right">Stock Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {resumoArtigos.length > 0 ? (
                      resumoArtigos.map((item, idx) => (
                        <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                              {item.cliente_sigla}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-medium">{item.artigo_codigo}</td>
                          <td className="py-3 px-3 font-medium">{item.artigo_descricao}</td>
                          <td className="py-3 px-3">
                            <span className="text-[11px] text-on-surface-variant">
                              {TIPO_ARTIGO_LABELS[item.tipo_artigo] || item.tipo_artigo}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                item.tipo_armazenamento === 'TF'
                                  ? 'bg-cyan-100 text-cyan-800'
                                  : item.tipo_armazenamento === 'TC'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">
                                {item.tipo_armazenamento === 'TF' ? 'ac_unit' : 'thermostat'}
                              </span>
                              {TIPO_ARMAZENAMENTO_LABELS[item.tipo_armazenamento] ||
                                item.tipo_armazenamento}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold">
                            <span className="px-2 py-0.5 bg-surface-container rounded-full text-[11px]">
                              {item.lotesCount.size}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-on-surface-variant">
                            {item.primeiraValidade
                              ? new Date(item.primeiraValidade).toLocaleDateString('pt-PT')
                              : '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-700">
                            {item.stockVenda.toLocaleString('pt-PT')}{' '}
                            <span className="text-[10px] text-on-surface-variant">un</span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                            {item.stockTotal.toLocaleString('pt-PT')}{' '}
                            <span className="text-xs font-normal text-on-surface-variant">un</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-on-surface-variant">
                          Nenhum artigo encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Controlo de Validades (FEFO Monitor) */}
          {activeTab === 'validade' && (
            <div className="space-y-4">
              <div className="pb-3 border-b border-outline-variant/15">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">event_upcoming</span>
                  Monitorização Preventiva de Validades & Lotes (FEFO)
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Lotes ordenados por data de expiração mais próxima para priorização de expedição e gestão preventiva.
                </p>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[650px] rounded-xl border border-outline-variant/30 shadow-2xs relative">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface-container text-on-surface-variant font-bold uppercase tracking-wider text-[10px] border-b border-outline-variant/30 shadow-xs">
                    <tr>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Estado</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Cliente</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Código</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Descrição Artigo</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Lote</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Data Validade</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Dias Restantes</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0">Armazém Loc</th>
                      <th className="py-3 px-3 bg-surface-container sticky top-0 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {lotesValidade.length > 0 ? (
                      lotesValidade.map((item, idx) => {
                        const days = getDaysUntilExpiry(item.validade);
                        const isExpired = days !== null && days <= 0;
                        const isCritical = days !== null && days > 0 && days <= 30;
                        const isWarning = days !== null && days > 30 && days <= 90;

                        return (
                          <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                            <td className="py-3 px-3">
                              {isExpired ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                  EXPIRADO
                                </span>
                              ) : isCritical ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse"></span>
                                  CRÍTICO (&le;30d)
                                </span>
                              ) : isWarning ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                  ALERTA (&le;90d)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                  NORMAL
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-semibold">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                                {item.cliente_sigla}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-medium">{item.artigo_codigo}</td>
                            <td className="py-3 px-3 font-medium">{item.artigo_descricao}</td>
                            <td className="py-3 px-3 font-mono font-bold text-secondary">{item.lote}</td>
                            <td className="py-3 px-3 font-mono font-semibold">
                              {item.validade ? new Date(item.validade).toLocaleDateString('pt-PT') : '-'}
                            </td>
                            <td className="py-3 px-3 font-mono">
                              {days !== null ? (
                                <span className={days <= 30 ? 'text-rose-600 font-bold' : days <= 90 ? 'text-amber-700 font-semibold' : 'text-on-surface-variant'}>
                                  {days <= 0 ? `${Math.abs(days)} dias atrás` : `${days} dias`}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-secondary-600 font-medium">
                              {item.armazem_loc}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-sm text-secondary font-mono">
                              {Number(item.stock).toLocaleString('pt-PT')}{' '}
                              <span className="text-xs font-normal text-on-surface-variant">un</span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-on-surface-variant">
                          Nenhum lote com data de validade registada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

