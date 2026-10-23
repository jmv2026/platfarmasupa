'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Client } from '@/lib/supabase/types';
import { createClient } from '@/lib/supabase/client';
import {
  StockImportRow,
  parseStockFile,
  generateStockSampleCSV,
  generateStockSampleExcel,
} from '@/lib/parse-stock-file';
import { importarStockAction, limparStockAction } from './actions';

interface ImportacaoStockTabProps {
  clients?: Client[];
  onRefresh?: () => void;
}

export default function ImportacaoStockTab({
  clients = [],
  onRefresh,
}: ImportacaoStockTabProps) {
  const [clientsList, setClientsList] = useState<Client[]>(clients);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<StockImportRow[]>([]);
  const [selectedDefaultClient, setSelectedDefaultClient] = useState<string>('');
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
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar contagem existente na tabela stock
  const loadExistingCount = async () => {
    try {
      const supabase = createClient();
      const { count, error } = await supabase
        .from('stock')
        .select('*', { count: 'exact', head: true });
      if (!error && count !== null) {
        setExistingCount(count);
      }
    } catch {
      // Ignora erro silencioso
    }
  };

  useEffect(() => {
    loadExistingCount();
  }, []);

  useEffect(() => {
    if (clients && clients.length > 0) {
      setClientsList(clients);
    } else {
      const supabase = createClient();
      supabase
        .from('clientes')
        .select('*')
        .order('name')
        .then((res: { data: any }) => {
          if (res.data && res.data.length > 0) {
            setClientsList(res.data as Client[]);
          }
        });
    }
  }, [clients]);

  // Manipular seleção e processamento do ficheiro (.xlsx, .xls, .csv, .txt)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setParsingLoading(true);
    setFeedback(null);
    setImportProgress(null);
    setCurrentPage(1);

    try {
      const rows = await parseStockFile(file, selectedDefaultClient || undefined);

      if (rows.length === 0) {
        setFeedback({
          type: 'error',
          message:
            'Não foram encontrados registos válidos no ficheiro. Verifique se o ficheiro possui colunas como Cliente_Ser, Artigo e Armazem.',
        });
        setParsedRows([]);
      } else {
        setParsedRows(rows);
        setFeedback({
          type: 'success',
          message: `Ficheiro analisado com sucesso! ${rows.length} registos de stock prontos para importação.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro';
      setFeedback({ type: 'error', message: `Erro ao ler ficheiro de stock: ${msg}` });
      setParsedRows([]);
    } finally {
      setParsingLoading(false);
    }
  };

  // Re-analisar se o cliente predefinido mudar
  const handleDefaultClientChange = async (newClient: string) => {
    setSelectedDefaultClient(newClient);
    if (selectedFile) {
      setParsingLoading(true);
      try {
        const rows = await parseStockFile(selectedFile, newClient || undefined);
        setParsedRows(rows);
      } catch {
        // Ignora
      } finally {
        setParsingLoading(false);
      }
    }
  };

  // Submeter a gravação das linhas na tabela stock em lotes
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    setImportingLoading(true);
    setFeedback(null);

    try {
      // 1. Limpar tabela de stocks existente antes de iniciar a importação
      setImportProgress('A limpar tabela de stock existente antes de importar...');
      const clearRes = await limparStockAction();
      if (!clearRes.success) {
        throw new Error(clearRes.error || 'Falha ao limpar tabela stock antes de importar.');
      }

      // 2. Gravar os novos registos em lotes
      const CHUNK_SIZE = 500;
      let totalImported = 0;
      const totalChunks = Math.ceil(parsedRows.length / CHUNK_SIZE);

      for (let i = 0; i < parsedRows.length; i += CHUNK_SIZE) {
        const chunk = parsedRows.slice(i, i + CHUNK_SIZE);
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        setImportProgress(
          `A gravar lote ${chunkIndex} de ${totalChunks} (${Math.min(
            i + CHUNK_SIZE,
            parsedRows.length
          )} / ${parsedRows.length} registos)...`
        );

        const result = await importarStockAction(
          chunk,
          selectedDefaultClient || undefined
        );

        if (!result.success) {
          throw new Error(result.error || `Erro no lote ${chunkIndex}`);
        }

        totalImported += result.count || chunk.length;
      }

      setFeedback({
        type: 'success',
        message: `Importação de stock concluída com sucesso! Tabela de stock limpa e ${totalImported.toLocaleString('pt-PT')} novos registos gravados.`,
      });
      setImportProgress(null);
      await loadExistingCount();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gravar registos de stock';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setImportingLoading(false);
      setImportProgress(null);
    }
  };

  // Limpar tabela stock
  const handleClearStock = async () => {
    setClearingLoading(true);
    setFeedback(null);
    try {
      const res = await limparStockAction();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Tabela public.stock limpa com sucesso.',
        });
        setShowClearConfirm(false);
        setParsedRows([]);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadExistingCount();
        if (onRefresh) onRefresh();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Erro ao limpar tabela stock.',
        });
        setShowClearConfirm(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao limpar stock';
      setFeedback({ type: 'error', message: msg });
      setShowClearConfirm(false);
    } finally {
      setClearingLoading(false);
    }
  };

  // Descarregar Modelos de Exemplo
  const handleDownloadSampleCSV = () => {
    const csvContent = generateStockSampleCSV();
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao_stock.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSampleExcel = async () => {
    try {
      const blob = await generateStockSampleExcel();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modelo_importacao_stock.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao gerar modelo Excel:', err);
    }
  };

  // Filtragem da grelha de pré-visualização
  const filteredRows = useMemo(() => {
    if (!searchTerm) return parsedRows;
    const term = searchTerm.toLowerCase();
    return parsedRows.filter(
      (r) =>
        (r.cliente_ser && r.cliente_ser.toLowerCase().includes(term)) ||
        (r.entidade && r.entidade.toLowerCase().includes(term)) ||
        (r.sigla && r.sigla.toLowerCase().includes(term)) ||
        (r.artigo_id && r.artigo_id.toLowerCase().includes(term)) ||
        (r.artigo && r.artigo.toLowerCase().includes(term)) ||
        (r.descricao && r.descricao.toLowerCase().includes(term)) ||
        (r.armazem && r.armazem.toLowerCase().includes(term)) ||
        (r.lote && r.lote.toLowerCase().includes(term)) ||
        (r.localizacao && r.localizacao.toLowerCase().includes(term)) ||
        (r.id && r.id.toLowerCase().includes(term))
    );
  }, [parsedRows, searchTerm]);

  // Estatísticas do ficheiro carregado
  const stats = useMemo(() => {
    const totalLines = parsedRows.length;
    let totalQuantity = 0;
    const clientsSet = new Set<string>();
    const artigosSet = new Set<string>();
    const armazensSet = new Set<string>();

    for (const r of parsedRows) {
      totalQuantity += Number(r.stock) || 0;
      if (r.cliente_ser) clientsSet.add(r.cliente_ser);
      if (r.artigo_id || r.artigo) artigosSet.add(r.artigo_id || r.artigo!);
      if (r.armazem) armazensSet.add(r.armazem);
    }

    return {
      totalLines,
      totalQuantity,
      uniqueClients: clientsSet.size,
      uniqueArtigos: artigosSet.size,
      uniqueArmazens: armazensSet.size,
    };
  }, [parsedRows]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage]);

  return (
    <div className="space-y-6">
      {/* Banner / Cabeçalho Principal */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-5">
          <div>
            <h3 className="text-base font-bold font-headline text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">inventory_2</span>
              Importação para Tabela Stock
            </h3>
            <p className="text-xs text-on-surface-variant mt-1">
              Importe ficheiros nos formatos <strong>.xlsx</strong>, <strong>.xls</strong>,{' '}
              <strong>.csv</strong> ou <strong>.txt</strong> diretamente para a tabela{' '}
              <code className="text-secondary font-mono font-bold">public.stock</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {existingCount !== null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <span className="material-symbols-outlined text-sm">database</span>
                Base de dados:{' '}
                <strong>{existingCount.toLocaleString('pt-PT')}</strong> registos
              </span>
            )}

            <button
              type="button"
              onClick={handleDownloadSampleCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors border border-outline-variant/30 cursor-pointer"
              title="Descarregar ficheiro modelo delimitado por ponto e vírgula"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Modelo CSV
            </button>

            <button
              type="button"
              onClick={handleDownloadSampleExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors border border-emerald-200 cursor-pointer"
              title="Descarregar ficheiro modelo Excel formatado"
            >
              <span className="material-symbols-outlined text-sm">table_view</span>
              Modelo Excel
            </button>

            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors border border-rose-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">delete_sweep</span>
              Limpar Tabela
            </button>
          </div>
        </div>

        {/* Zona de Upload e Seleção de Cliente */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
          <div className="md:col-span-2 space-y-2">
            <label className="block text-xs font-semibold text-on-surface">
              Ficheiro de Stock (.xlsx, .xls, .csv, .txt):
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, .txt"
                onChange={handleFileChange}
                disabled={parsingLoading || importingLoading}
                className="block w-full text-xs text-on-surface-variant file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-secondary file:text-on-secondary hover:file:bg-secondary/90 cursor-pointer border border-outline-variant/40 rounded-xl bg-surface-container/30 p-1"
              />
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setParsedRows([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="p-2 text-on-surface-variant hover:text-rose-600 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                  title="Remover ficheiro"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Campos esperados: <code className="font-mono">id</code> (PK UUID),{' '}
              <code className="font-mono">cliente_ser</code>,{' '}
              <code className="font-mono">Entidade</code>,{' '}
              <code className="font-mono">Sigla</code>,{' '}
              <code className="font-mono">artigo_id</code> (ou artigo),{' '}
              <code className="font-mono">armazem</code>,{' '}
              <code className="font-mono">localizacao</code>,{' '}
              <code className="font-mono">lote</code>,{' '}
              <code className="font-mono">stock</code>,{' '}
              <code className="font-mono">datastock</code>.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-on-surface">
              Cliente Predefinido (opcional):
            </label>
            <select
              value={selectedDefaultClient}
              onChange={(e) => handleDefaultClientChange(e.target.value)}
              className="w-full text-xs bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/40 font-medium"
            >
              <option value="">Detetar automaticamente do ficheiro</option>
              {clientsList.map((c) => (
                <option key={c.id} value={c.sigla}>
                  [{c.sigla}] {c.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-on-surface-variant">
              Usado se a coluna <code className="font-mono">Cliente_Ser</code> vier vazia.
            </p>
          </div>
        </div>

        {/* Feedback Messages */}
        {feedback && (
          <div
            className={`mt-4 p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
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

        {/* Indicador de Progresso em Lote */}
        {importProgress && (
          <div className="mt-4 p-4 rounded-xl text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20 flex items-center gap-3">
            <span className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin"></span>
            <span>{importProgress}</span>
          </div>
        )}

        {/* Cartões de Estatísticas do Ficheiro Carregado */}
        {parsedRows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-6 border-t border-outline-variant/20 mt-6">
            <div className="bg-surface-container/40 border border-outline-variant/30 rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                Total Linhas
              </span>
              <p className="text-base font-bold font-headline text-on-surface mt-0.5">
                {stats.totalLines.toLocaleString('pt-PT')}
              </p>
            </div>
            <div className="bg-surface-container/40 border border-outline-variant/30 rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                Qtd Total Stock
              </span>
              <p className="text-base font-bold font-headline text-secondary mt-0.5">
                {stats.totalQuantity.toLocaleString('pt-PT')}
              </p>
            </div>
            <div className="bg-surface-container/40 border border-outline-variant/30 rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                Clientes
              </span>
              <p className="text-base font-bold font-headline text-on-surface mt-0.5">
                {stats.uniqueClients}
              </p>
            </div>
            <div className="bg-surface-container/40 border border-outline-variant/30 rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                Artigos Únicos
              </span>
              <p className="text-base font-bold font-headline text-on-surface mt-0.5">
                {stats.uniqueArtigos}
              </p>
            </div>
            <div className="bg-surface-container/40 border border-outline-variant/30 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                Armazéns
              </span>
              <p className="text-base font-bold font-headline text-on-surface mt-0.5">
                {stats.uniqueArmazens}
              </p>
            </div>
          </div>
        )}

        {/* Botão de Confirmação da Importação */}
        {parsedRows.length > 0 && (
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-outline-variant/15">
            <p className="text-xs text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-600 text-sm">info</span>
              <span>
                A tabela de stock existente será <strong>limpa previamente</strong> antes da gravação dos novos registos.
              </span>
            </p>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={importingLoading || parsingLoading}
              className="bg-secondary text-on-secondary hover:bg-secondary/90 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {importingLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-on-secondary border-t-transparent rounded-full animate-spin"></span>
                  <span>{importProgress || 'A importar dados...'}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">cloud_upload</span>
                  <span>
                    Confirmar Importação de {parsedRows.length.toLocaleString('pt-PT')}{' '}
                    registos
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Grelha de Pré-visualização dos Registos Lidos */}
      {parsedRows.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-base">preview</span>
                Pré-visualização dos Registos a Importar
              </h4>
              <p className="text-xs text-on-surface-variant">
                Mostrando {filteredRows.length.toLocaleString('pt-PT')} de{' '}
                {parsedRows.length.toLocaleString('pt-PT')} registos encontrados.
              </p>
            </div>

            <div className="relative max-w-xs w-full">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-base">
                search
              </span>
              <input
                type="text"
                placeholder="Pesquisar artigo, lote, cliente..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs bg-surface-container/40 border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-outline-variant/20 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[11px] border-b border-outline-variant/20">
                <tr>
                  <th className="py-2.5 px-3">ID (UUID)</th>
                  <th className="py-2.5 px-3">Cliente_Ser</th>
                  <th className="py-2.5 px-3">Entidade</th>
                  <th className="py-2.5 px-3">Sigla</th>
                  <th className="py-2.5 px-3">Artigo ID</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Armazém</th>
                  <th className="py-2.5 px-3">Localização</th>
                  <th className="py-2.5 px-3">Lote</th>
                  <th className="py-2.5 px-3 text-right">Stock</th>
                  <th className="py-2.5 px-3 text-center">Data Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {paginatedRows.map((r, idx) => (
                  <tr
                    key={`preview-stock-${r.id || idx}`}
                    className="hover:bg-surface-container/30 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono text-[10px] text-on-surface-variant truncate max-w-[120px]" title={r.id}>
                      {r.id || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-secondary">
                      {r.cliente_ser}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-on-surface-variant">
                      {r.entidade || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-primary text-[11px]">
                      {r.sigla || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold">
                      {r.artigo_id || r.artigo}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-xs text-on-surface truncate max-w-[200px]" title={r.descricao || ''}>
                      {r.descricao || '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant font-mono font-medium text-[11px]">
                        {r.armazem}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-on-surface-variant">
                      {r.localizacao || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-[11px]">
                      {r.lote || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      <span
                        className={
                          Number(r.stock) > 0 ? 'text-emerald-700' : 'text-on-surface-variant'
                        }
                      >
                        {Number(r.stock).toLocaleString('pt-PT')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px] text-on-surface-variant">
                      {r.data_stock || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-on-surface-variant">
              <span>
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Seguinte
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Confirmação para Limpar Tabela */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-700">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h4 className="text-base font-bold font-headline">Limpar Tabela Stock</h4>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Tem a certeza de que deseja apagar todos os registos da tabela{' '}
              <code className="font-mono font-bold text-rose-700">public.stock</code>? Esta
              ação é irreversível e removerá todos os saldos de stock atualmente
              armazenados nesta tabela.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                disabled={clearingLoading}
                className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearStock}
                disabled={clearingLoading}
                className="bg-rose-700 text-white hover:bg-rose-800 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {clearingLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>A limpar...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Confirmar e Limpar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
