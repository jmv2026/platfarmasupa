'use client';

import { useState, useMemo, useRef } from 'react';
import { Client } from '@/lib/supabase/types';
import { DocVendaImportInput, parseExcelDocVendaFile } from '@/lib/parse-doc-venda-file';
import { importarDocVendaAction } from './actions';

interface ImportacaoDocVendaTabProps {
  clients?: Client[];
  onRefresh?: () => void;
}

export default function ImportacaoDocVendaTab({
  clients = [],
  onRefresh,
}: ImportacaoDocVendaTabProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<DocVendaImportInput[]>([]);
  const [selectedDefaultClient, setSelectedDefaultClient] = useState<string>('');
  const [parsingLoading, setParsingLoading] = useState(false);
  const [importingLoading, setImportingLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setParsingLoading(true);
    setFeedback(null);

    try {
      const fileName = file.name.toLowerCase();
      let rows: DocVendaImportInput[] = [];

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        rows = await parseExcelDocVendaFile(arrayBuffer, file.name);
      } else {
        throw new Error('Apenas ficheiros Excel (.xlsx, .xls) são suportados para Documentos de Venda.');
      }

      if (rows.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Não foram encontrados documentos válidos no ficheiro selecionado.',
        });
        setParsedRows([]);
      } else {
        setParsedRows(rows);
        setFeedback({
          type: 'success',
          message: `Ficheiro analisado com sucesso! ${rows.length} linhas detetadas prontas para importação.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro';
      setFeedback({ type: 'error', message: `Erro ao ler ficheiro de documentos de venda: ${msg}` });
      setParsedRows([]);
    } finally {
      setParsingLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    setImportingLoading(true);
    setFeedback(null);

    try {
      const result = await importarDocVendaAction(parsedRows, selectedDefaultClient || undefined);

      if (!result.success) {
        setFeedback({ type: 'error', message: result.error || 'Erro desconhecido na gravação.' });
      } else {
        setFeedback({
          type: 'success',
          message: `Importação concluída! ${result.count} registos inseridos em doc_venda.`,
        });
        setParsedRows([]);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (onRefresh) onRefresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro no envio';
      setFeedback({ type: 'error', message: `Ocorreu um erro: ${msg}` });
    } finally {
      setImportingLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-110" />

        <div className="flex items-center gap-3 mb-6 relative">
          <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl shadow-inner">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Importar Documentos de Venda (Excel)</h2>
        </div>

        <div className="space-y-4 relative">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Ficheiro Excel (.xlsx)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors file:cursor-pointer border border-slate-200 rounded-xl p-1 bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Cliente a Associar (Fallback)
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Os documentos serão associados ao utilizador atual. Se for Administrador ou Gestor e o cliente não vier no ficheiro, selecione um cliente abaixo:
            </p>
            <select
              value={selectedDefaultClient}
              onChange={(e) => setSelectedDefaultClient(e.target.value)}
              className="w-full sm:w-1/2 p-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            >
              <option value="">-- Automático / Selecione um cliente --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.sigla} - {c.name}
                </option>
              ))}
            </select>
          </div>

          {parsingLoading && (
            <p className="text-sm text-blue-600 animate-pulse font-medium">A analisar ficheiro Excel...</p>
          )}

          {feedback && (
            <div
              className={`p-4 rounded-xl text-sm border flex items-start gap-3 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                  : 'bg-red-50 text-red-700 border-red-200/50'
              }`}
            >
              {feedback.type === 'success' ? (
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleConfirmImport}
              disabled={parsedRows.length === 0 || importingLoading}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center min-w-[140px] shadow-sm ${
                parsedRows.length === 0 || importingLoading
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow hover:-translate-y-0.5 active:translate-y-0'
              }`}
            >
              {importingLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  A gravar...
                </span>
              ) : (
                'Importar para a Base de Dados'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
