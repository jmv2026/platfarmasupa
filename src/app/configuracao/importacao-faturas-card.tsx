'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Client } from '@/lib/supabase/types';
import { createClient } from '@/lib/supabase/client';
import {
  FaturaRow,
  parseFaturasFile,
  generateFaturasSampleCSV,
  generateFaturasSampleExcel,
} from '@/lib/parse-faturas-file';
import { importarFaturasAction, limparFaturasAction } from './actions';

interface ImportacaoFaturasCardProps {
  clients?: Client[];
  onRefresh?: () => void;
}

export default function ImportacaoFaturasCard({
  clients = [],
  onRefresh,
}: ImportacaoFaturasCardProps) {
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const [existingTotalMerc, setExistingTotalMerc] = useState<number | null>(null);
  const [parsedRows, setParsedRows] = useState<FaturaRow[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsingLoading, setParsingLoading] = useState(false);
  const [importingLoading, setImportingLoading] = useState(false);
  const [clearingLoading, setClearingLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Carregar contagem existente na tabela faturas
  const loadExistingStats = async () => {
    try {
      const supabase = createClient();
      const { count, error } = await supabase
        .from('faturas')
        .select('*', { count: 'exact', head: true });

      if (!error && count !== null) {
        setExistingCount(count);
      }
    } catch {
      // Ignora erro silencioso
    }
  };

  useEffect(() => {
    loadExistingStats();
  }, []);

  const handleProcessFile = async (file: File) => {
    setSelectedFile(file);
    setParsingLoading(true);
    setFeedback(null);
    setImportProgress(null);
    setCurrentPage(1);

    try {
      const rows = await parseFaturasFile(file);

      if (rows.length === 0) {
        setFeedback({
          type: 'error',
          message:
            'Não foram encontradas faturas válidas no ficheiro selecionado. Verifique o cabeçalho com as 27 colunas obrigatórias.',
        });
        setParsedRows([]);
      } else {
        setParsedRows(rows);
        setFeedback({
          type: 'success',
          message: `Ficheiro "${file.name}" analisado com sucesso! ${rows.length} faturas detetadas e prontas para importação.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro';
      setFeedback({ type: 'error', message: `Erro ao ler ficheiro de faturas: ${msg}` });
      setParsedRows([]);
    } finally {
      setParsingLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleProcessFile(file);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    setImportingLoading(true);
    setFeedback(null);
    setImportProgress(null);

    try {
      const CHUNK_SIZE = 150;
      let totalImported = 0;
      const totalChunks = Math.ceil(parsedRows.length / CHUNK_SIZE);

      for (let i = 0; i < parsedRows.length; i += CHUNK_SIZE) {
        const chunk = parsedRows.slice(i, i + CHUNK_SIZE);
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        setImportProgress(
          `A gravar lote ${chunkIndex} de ${totalChunks} (${Math.min(
            i + CHUNK_SIZE,
            parsedRows.length
          )} / ${parsedRows.length} faturas)...`
        );

        let chunkCount = chunk.length;

        try {
          const result = await importarFaturasAction(chunk);

          if (result.success) {
            chunkCount = result.count ?? chunk.length;
          } else {
            throw new Error(result.error || `Erro no lote ${chunkIndex}`);
          }
        } catch (actionErr: unknown) {
          const errMsg = actionErr instanceof Error ? actionErr.message : String(actionErr);
          // Fallback cliente Supabase direto se exceder payload de Server Action
          if (
            errMsg.includes('fetch') ||
            errMsg.includes('Failed') ||
            errMsg.includes('Network') ||
            errMsg.includes('Body exceeded')
          ) {
            console.warn(
              `Lote ${chunkIndex}: fallback para inserção direta via Supabase client (${errMsg})`
            );
            const supabase = createClient();
            const { error: dbErr } = await supabase
              .from('faturas')
              .upsert(chunk, { onConflict: 'documento_ref' });

            if (dbErr) {
              throw new Error(`Erro na gravação (lote ${chunkIndex}): ${dbErr.message}`);
            }
          } else {
            throw actionErr;
          }
        }

        totalImported += chunkCount;
      }

      setFeedback({
        type: 'success',
        message: `Importação de faturas concluída com sucesso! ${totalImported} documentos gravados na tabela faturas.`,
      });
      setImportProgress(null);
      setParsedRows([]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (modalFileInputRef.current) modalFileInputRef.current.value = '';
      setIsModalOpen(false);
      await loadExistingStats();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na importação';
      setFeedback({ type: 'error', message: `Ocorreu um erro ao importar: ${msg}` });
    } finally {
      setImportingLoading(false);
      setImportProgress(null);
    }
  };

  const handleClearTable = async () => {
    setClearingLoading(true);
    setFeedback(null);
    try {
      const res = await limparFaturasAction();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Tabela faturas limpa com sucesso.',
        });
        setShowClearConfirm(false);
        setParsedRows([]);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (modalFileInputRef.current) modalFileInputRef.current.value = '';
        await loadExistingStats();
        if (onRefresh) onRefresh();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Erro ao limpar tabela.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao limpar';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setClearingLoading(false);
    }
  };

  const handleDownloadCsvSample = () => {
    const csvContent = generateFaturasSampleCSV();
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_faturas_erp.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcelSample = async () => {
    try {
      const blob = await generateFaturasSampleExcel();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'modelo_faturas_erp.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar modelo Excel';
      setFeedback({ type: 'error', message: msg });
    }
  };

  // Filtragem na pré-visualização
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return parsedRows;
    const q = searchTerm.toLowerCase();
    return parsedRows.filter(
      (r) =>
        r.documento_ref?.toLowerCase().includes(q) ||
        r.documento?.toLowerCase().includes(q) ||
        r.requisicao?.toLowerCase().includes(q) ||
        r.nome?.toLowerCase().includes(q) ||
        r.entidade?.toLowerCase().includes(q) ||
        r.num_contribuinte?.toLowerCase().includes(q) ||
        r.sigla?.toLowerCase().includes(q) ||
        r.cli_primavera?.toLowerCase().includes(q) ||
        r.cliente_ser?.toLowerCase().includes(q) ||
        r.tipo_doc?.toLowerCase().includes(q)
    );
  }, [parsedRows, searchTerm]);

  // Paginação
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;

  // Estatísticas do ficheiro carregado em memória
  const stats = useMemo(() => {
    let merc = 0;
    let iva = 0;
    let desc = 0;
    let outros = 0;
    let ncCount = 0;
    const clientsSet = new Set<string>();

    parsedRows.forEach((r) => {
      const t = (r.tipo_doc || '').toUpperCase();
      const isCredit = t === 'NC' || t === 'NCE';
      if (isCredit) ncCount++;

      // Documentos NC e NCE são importados com valores negativos nos campos de faturação
      merc += Number(r.total_merc) || 0;
      iva += Number(r.total_iva) || 0;
      desc += Number(r.total_desc) || 0;
      outros += Number(r.total_outros) || 0;

      if (r.sigla) clientsSet.add(r.sigla);
      else if (r.cliente_ser) clientsSet.add(r.cliente_ser);
    });

    const liq = merc - iva - desc;

    return {
      totalDocs: parsedRows.length,
      merc,
      iva,
      desc,
      outros,
      liq,
      ncCount,
      uniqueClients: Array.from(clientsSet),
    };
  }, [parsedRows]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Banner / Card Principal da Faturação ERP */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <h3 className="text-base font-bold font-headline text-on-surface flex items-center gap-2">
                Integração ERP & Faturação
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  tabela faturas
                </span>
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Alimente a tabela de faturas a partir de ficheiros <strong>.txt, .csv, .xlsx</strong> ou <strong>.xls</strong> com os 27 campos oficiais.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {existingCount !== null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                <span className="material-symbols-outlined text-sm">database</span>
                Base de dados: <strong>{existingCount.toLocaleString('pt-PT')}</strong> faturas
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">upload_file</span>
              Janela de Importação
            </button>

            <button
              type="button"
              onClick={handleDownloadExcelSample}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all cursor-pointer shadow-2xs"
              title="Descarregar folha de cálculo Excel (.xlsx) com os 27 campos oficiais"
            >
              <span className="material-symbols-outlined text-sm text-emerald-700">table_view</span>
              Modelo Excel (.xlsx)
            </button>

            <button
              type="button"
              onClick={handleDownloadCsvSample}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all cursor-pointer shadow-2xs"
              title="Descarregar ficheiro CSV (.csv) com os 27 campos delimitados por ponto e vírgula (;)"
            >
              <span className="material-symbols-outlined text-sm text-teal-600">download</span>
              Modelo CSV (.csv)
            </button>

            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer"
              title="Limpar todos os registos da tabela faturas"
            >
              <span className="material-symbols-outlined text-sm">delete_sweep</span>
              Limpar Faturas
            </button>
          </div>
        </div>

        {/* Zona Rápida de Carregamento no Card */}
        <div className="mt-5 space-y-4">
          <div className="border-2 border-dashed border-outline-variant/40 hover:border-teal-500/60 rounded-2xl p-6 text-center transition-colors bg-surface-container/20">
            <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">file_upload</span>
            </div>
            <h4 className="text-sm font-bold text-on-surface">
              Selecione ou arraste o ficheiro de Faturação
            </h4>
            <p className="text-xs text-on-surface-variant mt-1 max-w-lg mx-auto">
              Formatos aceites: <strong>.csv, .txt, .xlsx, .xls</strong> (delimitador <code>;</code> no caso de CSV/TXT). Mapeamento automático dos 27 campos oficiais.
            </p>

            <div className="mt-4 flex items-center justify-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                onChange={handleFileChange}
                disabled={parsingLoading || importingLoading}
                className="hidden"
                id="faturas-card-file-input"
              />
              <label
                htmlFor="faturas-card-file-input"
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">attach_file</span>
                {selectedFile ? 'Substituir Ficheiro' : 'Escolher Ficheiro'}
              </label>

              {parsedRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface-container border border-outline-variant/40 hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  Ver Pré-visualização ({parsedRows.length} faturas)
                </button>
              )}
            </div>

            {selectedFile && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-50 text-teal-800 text-xs font-medium border border-teal-200">
                <span className="material-symbols-outlined text-sm">description</span>
                <span>{selectedFile.name}</span>
                <span className="text-[10px] text-teal-600 font-mono">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}
          </div>

          {/* Indicador de Leitura */}
          {parsingLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-on-surface-variant animate-pulse">
              <div className="w-4 h-4 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
              <span>A analisar colunas e registos do ficheiro de faturas...</span>
            </div>
          )}

          {/* Progresso de Gravação */}
          {importProgress && (
            <div className="p-4 rounded-xl text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-3 animate-in fade-in shadow-xs">
              <span className="w-4 h-4 border-2 border-teal-700 border-t-transparent rounded-full animate-spin shrink-0"></span>
              <span>{importProgress}</span>
            </div>
          )}

          {/* Feedback Toast */}
          {feedback && (
            <div
              className={`p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : feedback.type === 'warning'
                  ? 'bg-amber-50 text-amber-900 border border-amber-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {feedback.type === 'success'
                  ? 'check_circle'
                  : feedback.type === 'warning'
                  ? 'warning'
                  : 'error'}
              </span>
              <span>{feedback.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* JANELA MODAL DE IMPORTAÇÃO DE FATURAS */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl max-w-6xl w-full shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container/30 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-100 text-teal-800 rounded-xl">
                  <span className="material-symbols-outlined text-2xl">receipt_long</span>
                </div>
                <div>
                  <h3 className="text-base font-bold font-headline text-on-surface">
                    Janela de Importação de Faturas ERP
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Alimentação direta da tabela <code>public.faturas</code> (.txt, .csv, .xlsx, .xls)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {/* Barra de seleção rápida de ficheiro dentro da janela */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-surface-container/30 border border-outline-variant/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={parsingLoading || importingLoading}
                    className="hidden"
                    id="modal-faturas-file"
                  />
                  <label
                    htmlFor="modal-faturas-file"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">folder_open</span>
                    {selectedFile ? 'Trocar Ficheiro' : 'Carregar Ficheiro (.csv, .txt, .xlsx, .xls)'}
                  </label>

                  {selectedFile && (
                    <div className="text-xs font-mono font-medium text-on-surface">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadExcelSample}
                    className="text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Modelo .xlsx
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsvSample}
                    className="text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Modelo .csv
                  </button>
                </div>
              </div>

              {/* Indicador de processamento */}
              {parsingLoading && (
                <div className="py-8 text-center text-xs text-on-surface-variant animate-pulse space-y-2">
                  <div className="w-6 h-6 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>A ler e validar dados do ficheiro...</p>
                </div>
              )}

              {/* Estatísticas do ficheiro carregado */}
              {parsedRows.length > 0 && !parsingLoading && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="bg-surface-container/50 border border-outline-variant/30 rounded-xl p-3">
                      <div className="text-[10px] uppercase font-bold text-on-surface-variant">Faturas / Linhas</div>
                      <div className="text-base font-bold text-on-surface font-mono mt-0.5">
                        {stats.totalDocs.toLocaleString('pt-PT')}
                      </div>
                    </div>

                    <div className="bg-surface-container/50 border border-outline-variant/30 rounded-xl p-3">
                      <div className="text-[10px] uppercase font-bold text-on-surface-variant">Total Mercadoria</div>
                      <div className="text-base font-bold text-teal-700 font-mono mt-0.5">
                        {formatCurrency(stats.merc)}
                      </div>
                    </div>

                    <div className="bg-surface-container/50 border border-outline-variant/30 rounded-xl p-3">
                      <div className="text-[10px] uppercase font-bold text-on-surface-variant">Total IVA</div>
                      <div className="text-base font-bold text-amber-700 font-mono mt-0.5">
                        {formatCurrency(stats.iva)}
                      </div>
                    </div>

                    <div className="bg-surface-container/50 border border-outline-variant/30 rounded-xl p-3">
                      <div className="text-[10px] uppercase font-bold text-on-surface-variant">Total Descontos</div>
                      <div className="text-base font-bold text-rose-700 font-mono mt-0.5">
                        {formatCurrency(stats.desc)}
                      </div>
                    </div>

                    <div className="bg-surface-container/50 border border-outline-variant/30 rounded-xl p-3">
                      <div className="text-[10px] uppercase font-bold text-on-surface-variant">Total Líquido</div>
                      <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">
                        {formatCurrency(stats.liq)}
                      </div>
                    </div>

                    <div className="bg-surface-container/50 border border-outline-variant/30 rounded-xl p-3">
                      <div className="text-[10px] uppercase font-bold text-on-surface-variant">Clientes Únicos</div>
                      <div className="text-xs font-bold text-secondary font-mono mt-0.5 truncate">
                        {stats.uniqueClients.join(', ') || 'Auto'}
                      </div>
                    </div>
                  </div>

                  {/* Barra de pesquisa e paginação da tabela */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="w-full sm:w-80 relative">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-sm">
                        search
                      </span>
                      <input
                        type="text"
                        placeholder="Pesquisar por documento, cliente, entidade..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-container-lowest border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-teal-600/40"
                      />
                    </div>

                    <div className="text-xs text-on-surface-variant">
                      A exibir <strong>{paginatedRows.length}</strong> de <strong>{filteredRows.length}</strong> faturas
                    </div>
                  </div>

                  {/* Tabela de Pré-visualização */}
                  <div className="overflow-x-auto border border-outline-variant/30 rounded-xl max-h-[380px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-container/80 text-on-surface-variant font-semibold uppercase tracking-wider text-[11px] sticky top-0 z-10 border-b border-outline-variant/30 backdrop-blur-xs">
                        <tr>
                          <th className="py-2.5 px-3">Documento Ref</th>
                          <th className="py-2.5 px-3">Data</th>
                          <th className="py-2.5 px-3">Tipo</th>
                          <th className="py-2.5 px-3">Nº Doc</th>
                          <th className="py-2.5 px-3">Requisição</th>
                          <th className="py-2.5 px-3">Cliente / Nome</th>
                          <th className="py-2.5 px-3 text-right">Mercadoria</th>
                          <th className="py-2.5 px-3 text-right">IVA</th>
                          <th className="py-2.5 px-3 text-right">Desconto</th>
                          <th className="py-2.5 px-3">Sigla</th>
                          <th className="py-2.5 px-3">Cli Primavera</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10 text-on-surface font-mono">
                        {paginatedRows.map((r, idx) => {
                          const isCredit = r.tipo_doc === 'NC' || r.tipo_doc === 'NCE';
                          return (
                            <tr
                              key={`fat-preview-${r.documento_ref}-${idx}`}
                              className="hover:bg-surface-container/30 transition-colors"
                            >
                              <td className="py-2 px-3 font-bold text-teal-800">{r.documento_ref}</td>
                              <td className="py-2 px-3 text-on-surface-variant">{r.data || '—'}</td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    isCredit
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {r.tipo_doc || 'FA'}
                                </span>
                              </td>
                              <td className="py-2 px-3">{r.num_doc || '—'}</td>
                              <td className="py-2 px-3 font-sans truncate max-w-[120px]">{r.requisicao || '—'}</td>
                              <td className="py-2 px-3 font-sans truncate max-w-[180px] font-medium" title={r.nome || ''}>
                                {r.nome || '—'}
                              </td>
                              <td className={`py-2 px-3 text-right font-bold ${isCredit ? 'text-rose-700' : 'text-on-surface'}`}>
                                {r.total_merc.toFixed(2)}€
                              </td>
                              <td className="py-2 px-3 text-right text-on-surface-variant">{r.total_iva.toFixed(2)}€</td>
                              <td className="py-2 px-3 text-right text-on-surface-variant">{r.total_desc.toFixed(2)}€</td>
                              <td className="py-2 px-3 font-bold text-secondary">{r.sigla || '—'}</td>
                              <td className="py-2 px-3 text-on-surface-variant">{r.cli_primavera || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Controles de Paginação */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-on-surface-variant">
                        Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                          disabled={currentPage === 1}
                          className="px-2.5 py-1 rounded-lg border border-outline-variant/40 hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="px-2.5 py-1 rounded-lg border border-outline-variant/40 hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Seguinte
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 sm:p-6 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container/20 rounded-b-2xl">
              <div className="text-xs text-on-surface-variant">
                {parsedRows.length > 0 ? (
                  <span>
                    Pronto para gravar <strong>{parsedRows.length}</strong> registos na tabela <code>faturas</code>.
                  </span>
                ) : (
                  <span>Selecione um ficheiro com as 27 colunas oficiais para pré-visualizar.</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={importingLoading}
                  className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={parsedRows.length === 0 || importingLoading || parsingLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
                >
                  {importingLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>A gravar...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">cloud_upload</span>
                      <span>Gravar Faturas no Supabase ({parsedRows.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Limpeza */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-rose-700">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h4 className="text-sm font-bold">Limpar dados da tabela faturas?</h4>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Esta ação apagará <strong>todos os registos</strong> existentes na tabela <strong>faturas</strong> no Supabase. Esta operação é irreversível.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                disabled={clearingLoading}
                className="px-4 py-2 text-xs font-medium text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearTable}
                disabled={clearingLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {clearingLoading ? 'A limpar...' : 'Confirmar Limpeza'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
