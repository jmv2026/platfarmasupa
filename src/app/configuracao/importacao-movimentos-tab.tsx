'use client';

import { useState, useMemo, useRef } from 'react';
import ExcelJS from 'exceljs';
import { ImpStk, ImpStkInput, Client, Artigo, Armazem, Movimento, TipoMovimento } from '@/lib/supabase/types';
import {
  MovimentoImportInput,
  parseExcelMovimentosFile,
  parseTextMovimentosFile,
  generateMovimentosSampleCSV,
} from '@/lib/parse-movimentos-file';
import { parseTextStockFile, parseExcelStockFile } from '@/lib/parse-stock-file';
import {
  importarMovimentosAction,
  limparMovimentosAction,
  importarStocksAction,
  limparImportacoesStockAction,
} from './actions';

export type MovimentoWithDetails = Movimento & {
  cliente_nome?: string;
  cliente_sigla?: string;
  artigo_descricao?: string;
};

interface ImportacaoMovimentosTabProps {
  initialImpStk: ImpStk[];
  initialMovimentos?: MovimentoWithDetails[];
  clients?: Client[];
  artigos?: Artigo[];
  armazens?: Armazem[];
  onRefresh?: () => void;
}

function formatDateDisplay(d: string | null | undefined): string {
  if (!d) return '-';
  try {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  } catch {
    // fallback
  }
  return d;
}

function formatDateTimeDisplay(d: string | null | undefined): string {
  if (!d) return '-';
  try {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    // fallback
  }
  return d;
}

