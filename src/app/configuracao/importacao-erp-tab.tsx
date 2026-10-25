'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Client } from '@/lib/supabase/types';
import { createClient } from '@/lib/supabase/client';
import {
  PlatMovimentoRow,
  parsePlatMovimentosFile,
  generatePlatMovimentosSampleCSV,
  generatePlatMovimentosSampleExcel,
  preparePlatMovimentoForDb,
} from '@/lib/parse-erp-file';
import { importarPlatMovimentosAction, limparPlatMovimentosAction } from './actions';
import ImportacaoFaturasCard from './importacao-faturas-card';

interface ImportacaoErpTabProps {
  clients?: Client[];
  onRefresh?: () => void;
}

export default function ImportacaoErpTab({
  clients = [],
  onRefresh,
}: ImportacaoErpTabProps) {
  const [erpView, setErpView] = useState<'faturas' | 'movimentos'>('faturas');
  const [clientsList, setClientsList] = useState<Client[]>(clients);
  const [existingCount, setExistingCount] = useState<number | null>(null);

  const loadExistingCount = async () => {
    try {
      const supabase = createClient();
      const { count, error } = await supabase
        .from('plat_movimentos')
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

  const [parsedRows, setParsedRows] = useState<PlatMovimentoRow[]>([]);
  const [selectedDefaultClient, setSelectedDefaultClient] = useState<string>('');
  const [parsingLoading, setParsingLoading] = useState(false);
  const [importingLoading, setImportingLoading] = useState(false);
  const [clearingLoading, setClearingLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingLoading(true);
    setFeedback(null);

    try {
      const rows = await parsePlatMovimentosFile(file);

      if (rows.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Não foram encontrados movimentos válidos no ficheiro selecionado. Verifique o cabeçalho e delimitador (;).',
        });
        setParsedRows([]);
      } else {
        setParsedRows(rows);
        setFeedback({
          type: 'success',
          message: `Ficheiro analisado com sucesso! ${rows.length} movimentos detetados e prontos para importação.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro';
      setFeedback({ type: 'error', message: `Erro ao ler ficheiro ERP: ${msg}` });
      setParsedRows([]);
    } finally {
      setParsingLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    setImportingLoading(true);
    setFeedback(null);
    setImportProgress(null);

    try {
      const CHUNK_SIZE = 250;
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

        let chunkCount = chunk.length;

        try {
          const result = await importarPlatMovimentosAction(
            chunk,
            selectedDefaultClient || undefined
          );

          if (result.success) {
            chunkCount = result.count ?? chunk.length;
          } else {
            throw new Error(result.error || `Erro no lote ${chunkIndex}`);
          }
        } catch (actionErr: unknown) {
          const errMsg = actionErr instanceof Error ? actionErr.message : String(actionErr);
          // Se for erro de rede / Failed to fetch / body size limit na Server Action, realiza fallback direto no cliente via Supabase
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
            const preparedBatch = chunk.map((r) =>
              preparePlatMovimentoForDb(r, selectedDefaultClient || undefined)
            );
            const { error: dbErr } = await supabase
              .from('plat_movimentos')
              .upsert(preparedBatch, { onConflict: 'doc_linha' });

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
        message: `Importação ERP concluída com sucesso! ${totalImported} registos gravados na tabela plat_movimentos.`,
      });
      setImportProgress(null);
      setParsedRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadExistingCount();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na importação';
      setFeedback({ type: 'error', message: `Ocorreu um erro: ${msg}` });
    } finally {
      setImportingLoading(false);
      setImportProgress(null);
    }
  };

  const handleClearTable = async () => {
    setClearingLoading(true);
    setFeedback(null);
    try {
      const res = await limparPlatMovimentosAction();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Tabela plat_movimentos limpa com sucesso.',
        });
        setShowClearConfirm(false);
        setParsedRows([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadExistingCount();
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
    const csvContent = generatePlatMovimentosSampleCSV();
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_plat_movimentos_erp.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcelSample = async () => {
    try {
      const blob = await generatePlatMovimentosSampleExcel();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'modelo_plat_movimentos_erp.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar modelo Excel';
      setFeedback({ type: 'error', message: msg });
    }
  };

  const filteredPreviewRows = useMemo(() => {
    if (!searchTerm.trim()) return parsedRows.slice(0, 50);
    const q = searchTerm.toLowerCase();
    return parsedRows
      .filter(
        (r) =>
          r.artigo_id?.toLowerCase().includes(q) ||
          r.artigo_cli?.toLowerCase().includes(q) ||
          r.descricao?.toLowerCase().includes(q) ||
          r.documento?.toLowerCase().includes(q) ||
          r.doc_linha?.toLowerCase().includes(q) ||
          r.cli_primavera?.toLowerCase().includes(q) ||
          r.cliente_ser?.toLowerCase().includes(q) ||
          r.lote?.toLowerCase().includes(q) ||
          r.armazem?.toLowerCase().includes(q) ||
          r.localizacao?.toLowerCase().includes(q) ||
          r.nome?.toLowerCase().includes(q) ||
          r.nomeentrega?.toLowerCase().includes(q) ||
          r.entidade?.toLowerCase().includes(q) ||
          r.chave1?.toLowerCase().includes(q) ||
          r.chave2?.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [parsedRows, searchTerm]);

  // Estatísticas do ficheiro em memória
  const stats = useMemo(() => {
    const totalQtd = parsedRows.reduce((acc, r) => acc + (r.quantidade || 0), 0);
    const totalArtigos = new Set(parsedRows.map((r) => r.artigo_cli || r.artigo_id).filter(Boolean)).size;
    const totalLotes = new Set(parsedRows.map((r) => r.lote).filter(Boolean)).size;
    const entradas = parsedRows.filter((r) => {
      const t = (r.tipo_movimento || r.tipomovimento || '').toUpperCase();
      return t === 'E' || t === 'ES' || t === 'ET';
    }).length;
    const saidas = parsedRows.filter((r) => {
      const t = (r.tipo_movimento || r.tipomovimento || '').toUpperCase();
      return t === 'S' || t === 'SS' || t === 'ST';
    }).length;

    return { totalQtd, totalArtigos, totalLotes, entradas, saidas };
  }, [parsedRows]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sub-navegação da Aba ERP */}
      <div className="bg-surface-container/30 p-1.5 rounded-2xl border border-outline-variant/30 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setErpView('faturas')}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            erpView === 'faturas'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
          }`}
        >
          <span className="material-symbols-outlined text-base">receipt_long</span>
          Faturação (faturas)
        </button>

        <button
          type="button"
          onClick={() => setErpView('movimentos')}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            erpView === 'movimentos'
              ? 'bg-indigo-700 text-white shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
          }`}
        >
          <span className="material-symbols-outlined text-base">dataset</span>
          Movimentos de Stock (plat_movimentos)
        </button>
      </div>

      {erpView === 'faturas' && (
        <ImportacaoFaturasCard clients={clientsList} onRefresh={onRefresh} />
      )}

      {erpView === 'movimentos' && (
        <div className="space-y-6">
          {/* Banner / Card de Informação do Módulo ERP */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">dataset</span>
            </div>
            <div>
              <h3 className="text-base font-bold font-headline text-on-surface flex items-center gap-2">
                Integração ERP & Movimentos de Stock
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  plat_movimentos
                </span>
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Importação e gestão transacional de movimentos extraídos do ERP (Primavera / ERP Central) em formato CSV, TXT ou Excel.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {existingCount !== null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <span className="material-symbols-outlined text-sm">database</span>
                Base de dados: <strong>{existingCount.toLocaleString('pt-PT')}</strong> registos
              </span>
            )}

            <button
              type="button"
              onClick={handleDownloadExcelSample}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all cursor-pointer shadow-2xs"
              title="Descarregar folha de cálculo Excel (.xlsx) modelo com as 42 colunas exatas do perfil ERP"
            >
              <span className="material-symbols-outlined text-sm text-emerald-700">table_view</span>
              Modelo Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={handleDownloadCsvSample}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all cursor-pointer shadow-2xs"
              title="Descarregar ficheiro CSV (.csv) modelo com as 42 colunas delimitadas por ponto e vírgula (;)"
            >
              <span className="material-symbols-outlined text-sm text-indigo-600">download</span>
              Modelo CSV (.csv)
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">delete_sweep</span>
              Limpar Tabela
            </button>
          </div>
        </div>

        {/* Modal de Confirmação de Limpeza */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3 text-rose-700">
                <span className="material-symbols-outlined text-2xl">warning</span>
                <h4 className="text-sm font-bold">Limpar dados de plat_movimentos?</h4>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Esta ação apagará todos os registos existentes na tabela <strong>plat_movimentos</strong> no Supabase. Esta operação é irreversível.
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

        {/* Zona de Upload */}
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Seletor de Cliente Padrão */}
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Associar ao Cliente (Opcional):
              </label>
              <select
                value={selectedDefaultClient}
                onChange={(e) => setSelectedDefaultClient(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-3 py-2 text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/40 cursor-pointer"
              >
                <option value="">-- Deteção automática por Sigla / SubFamília --</option>
                {clientsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.sigla}] {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Input Ficheiro */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Ficheiro ERP (.csv, .txt, .xlsx, .xls):
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={parsingLoading || importingLoading}
                  className="block w-full text-xs text-on-surface-variant file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-secondary/10 file:text-secondary hover:file:bg-secondary/20 file:cursor-pointer border border-outline-variant/40 rounded-xl bg-surface-container-lowest p-1"
                />
              </div>
            </div>
          </div>

          {/* Indicador de Progresso em Lotes */}
          {importProgress && (
            <div className="p-4 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-3 animate-in fade-in shadow-xs">
              <span className="w-4 h-4 border-2 border-indigo-700 border-t-transparent rounded-full animate-spin shrink-0"></span>
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
                {feedback.type === 'success' ? 'check_circle' : feedback.type === 'warning' ? 'warning' : 'error'}
              </span>
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Estado de Leitura */}
          {parsingLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-on-surface-variant">
              <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
              <span>A ler e analisar colunas do ficheiro ERP...</span>
            </div>
          )}

          {/* Estatísticas e Ações de Importação */}
          {parsedRows.length > 0 && !parsingLoading && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-surface-container/40 border border-outline-variant/30 rounded-xl p-3">
                  <div className="text-[10px] uppercase font-bold text-on-surface-variant">Linhas Lidas</div>
                  <div className="text-lg font-bold text-on-surface font-mono mt-0.5">{parsedRows.length}</div>
                </div>
                <div className="bg-surface-container/40 border border-outline-variant/30 rounded-xl p-3">
                  <div className="text-[10px] uppercase font-bold text-on-surface-variant">Artigos Únicos</div>
                  <div className="text-lg font-bold text-indigo-700 font-mono mt-0.5">{stats.totalArtigos}</div>
                </div>
                <div className="bg-surface-container/40 border border-outline-variant/30 rounded-xl p-3">
                  <div className="text-[10px] uppercase font-bold text-on-surface-variant">Lotes Únicos</div>
                  <div className="text-lg font-bold text-purple-700 font-mono mt-0.5">{stats.totalLotes}</div>
                </div>
                <div className="bg-surface-container/40 border border-outline-variant/30 rounded-xl p-3">
                  <div className="text-[10px] uppercase font-bold text-on-surface-variant">Entradas (E)</div>
                  <div className="text-lg font-bold text-emerald-700 font-mono mt-0.5">{stats.entradas}</div>
                </div>
                <div className="bg-surface-container/40 border border-outline-variant/30 rounded-xl p-3">
                  <div className="text-[10px] uppercase font-bold text-on-surface-variant">Saídas (S)</div>
                  <div className="text-lg font-bold text-amber-700 font-mono mt-0.5">{stats.saidas}</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="w-full sm:w-72 relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-sm">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Filtrar pré-visualização..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-container-lowest border border-outline-variant/40 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/40"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importingLoading || parsingLoading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-secondary text-on-secondary hover:bg-secondary/90 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {importingLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-secondary border-t-transparent rounded-full animate-spin" />
                      <span>{importProgress || `A importar ${parsedRows.length} registos...`}</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">cloud_upload</span>
                      <span>Confirmar Importação de {parsedRows.length.toLocaleString('pt-PT')} registos</span>
                    </>
                  )}
                </button>
              </div>

              {/* Tabela de Pré-visualização */}
              <div className="border border-outline-variant/30 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-surface-container text-on-surface-variant text-[11px] font-bold sticky top-0 z-10 border-b border-outline-variant/30">
                      <tr>
                        <th className="py-2.5 px-3">doc_linha (PK)</th>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">cli_primavera</th>
                        <th className="py-2.5 px-3">cliente_ser</th>
                        <th className="py-2.5 px-3">Documento</th>
                        <th className="py-2.5 px-3">Nº Linha</th>
                        <th className="py-2.5 px-3">artigo_cli</th>
                        <th className="py-2.5 px-3">artigo_id</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-3">Armazém</th>
                        <th className="py-2.5 px-3">Localização</th>
                        <th className="py-2.5 px-3">Lote</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3 text-right">Qtd</th>
                        <th className="py-2.5 px-3">Entidade</th>
                        <th className="py-2.5 px-3">Entrega</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20 font-mono text-[11px]">
                      {filteredPreviewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                          <td className="py-2 px-3 font-bold text-indigo-700 whitespace-nowrap">{row.doc_linha || '-'}</td>
                          <td className="py-2 px-3 whitespace-nowrap text-[10px]">{row.data || '-'}</td>
                          <td className="py-2 px-3 font-semibold text-on-surface">{row.cli_primavera || '-'}</td>
                          <td className="py-2 px-3 font-semibold text-secondary whitespace-nowrap">{row.cliente_ser || '-'}</td>
                          <td className="py-2 px-3 text-on-surface whitespace-nowrap">{row.documento || '-'}</td>
                          <td className="py-2 px-3 text-center">{row.num_linha ?? row.numlinha ?? '-'}</td>
                          <td className="py-2 px-3 font-bold text-emerald-700 whitespace-nowrap">{row.artigo_cli || '-'}</td>
                          <td className="py-2 px-3 font-semibold text-on-surface">{row.artigo_id || '-'}</td>
                          <td className="py-2 px-3 font-sans truncate max-w-[180px]" title={row.descricao || ''}>
                            {row.descricao || '-'}
                          </td>
                          <td className="py-2 px-3">{row.armazem || '-'}</td>
                          <td className="py-2 px-3 text-on-surface-variant">{row.localizacao || '-'}</td>
                          <td className="py-2 px-3 font-semibold text-purple-700">{row.lote || '-'}</td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] ${
                                (row.tipo_movimento || row.tipomovimento || '').toUpperCase() === 'E' || (row.tipo_movimento || row.tipomovimento || '').toUpperCase() === 'ES'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {row.tipo_movimento || row.tipomovimento || '-'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-on-surface">
                            {row.quantidade?.toLocaleString() || 0}
                          </td>
                          <td className="py-2 px-3 text-on-surface-variant">{row.entidade || '-'}</td>
                          <td className="py-2 px-3 font-sans truncate max-w-[150px]" title={`${row.nome_entrega || row.nomeentrega || ''} ${row.morada_entrega || row.moradaentrega || ''}`}>
                            {row.nome_entrega || row.nomeentrega || row.localidade_entrega || row.localidadeentrega || row.localidade || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-surface-container/20 px-3 py-2 text-[11px] text-on-surface-variant border-t border-outline-variant/20 flex justify-between items-center">
                  <span>A mostrar {filteredPreviewRows.length} de {parsedRows.length} linhas</span>
                  <span>Perfil Padrão ERP: 43 colunas delimitadas por ponto e vírgula (;) | PK: doc_linha</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cartões Informativos da Estrutura do ERP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-on-surface uppercase tracking-wider">
            <span className="material-symbols-outlined text-indigo-600 text-base">tune</span>
            Campos Mapeados na Tabela plat_movimentos (43 Campos - Perfil ERP)
          </div>
          <p className="text-xs text-on-surface-variant">
            A tabela e os analisadores (.csv, .txt, .xlsx, .xls) acolhem integralmente a estrutura de 43 colunas com Primary Key em <code>doc_linha</code>:
          </p>
          <div className="text-[11px] font-mono bg-surface-container/40 rounded-xl p-3.5 text-on-surface space-y-1.5 divide-y divide-outline-variant/15">
            <div className="pb-1">
              <span className="text-indigo-600 font-bold">1. Documento & Registo (12):</span>{' '}
              <span className="text-on-surface-variant">documento_ref, data, cliente_ser, tipo_movimento, documento, num_linha, doc_linha (PK), chave1, chave2, tipo_doc, num_doc, observacoes</span>
            </div>
            <div className="py-1">
              <span className="text-indigo-600 font-bold">2. Artigo & Rastreabilidade (10):</span>{' '}
              <span className="text-on-surface-variant">descricao, tipo_artigo, armazem, localizacao, lote, quantidade, familia, sub_Familia, data_fabrico, validade</span>
            </div>
            <div className="py-1">
              <span className="text-indigo-600 font-bold">3. Valores Comerciais & Totais (7):</span>{' '}
              <span className="text-on-surface-variant">valor_unitario, valor_adicional, valor_abater, total_iva, total_merc, total_outros, totaldesc</span>
            </div>
            <div className="py-1">
              <span className="text-indigo-600 font-bold">4. Entidade & Faturação (9):</span>{' '}
              <span className="text-on-surface-variant">entidade, requisicao, num_contribuinte, nome, morada, localidade, cod_postal, cod_postal_localidade, pais</span>
            </div>
            <div className="pt-1">
              <span className="text-indigo-600 font-bold">5. Destino de Entrega (5):</span>{' '}
              <span className="text-on-surface-variant">nome_entrega, entidade_entrega, morada_entrega, localidade_entrega, cod_postal_entrega</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-on-surface uppercase tracking-wider">
            <span className="material-symbols-outlined text-secondary text-base">hub</span>
            Sincronização & Integração ERP
          </div>
          <ul className="text-xs text-on-surface-variant space-y-2 list-disc list-inside">
            <li>
              Integração direta com a base de dados centralizada no <strong>Supabase</strong>.
            </li>
            <li>
              Associação inteligente de <strong>cliente_id</strong> com base na Sigla ou SubFamília.
            </li>
            <li>
              Suporte a <strong>Row Level Security (RLS)</strong> com isolamento por cliente e permissões de administrador.
            </li>
            <li>
              Pronto para automação via <strong>Edge Functions</strong> ou Webhooks de ERP.
            </li>
          </ul>
        </div>
      </div>
        </div>
      )}
    </div>
  );
}