export default function ImportacaoMovimentosTab({
  initialImpStk,
  initialMovimentos = [],
  clients = [],
  artigos = [],
  armazens = [],
  onRefresh,
}: ImportacaoMovimentosTabProps) {
  // Sub-abas dentro da aba Movimentos
  const [subTab, setSubTab] = useState<'importar_movimentos' | 'tabela_movimentos' | 'imp_stk'>('importar_movimentos');

  // Estados para Importação de Movimentos
  const [selectedMovFile, setSelectedMovFile] = useState<File | null>(null);
  const [parsedMovRows, setParsedMovRows] = useState<MovimentoImportInput[]>([]);
  const [selectedDefaultClient, setSelectedDefaultClient] = useState<string>('');
  const [parsingMovLoading, setParsingMovLoading] = useState(false);
  const [importingMovLoading, setImportingMovLoading] = useState(false);
  const [clearingMovLoading, setClearingMovLoading] = useState(false);
  const [confirmClearMovModal, setConfirmClearMovModal] = useState(false);

  // Lista local de Movimentos
  const [movimentosList, setMovimentosList] = useState<MovimentoWithDetails[]>(initialMovimentos);
  const [movSearchTerm, setMovSearchTerm] = useState('');
  const [movFilterTipo, setMovFilterTipo] = useState<string>('todos');
  const [movFilterClient, setMovFilterClient] = useState<string>('todos');
  const [movFilterArmazem, setMovFilterArmazem] = useState<string>('todos');

  // Estados para imp_stk (Legado / Inventários Brutos)
  const [impStkList, setImpStkList] = useState<ImpStk[]>(initialImpStk);
  const [selectedStockFile, setSelectedStockFile] = useState<File | null>(null);
  const [parsedStockRows, setParsedStockRows] = useState<ImpStkInput[]>([]);
  const [parsingStockLoading, setParsingStockLoading] = useState(false);
  const [importingStockLoading, setImportingStockLoading] = useState(false);
  const [clearingStockLoading, setClearingStockLoading] = useState(false);
  const [confirmClearStockModal, setConfirmClearStockModal] = useState(false);
  const [stockSearchTerm, setStockSearchTerm] = useState('');

  // Feedback global da aba
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const movFileInputRef = useRef<HTMLInputElement>(null);
  const stockFileInputRef = useRef<HTMLInputElement>(null);

  // Mapas rápidos para validação e display
  const artigosMap = useMemo(() => {
    const map = new Map<string, string>();
    artigos.forEach((a) => {
      map.set(a.artigo_id, a.descricao);
    });
    return map;
  }, [artigos]);

  const clientsSiglaMap = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((c) => {
      if (c.sigla) map.set(c.sigla.toUpperCase(), c);
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [clients]);

  // =========================================================================
  // 1. MANIPULAÇÃO DO FICHEIRO DE MOVIMENTOS (.xlsx, .xls, .csv, .txt)
  // =========================================================================
  const handleMovFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedMovFile(file);
    setParsingMovLoading(true);
    setFeedback(null);

    try {
      const fileName = file.name.toLowerCase();
      let rows: MovimentoImportInput[] = [];

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        rows = await parseExcelMovimentosFile(arrayBuffer, file.name);
      } else {
        const textContent = await file.text();
        rows = parseTextMovimentosFile(textContent, file.name);
      }

      if (rows.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Não foram encontrados movimentos válidos no ficheiro selecionado.',
        });
        setParsedMovRows([]);
      } else {
        setParsedMovRows(rows);
        setFeedback({
          type: 'success',
          message: `Ficheiro analisado com sucesso! ${rows.length} movimentos detetados prontos para importação.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro';
      setFeedback({ type: 'error', message: `Erro ao ler ficheiro de movimentos: ${msg}` });
      setParsedMovRows([]);
    } finally {
      setParsingMovLoading(false);
    }
  };

  // Submeter a gravação dos movimentos na tabela movimentos
  const handleConfirmImportMovimentos = async () => {
    if (parsedMovRows.length === 0) return;

    setImportingMovLoading(true);
    setFeedback(null);

    try {
      const CHUNK_SIZE = 200;
      let totalInserted = 0;

      for (let i = 0; i < parsedMovRows.length; i += CHUNK_SIZE) {
        const chunk = parsedMovRows.slice(i, i + CHUNK_SIZE);
        const res = await importarMovimentosAction(chunk, selectedDefaultClient || undefined);
        if (!res.success) {
          throw new Error(res.error || `Erro ao importar lote ${Math.floor(i / CHUNK_SIZE) + 1}`);
        }
        totalInserted += res.count || chunk.length;
      }

      setFeedback({
        type: 'success',
        message: `Importação concluída com sucesso! ${totalInserted} movimentos registados na tabela "movimentos".`,
      });

      // Atualizar lista local de movimentos para exibição imediata
      const newItems: MovimentoWithDetails[] = parsedMovRows.map((r, idx) => {
        const clientFound = r.sigla ? clientsSiglaMap.get(r.sigla.toUpperCase()) : undefined;
        return {
          id: `temp-${Date.now()}-${idx}`,
          artigo_id: r.artigo_id,
          client_id: clientFound?.id || selectedDefaultClient || clients[0]?.id || '',
          sigla: r.sigla || clientFound?.sigla || clients[0]?.sigla || 'PFIZ',
          tipo_movimento: r.tipo_movimento,
          quantidade: Number(r.quantidade),
          tipo_armazem: (r.tipo_armazem || '01') as any,
          armazem_loc: r.armazem_loc || 'PFIZ-01',
          posicao: r.posicao || null,
          lote: r.lote || null,
          nr_serie: r.nr_serie || null,
          validade: r.validade || null,
          data_fabrico: r.data_fabrico || null,
          data_movimento: r.data_movimento || new Date().toISOString(),
          documento_ref: r.documento_ref || null,
          observacoes: r.observacoes || null,
          cliente_nome: clientFound?.name,
          cliente_sigla: r.sigla || clientFound?.sigla,
          artigo_descricao: artigosMap.get(r.artigo_id) || 'Artigo Farmacêutico',
          created_at: new Date().toISOString(),
        };
      });

      setMovimentosList((prev) => [...newItems, ...prev]);
      setSelectedMovFile(null);
      setParsedMovRows([]);
      if (movFileInputRef.current) movFileInputRef.current.value = '';

      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado na importação de movimentos';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setImportingMovLoading(false);
    }
  };

  const handleCancelMovSelection = () => {
    setSelectedMovFile(null);
    setParsedMovRows([]);
    setFeedback(null);
    if (movFileInputRef.current) movFileInputRef.current.value = '';
  };

  const handleClearMovimentosTable = async () => {
    setClearingMovLoading(true);
    try {
      const res = await limparMovimentosAction();
      if (res.success) {
        setMovimentosList([]);
        setFeedback({ type: 'success', message: 'Tabela de movimentos limpa com sucesso.' });
        setConfirmClearMovModal(false);
        if (onRefresh) onRefresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao limpar movimentos.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao limpar';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setClearingMovLoading(false);
    }
  };

  // Download do Modelo CSV de Movimentos
  const handleDownloadMovimentosCSV = () => {
    const csv = generateMovimentosSampleCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_importacao_movimentos_platfarma.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download do Modelo Excel (.xlsx) de Movimentos
  const handleDownloadMovimentosExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Movimentos');

    worksheet.columns = [
      { header: 'Artigo', key: 'artigo_id', width: 16 },
      { header: 'Sigla', key: 'sigla', width: 10 },
      { header: 'TipoMovimento', key: 'tipo_movimento', width: 16 },
      { header: 'Quantidade', key: 'quantidade', width: 14 },
      { header: 'TipoArmazem', key: 'tipo_armazem', width: 14 },
      { header: 'ArmazemLoc', key: 'armazem_loc', width: 14 },
      { header: 'Posicao', key: 'posicao', width: 14 },
      { header: 'Lote', key: 'lote', width: 16 },
      { header: 'NrSerie', key: 'nr_serie', width: 14 },
      { header: 'Validade', key: 'validade', width: 14 },
      { header: 'DataFabrico', key: 'data_fabrico', width: 14 },
      { header: 'DataMovimento', key: 'data_movimento', width: 16 },
      { header: 'DocumentoRef', key: 'documento_ref', width: 16 },
      { header: 'Observacoes', key: 'observacoes', width: 30 },
    ];

    // Estilo de cabeçalho
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D9488' }, // Teal
    };

    // Linhas de Exemplo
    worksheet.addRow({
      artigo_id: '024273070',
      sigla: 'PFIZ',
      tipo_movimento: 'ES',
      quantidade: 100,
      tipo_armazem: '01',
      armazem_loc: 'PFIZ-01',
      posicao: 'A-01-01',
      lote: 'LOT-2026-01',
      nr_serie: '',
      validade: '2028-12-31',
      data_fabrico: '2026-01-15',
      data_movimento: '2026-09-20',
      documento_ref: 'REC-2026-001',
      observacoes: 'Entrada inicial de lote por recepcao de fabrica',
    });

    worksheet.addRow({
      artigo_id: '024273070',
      sigla: 'PFIZ',
      tipo_movimento: 'SS',
      quantidade: 15,
      tipo_armazem: '01',
      armazem_loc: 'PFIZ-01',
      posicao: 'A-01-01',
      lote: 'LOT-2026-01',
      nr_serie: '',
      validade: '2028-12-31',
      data_fabrico: '2026-01-15',
      data_movimento: '2026-09-21',
      documento_ref: 'EXP-2026-001',
      observacoes: 'Saida para expedicao de encomenda hospitalar',
    });

    worksheet.addRow({
      artigo_id: '024273070',
      sigla: 'PFIZ',
      tipo_movimento: 'ST',
      quantidade: 10,
      tipo_armazem: '01',
      armazem_loc: 'PFIZ-01',
      posicao: 'A-01-01',
      lote: 'LOT-2026-01',
      nr_serie: '',
      validade: '2028-12-31',
      data_fabrico: '2026-01-15',
      data_movimento: '2026-09-22',
      documento_ref: 'TRF-2026-001',
      observacoes: 'Saida por transferencia interna para quarentena',
    });

    worksheet.addRow({
      artigo_id: '024273070',
      sigla: 'PFIZ',
      tipo_movimento: 'ET',
      quantidade: 10,
      tipo_armazem: '05',
      armazem_loc: 'PFIZ-05',
      posicao: 'Q-01-01',
      lote: 'LOT-2026-01',
      nr_serie: '',
      validade: '2028-12-31',
      data_fabrico: '2026-01-15',
      data_movimento: '2026-09-22',
      documento_ref: 'TRF-2026-001',
      observacoes: 'Entrada por transferencia interna em quarentena',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_importacao_movimentos_platfarma.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar Movimentos Registados em CSV
  const handleExportMovimentosCSV = () => {
    if (movimentosList.length === 0) return;

    let csv = 'ID;Artigo;Descricao;Cliente;Sigla;TipoMovimento;Quantidade;TipoArmazem;ArmazemLoc;Posicao;Lote;NrSerie;Validade;DataFabrico;DataMovimento;DocumentoRef;Observacoes\n';
    movimentosList.forEach((m) => {
      csv += `"${m.id}";"${m.artigo_id}";"${(m.artigo_descricao || '').replace(/"/g, '""')}";"${(m.cliente_nome || '').replace(/"/g, '""')}";"${m.sigla || ''}";"${m.tipo_movimento.toUpperCase()}";${m.quantidade};"${m.tipo_armazem}";"${m.armazem_loc}";"${m.posicao || ''}";"${m.lote || ''}";"${m.nr_serie || ''}";"${m.validade || ''}";"${m.data_fabrico || ''}";"${m.data_movimento || ''}";"${m.documento_ref || ''}";"${(m.observacoes || '').replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `movimentos_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // KPIs dos Movimentos
  const totalMovimentosCount = movimentosList.length;
  const countES = useMemo(() => movimentosList.filter((m) => m.tipo_movimento === 'es').length, [movimentosList]);
  const countSS = useMemo(() => movimentosList.filter((m) => m.tipo_movimento === 'ss').length, [movimentosList]);
  const countET = useMemo(() => movimentosList.filter((m) => m.tipo_movimento === 'et').length, [movimentosList]);
  const countST = useMemo(() => movimentosList.filter((m) => m.tipo_movimento === 'st').length, [movimentosList]);
  const totalVolumeMovimentado = useMemo(
    () => movimentosList.reduce((acc, m) => acc + Number(m.quantidade || 0), 0),
    [movimentosList]
  );

  // Filtragem da Lista de Movimentos
  const filteredMovimentos = useMemo(() => {
    return movimentosList.filter((m) => {
      if (movFilterTipo !== 'todos' && m.tipo_movimento !== movFilterTipo) return false;
      if (movFilterClient !== 'todos' && m.client_id !== movFilterClient && m.sigla !== movFilterClient) return false;
      if (movFilterArmazem !== 'todos' && m.tipo_armazem !== movFilterArmazem) return false;

      if (movSearchTerm.trim()) {
        const q = movSearchTerm.toLowerCase();
        const matchArtigo = m.artigo_id.toLowerCase().includes(q);
        const matchDesc = m.artigo_descricao?.toLowerCase().includes(q);
        const matchLote = m.lote?.toLowerCase().includes(q);
        const matchDoc = m.documento_ref?.toLowerCase().includes(q);
        const matchSigla = m.sigla?.toLowerCase().includes(q);
        const matchCliente = m.cliente_nome?.toLowerCase().includes(q);
        return Boolean(matchArtigo || matchDesc || matchLote || matchDoc || matchSigla || matchCliente);
      }

      return true;
    });
  }, [movimentosList, movFilterTipo, movFilterClient, movFilterArmazem, movSearchTerm]);

  // =========================================================================
  // 2. MANIPULAÇÃO DO FICHEIRO DE STOCKS BRUTOS (imp_stk)
  // =========================================================================
  const handleStockFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedStockFile(file);
    setParsingStockLoading(true);
    setFeedback(null);

    try {
      const fileName = file.name.toLowerCase();
      let rows: ImpStkInput[] = [];

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        rows = await parseExcelStockFile(arrayBuffer, file.name);
      } else {
        const textContent = await file.text();
        rows = parseTextStockFile(textContent, file.name);
      }

      if (rows.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Não foram encontradas linhas de dados válidas no ficheiro de stock.',
        });
        setParsedStockRows([]);
      } else {
        setParsedStockRows(rows);
        setFeedback({
          type: 'success',
          message: `Ficheiro de stock analisado! ${rows.length} registos prontos para imp_stk.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro';
      setFeedback({ type: 'error', message: `Erro ao ler ficheiro: ${msg}` });
      setParsedStockRows([]);
    } finally {
      setParsingStockLoading(false);
    }
  };

  const handleConfirmImportStock = async () => {
    if (parsedStockRows.length === 0) return;

    setImportingStockLoading(true);
    setFeedback(null);

    try {
      const CHUNK_SIZE = 300;
      let totalInserted = 0;

      for (let i = 0; i < parsedStockRows.length; i += CHUNK_SIZE) {
        const chunk = parsedStockRows.slice(i, i + CHUNK_SIZE);
        const res = await importarStocksAction(chunk);
        if (!res.success) {
          throw new Error(res.error || `Erro ao importar lote ${Math.floor(i / CHUNK_SIZE) + 1}`);
        }
        totalInserted += res.count || chunk.length;
      }

      setFeedback({
        type: 'success',
        message: `Importação concluída! ${totalInserted} registos gravados na tabela imp_stk.`,
      });

      const newMockItems: ImpStk[] = parsedStockRows.map((r) => ({
        artigo: r.artigo || null,
        descricao: r.descricao || null,
        armazem: r.armazem || null,
        lote: r.lote || null,
        estado_stock: r.estado_stock || 'DISP',
        stk: r.stk || 0,
        datastock: r.datastock || null,
        bloqueado: Boolean(r.bloqueado),
        familia: r.familia || null,
        tipo_artigo: r.tipo_artigo || null,
        sub_familia: r.sub_familia || null,
        created_at: new Date().toISOString(),
      }));

      setImpStkList((prev) => [...newMockItems, ...prev]);
      setSelectedStockFile(null);
      setParsedStockRows([]);
      if (stockFileInputRef.current) stockFileInputRef.current.value = '';

      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado na importação';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setImportingStockLoading(false);
    }
  };

  const handleClearStockTable = async () => {
    setClearingStockLoading(true);
    try {
      const res = await limparImportacoesStockAction();
      if (res.success) {
        setImpStkList([]);
        setFeedback({ type: 'success', message: 'Tabela imp_stk limpa com sucesso.' });
        setConfirmClearStockModal(false);
        if (onRefresh) onRefresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao limpar tabela.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao limpar';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setClearingStockLoading(false);
    }
  };

  const filteredStockList = useMemo(() => {
    if (!stockSearchTerm.trim()) return impStkList;
    const q = stockSearchTerm.toLowerCase();
    return impStkList.filter(
      (r) =>
        r.artigo?.toLowerCase().includes(q) ||
        r.descricao?.toLowerCase().includes(q) ||
        r.armazem?.toLowerCase().includes(q) ||
        r.lote?.toLowerCase().includes(q)
    );
  }, [impStkList, stockSearchTerm]);

  // Renderizador de Badge por Tipo de Movimento
  const renderTipoMovBadge = (tipo: TipoMovimento | string) => {
    const t = String(tipo).toLowerCase();
    switch (t) {
      case 'es':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            ES (Entrada)
          </span>
        );
      case 'ss':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
            SS (Saída)
          </span>
        );
      case 'et':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
            ET (Entr. Transf)
          </span>
        );
      case 'st':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            ST (Saída Transf)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
            {tipo.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between gap-2.5 transition-all shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              {feedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-current hover:opacity-75 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Navegação Secundária da Aba Movimentos */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-surface-container/40 border border-outline-variant/30 rounded-2xl">
        <button
          type="button"
          onClick={() => {
            setSubTab('importar_movimentos');
            setFeedback(null);
          }}
          className={`flex-1 min-w-[180px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'importar_movimentos'
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
          }`}
        >
          <span className="material-symbols-outlined text-base">upload_file</span>
          Importar Ficheiro de Movimentos
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('tabela_movimentos');
            setFeedback(null);
          }}
          className={`flex-1 min-w-[180px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'tabela_movimentos'
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
          }`}
        >
          <span className="material-symbols-outlined text-base">table_view</span>
          Tabela de Movimentos ({totalMovimentosCount})
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('imp_stk');
            setFeedback(null);
          }}
          className={`flex-1 min-w-[180px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'imp_stk'
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
          }`}
        >
          <span className="material-symbols-outlined text-base">inventory_2</span>
          Importação de Stocks (imp_stk - {impStkList.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. SUB-ABA: IMPORTAR FICHEIRO DE MOVIMENTOS PARA A TABELA MOVIMENTOS */}
      {/* ========================================================================= */}
      {subTab === 'importar_movimentos' && (
        <div className="space-y-8">
          {/* Cartão de Upload & Parametrização */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-5">
              <div>
                <h3 className="text-base font-bold font-headline text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">cloud_upload</span>
                  Janela de Importação de Movimentos de Stock
                </h3>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Carregue um ficheiro <strong>Excel (.xlsx / .xls)</strong> ou <strong>CSV (.csv / .txt)</strong> com as transações de stock (Entradas <code>ES</code>, Saídas <code>SS</code>, Entradas de Transferência <code>ET</code> e Saídas de Transferência <code>ST</code>).
                </p>
              </div>

              {/* Botões de Download de Modelos de Exemplo */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadMovimentosExcel}
                  className="px-3 py-1.5 bg-surface border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Descarregar ficheiro modelo em Excel formatado"
                >
                  <span className="material-symbols-outlined text-sm text-emerald-600">table_chart</span>
                  Modelo Excel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMovimentosCSV}
                  className="px-3 py-1.5 bg-surface border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Descarregar ficheiro modelo em CSV com ponto-e-vírgula"
                >
                  <span className="material-symbols-outlined text-sm text-secondary">description</span>
                  Modelo CSV
                </button>
              </div>
            </div>

            {/* Zona de Arraste / Seleção */}
            <div
              onClick={() => movFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                selectedMovFile
                  ? 'border-secondary/60 bg-secondary/5'
                  : 'border-outline-variant/50 hover:border-secondary/40 hover:bg-surface-container/30 bg-surface-container/10'
              }`}
            >
              <input
                ref={movFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleMovFileChange}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-secondary/10 text-secondary mx-auto flex items-center justify-center mb-3 shadow-inner">
                <span className="material-symbols-outlined text-3xl">
                  {selectedMovFile ? 'task_alt' : 'cloud_upload'}
                </span>
              </div>

              {selectedMovFile ? (
                <div>
                  <p className="text-sm font-bold text-on-surface flex items-center justify-center gap-2">
                    <span>{selectedMovFile.name}</span>
                    <span className="text-xs font-mono font-normal text-on-surface-variant">
                      ({(selectedMovFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </p>
                  <p className="text-xs text-emerald-700 font-semibold mt-1">
                    {parsingMovLoading ? 'A analisar estrutura...' : `${parsedMovRows.length} movimentos detetados e prontos`}
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-2">
                    Clique para selecionar outro ficheiro
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs sm:text-sm font-bold text-on-surface">
                    Clique aqui para selecionar o ficheiro ou arraste para esta área
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Formatos suportados: <strong>Excel (.xlsx, .xls)</strong> e <strong>CSV (.csv, .txt)</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Configuração de Fallback de Cliente & Dicas de Mapeamento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-container/30 border border-outline-variant/20 rounded-xl p-3.5 space-y-1.5">
                <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-secondary">business</span>
                  Cliente Padrão (Caso o ficheiro não contenha coluna de Sigla/Cliente):
                </label>
                <select
                  value={selectedDefaultClient}
                  onChange={(e) => setSelectedDefaultClient(e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                >
                  <option value="">-- Mapear automaticamente pela Sigla do Ficheiro --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.sigla} - {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-on-surface-variant">
                  Se o ficheiro contiver a coluna <code>Sigla</code> (ex: <code>PFIZ</code>, <code>NOVA</code>), o cliente será associado automaticamente.
                </p>
              </div>

              <div className="bg-surface-container/30 border border-outline-variant/20 rounded-xl p-3.5 space-y-1 text-xs text-on-surface-variant">
                <p className="font-bold text-on-surface flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                  Tipos de Movimento Suportados:
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1">
                  <div><code>ES</code>: Entrada de Stock</div>
                  <div><code>SS</code>: Saída de Stock</div>
                  <div><code>ET</code>: Entrada de Transferência</div>
                  <div><code>ST</code>: Saída de Transferência</div>
                </div>
              </div>
            </div>

            {/* Pré-visualização dos Movimentos Analisados */}
            {parsedMovRows.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-outline-variant/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-secondary">preview</span>
                      Pré-visualização dos Movimentos ({parsedMovRows.length} registos)
                    </h4>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      A mostrar as primeiras {Math.min(8, parsedMovRows.length)} linhas analisadas do ficheiro.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelMovSelection}
                      disabled={importingMovLoading}
                      className="px-3.5 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 rounded-xl transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmImportMovimentos}
                      disabled={importingMovLoading}
                      className="bg-secondary text-on-secondary hover:bg-secondary/90 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">save</span>
                      {importingMovLoading
                        ? 'A gravar movimentos...'
                        : `Gravar ${parsedMovRows.length} Movimentos na Base de Dados`}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-outline-variant/30 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-container/70 text-on-surface-variant font-semibold text-[10px] uppercase">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Artigo</th>
                        <th className="py-2 px-3">Sigla</th>
                        <th className="py-2 px-3">Tipo Mov.</th>
                        <th className="py-2 px-3 text-right">Qtd</th>
                        <th className="py-2 px-3">Armazém</th>
                        <th className="py-2 px-3">Localização</th>
                        <th className="py-2 px-3">Posição</th>
                        <th className="py-2 px-3">Lote</th>
                        <th className="py-2 px-3">Validade</th>
                        <th className="py-2 px-3">Doc Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 text-on-surface bg-surface-container-lowest font-mono text-[11px]">
                      {parsedMovRows.slice(0, 8).map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-container/20">
                          <td className="py-2 px-3 text-on-surface-variant font-sans">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-secondary">{row.artigo_id}</td>
                          <td className="py-2 px-3 font-bold">
                            {row.sigla || (selectedDefaultClient ? 'Padrão' : '-')}
                          </td>
                          <td className="py-2 px-3 font-sans">{renderTipoMovBadge(row.tipo_movimento)}</td>
                          <td className="py-2 px-3 text-right font-bold text-on-surface">
                            {Number(row.quantidade).toLocaleString('pt-PT')}
                          </td>
                          <td className="py-2 px-3">{row.tipo_armazem || '01'}</td>
                          <td className="py-2 px-3">{row.armazem_loc || '-'}</td>
                          <td className="py-2 px-3">{row.posicao || '-'}</td>
                          <td className="py-2 px-3">{row.lote || '-'}</td>
                          <td className="py-2 px-3 text-on-surface-variant">{formatDateDisplay(row.validade)}</td>
                          <td className="py-2 px-3 font-sans truncate max-w-[120px]">{row.documento_ref || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUB-ABA: TABELA DE MOVIMENTOS (REGISTOS NA BASE DE DADOS) */}
      {/* ========================================================================= */}
      {subTab === 'tabela_movimentos' && (
        <div className="space-y-6">
          {/* KPIs dos Movimentos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 shadow-sm">
              <p className="text-[11px] font-medium text-on-surface-variant">Total Movimentos</p>
              <p className="text-xl font-bold font-headline text-secondary mt-0.5">{totalMovimentosCount}</p>
            </div>

            <div className="bg-surface-container-lowest border border-emerald-200/60 rounded-xl p-4 shadow-sm">
              <p className="text-[11px] font-medium text-emerald-800">Entradas (ES)</p>
              <p className="text-xl font-bold font-headline text-emerald-700 mt-0.5">{countES}</p>
            </div>

            <div className="bg-surface-container-lowest border border-rose-200/60 rounded-xl p-4 shadow-sm">
              <p className="text-[11px] font-medium text-rose-800">Saídas (SS)</p>
              <p className="text-xl font-bold font-headline text-rose-700 mt-0.5">{countSS}</p>
            </div>

            <div className="bg-surface-container-lowest border border-cyan-200/60 rounded-xl p-4 shadow-sm">
              <p className="text-[11px] font-medium text-cyan-800">Entradas Transf. (ET)</p>
              <p className="text-xl font-bold font-headline text-cyan-700 mt-0.5">{countET}</p>
            </div>

            <div className="bg-surface-container-lowest border border-amber-200/60 rounded-xl p-4 shadow-sm">
              <p className="text-[11px] font-medium text-amber-800">Saídas Transf. (ST)</p>
              <p className="text-xl font-bold font-headline text-amber-700 mt-0.5">{countST}</p>
            </div>
          </div>

          {/* Barra de Filtros & Ações */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold font-headline text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">receipt_long</span>
                  Registos na Tabela movimentos ({filteredMovimentos.length})
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Consulta detalhada com isolamento transacional de entradas, saídas e transferências entre armazéns.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Exportar CSV */}
                {movimentosList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportMovimentosCSV}
                    className="px-3 py-1.5 bg-surface border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm text-secondary">download</span>
                    Exportar CSV
                  </button>
                )}

                {/* Limpar Tabela */}
                {movimentosList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearMovModal(true)}
                    disabled={clearingMovLoading}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">delete_sweep</span>
                    Limpar Movimentos
                  </button>
                )}
              </div>
            </div>

            {/* Linha de Controlos de Filtro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-outline-variant/10">
              {/* Pesquisa */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                  search
                </span>
                <input
                  type="text"
                  value={movSearchTerm}
                  onChange={(e) => setMovSearchTerm(e.target.value)}
                  placeholder="Pesquisar artigo, lote, doc..."
                  className="w-full pl-9 pr-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>

              {/* Filtro Tipo de Movimento */}
              <div>
                <select
                  value={movFilterTipo}
                  onChange={(e) => setMovFilterTipo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                >
                  <option value="todos">Todos os Tipos de Movimento</option>
                  <option value="es">ES - Entrada de Stock</option>
                  <option value="ss">SS - Saída de Stock</option>
                  <option value="et">ET - Entrada por Transferência</option>
                  <option value="st">ST - Saída por Transferência</option>
                </select>
              </div>

              {/* Filtro Cliente */}
              <div>
                <select
                  value={movFilterClient}
                  onChange={(e) => setMovFilterClient(e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                >
                  <option value="todos">Todos os Clientes</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.sigla} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro Armazém */}
              <div>
                <select
                  value={movFilterArmazem}
                  onChange={(e) => setMovFilterArmazem(e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                >
                  <option value="todos">Todos os Armazéns</option>
                  {armazens.map((arm) => (
                    <option key={arm.tipo_armazem} value={arm.tipo_armazem}>
                      {arm.tipo_armazem} - {arm.descricao}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tabela de Dados */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-outline-variant/20 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container/80 sticky top-0 z-10 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Sigla</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Artigo</th>
                    <th className="py-2.5 px-3">Descrição</th>
                    <th className="py-2.5 px-3 text-right">Qtd</th>
                    <th className="py-2.5 px-3">Armazém</th>
                    <th className="py-2.5 px-3">Localização</th>
                    <th className="py-2.5 px-3">Posição</th>
                    <th className="py-2.5 px-3">Lote</th>
                    <th className="py-2.5 px-3">Validade</th>
                    <th className="py-2.5 px-3">Doc Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-on-surface bg-surface-container-lowest">
                  {filteredMovimentos.length > 0 ? (
                    filteredMovimentos.map((m) => (
                      <tr key={m.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-on-surface-variant">
                          {formatDateTimeDisplay(m.data_movimento)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-secondary">
                          {m.sigla || m.cliente_sigla || '-'}
                        </td>
                        <td className="py-2.5 px-3">{renderTipoMovBadge(m.tipo_movimento)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-on-surface">{m.artigo_id}</td>
                        <td className="py-2.5 px-3 truncate max-w-[180px]" title={m.artigo_descricao || ''}>
                          {m.artigo_descricao || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-on-surface">
                          {Number(m.quantidade).toLocaleString('pt-PT')}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                            {m.tipo_armazem}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">{m.armazem_loc || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">{m.posicao || '-'}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold">{m.lote || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-on-surface-variant">
                          {formatDateDisplay(m.validade)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] truncate max-w-[120px]" title={m.documento_ref || ''}>
                          {m.documento_ref || '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-4xl text-outline-variant mb-2 block">
                          swap_horiz
                        </span>
                        <p className="text-xs font-semibold">Nenhum movimento encontrado na tabela.</p>
                        <p className="text-[11px] text-on-surface-variant/80 mt-1">
                          Aceda à aba "Importar Ficheiro de Movimentos" para carregar novas transações.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUB-ABA: IMPORTAÇÃO DE STOCKS (imp_stk - INVENTÁRIOS BRUTOS) */}
      {/* ========================================================================= */}
      {subTab === 'imp_stk' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold font-headline text-on-surface mb-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">inventory_2</span>
                  Importação de Stocks Brutos (Tabela imp_stk)
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Carregamento de inventários em formato <strong>TXT (;)</strong> ou <strong>Excel (.xlsx / .csv)</strong> para a tabela de importação <code>imp_stk</code>.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConfirmClearStockModal(true)}
                disabled={clearingStockLoading}
                className="shrink-0 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">delete_sweep</span>
                Limpar Tabela imp_stk
              </button>
            </div>

            {/* Zona de Upload imp_stk */}
            <div
              onClick={() => stockFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                selectedStockFile
                  ? 'border-secondary/60 bg-secondary/5'
                  : 'border-outline-variant/50 hover:border-secondary/40 hover:bg-surface-container/30 bg-surface-container/10'
              }`}
            >
              <input
                ref={stockFileInputRef}
                type="file"
                accept=".txt,.csv,.xlsx,.xls"
                onChange={handleStockFileChange}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-2xl bg-secondary/10 text-secondary mx-auto flex items-center justify-center mb-3 shadow-inner">
                <span className="material-symbols-outlined text-3xl">
                  {selectedStockFile ? 'task_alt' : 'cloud_upload'}
                </span>
              </div>

              {selectedStockFile ? (
                <div>
                  <p className="text-sm font-bold text-on-surface flex items-center justify-center gap-2">
                    <span>{selectedStockFile.name}</span>
                    <span className="text-xs font-mono font-normal text-on-surface-variant">
                      ({(selectedStockFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </p>
                  <p className="text-xs text-emerald-700 font-semibold mt-1">
                    {parsingStockLoading ? 'A processar estrutura...' : `${parsedStockRows.length} linhas detetadas`}
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-2">
                    Clique para escolher outro ficheiro
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs sm:text-sm font-bold text-on-surface">
                    Clique aqui para selecionar o ficheiro de stock ou arraste para esta área
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Formatos suportados: <strong>.txt</strong>, <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Gravação imp_stk */}
            {parsedStockRows.length > 0 && (
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStockFile(null);
                    setParsedStockRows([]);
                    if (stockFileInputRef.current) stockFileInputRef.current.value = '';
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container/60 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImportStock}
                  disabled={importingStockLoading}
                  className="bg-secondary text-on-secondary hover:bg-secondary/90 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  {importingStockLoading ? 'A gravar...' : `Gravar ${parsedStockRows.length} Registos em imp_stk`}
                </button>
              </div>
            )}
          </div>

          {/* Registos imp_stk */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-base font-bold font-headline text-on-surface">
                Registos Existentes em imp_stk ({filteredStockList.length})
              </h3>
              <input
                type="text"
                value={stockSearchTerm}
                onChange={(e) => setStockSearchTerm(e.target.value)}
                placeholder="Pesquisar em imp_stk..."
                className="px-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs"
              />
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-outline-variant/20 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container/80 sticky top-0 z-10 text-on-surface-variant font-semibold text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Artigo</th>
                    <th className="py-2.5 px-3">Descrição</th>
                    <th className="py-2.5 px-3">Armazém</th>
                    <th className="py-2.5 px-3">Lote</th>
                    <th className="py-2.5 px-3 text-right">Stk</th>
                    <th className="py-2.5 px-3">Data Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-on-surface bg-surface-container-lowest">
                  {filteredStockList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-container/20">
                      <td className="py-2 px-3 font-mono font-bold text-secondary">{item.artigo || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[200px]">{item.descricao || '-'}</td>
                      <td className="py-2 px-3 font-mono">{item.armazem || '-'}</td>
                      <td className="py-2 px-3 font-mono">{item.lote || '-'}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{Number(item.stk || 0).toLocaleString('pt-PT')}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-on-surface-variant">{item.datastock || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Limpeza de Movimentos */}
      {confirmClearMovModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">warning</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-on-surface">Limpar Tabela de Movimentos?</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">Esta ação não pode ser revertida.</p>
              </div>
            </div>

            <p className="text-xs text-on-surface leading-relaxed">
              Tem a certeza de que deseja eliminar permanentemente todos os <strong>{totalMovimentosCount} registos</strong> da tabela <code>movimentos</code>? O saldo de stock nas views será recalculado.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearMovModal(false)}
                className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container/60 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearMovimentosTable}
                disabled={clearingMovLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">delete_forever</span>
                {clearingMovLoading ? 'A eliminar...' : 'Sim, Limpar Movimentos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Limpeza de imp_stk */}
      {confirmClearStockModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">warning</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-on-surface">Limpar Tabela imp_stk?</h4>
                <p className="text-xs text-on-surface-variant mt-0.5">Esta ação não pode ser revertida.</p>
              </div>
            </div>

            <p className="text-xs text-on-surface leading-relaxed">
              Tem a certeza de que deseja eliminar permanentemente todos os <strong>{impStkList.length} registos</strong> da tabela <code>imp_stk</code>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearStockModal(false)}
                className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container/60 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearStockTable}
                disabled={clearingStockLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">delete_forever</span>
                {clearingStockLoading ? 'A eliminar...' : 'Sim, Limpar Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
