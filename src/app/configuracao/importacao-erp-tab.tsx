'use client';

import { useState, useMemo, useRef } from 'react';
import { Client } from '@/lib/supabase/types';
import { PlatMovimentoRow, parsePlatMovimentosFile } from '@/lib/parse-erp-file';
import { importarPlatMovimentosAction, limparPlatMovimentosAction } from './actions';

interface ImportacaoErpTabProps {
  clients?: Client[];
  initialCount?: number;
  onRefresh?: () => void;
}

export default function ImportacaoErpTab({
  clients = [],
  initialCount = 0,
  onRefresh,
}: ImportacaoErpTabProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<PlatMovimentoRow[]>([]);
  const [selectedDefaultClient, setSelectedDefaultClient] = useState<string>('');
  const [parsingLoading, setParsingLoading] = useState(false);
  const [importingLoading, setImportingLoading] = useState(false);
  const [clearingLoading, setClearingLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
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

    try {
      const result = await importarPlatMovimentosAction(parsedRows, selectedDefaultClient || undefined);

      if (!result.success) {
        setFeedback({ type: 'error', message: result.error || 'Erro desconhecido na gravação de movimentos ERP.' });
      } else {
        setFeedback({
          type: 'success',
          message: `Importação ERP concluída com sucesso! ${result.count} registos inseridos na tabela plat_movimentos.`,
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

  const filteredPreviewRows = useMemo(() => {
    if (!searchTerm.trim()) return parsedRows.slice(0, 50);
    const q = searchTerm.toLowerCase();
    return parsedRows
      .filter(
        (r) =>
          r.artigo?.toLowerCase().includes(q) ||
          r.descricao?.toLowerCase().includes(q) ||
          r.documento?.toLowerCase().includes(q) ||
          r.lote?.toLowerCase().includes(q) ||
          r.armazem?.toLowerCase().includes(q) ||
          r.localizacao?.toLowerCase().includes(q) ||
          r.chave1?.toLowerCase().includes(q) ||
          r.chave2?.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [parsedRows, searchTerm]);

  // Estatísticas do ficheiro em memória
  const stats = useMemo(() => {
    const totalQtd = parsedRows.reduce((acc, r) => acc + (r.quantidade || 0), 0);
    const totalArtigos = new Set(parsedRows.map((r) => r.artigo).filter(Boolean)).size;
    const totalLotes = new Set(parsedRows.map((r) => r.lote).filter(Boolean)).size;
    const entradas = parsedRows.filter((r) => (r.tipo_movimento || '').toUpperCase() === 'E').length;
    const saidas = parsedRows.filter((r) => (r.tipo_movimento || '').toUpperCase() === 'S').length;

    return { totalQtd, totalArtigos, totalLotes, entradas, saidas };
  }, [parsedRows]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

          <div className="flex items-center gap-2">
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
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.sigla}] {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Input Ficheiro */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Ficheiro ERP (.csv, .txt, .xlsx):
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
                  disabled={importingLoading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-secondary text-on-secondary hover:bg-secondary/90 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {importingLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-secondary border-t-transparent rounded-full animate-spin" />
                      <span>A importar {parsedRows.length} registos...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">cloud_upload</span>
                      <span>Confirmar Importação para plat_movimentos</span>
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
                        <th className="py-2.5 px-3">Linha</th>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Documento</th>
                        <th className="py-2.5 px-3">Artigo</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-3">Armazém</th>
                        <th className="py-2.5 px-3">Localização</th>
                        <th className="py-2.5 px-3">Lote</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3 text-right">Qtd</th>
                        <th className="py-2.5 px-3 text-right">Stk Ant</th>
                        <th className="py-2.5 px-3 text-right">Stk Act</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20 font-mono text-[11px]">
                      {filteredPreviewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-container/30 transition-colors">
                          <td className="py-2 px-3 text-on-surface-variant">{row.num_linha ?? idx + 1}</td>
                          <td className="py-2 px-3">{row.data || '-'}</td>
                          <td className="py-2 px-3 font-semibold text-secondary">{row.documento || '-'}</td>
                          <td className="py-2 px-3 font-bold text-on-surface">{row.artigo || '-'}</td>
                          <td className="py-2 px-3 font-sans truncate max-w-[200px]" title={row.descricao || ''}>
                            {row.descricao || '-'}
                          </td>
                          <td className="py-2 px-3">{row.armazem || '-'}</td>
                          <td className="py-2 px-3 text-on-surface-variant">{row.localizacao || '-'}</td>
                          <td className="py-2 px-3 font-semibold text-purple-700">{row.lote || '-'}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] ${
                                (row.tipo_movimento || '').toUpperCase() === 'E'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {row.tipo_movimento || '-'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-on-surface">
                            {row.quantidade?.toLocaleString() || 0}
                          </td>
                          <td className="py-2 px-3 text-right text-on-surface-variant">
                            {row.stock_anterior?.toLocaleString() || 0}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-indigo-700">
                            {row.stock_actual?.toLocaleString() || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-surface-container/20 px-3 py-2 text-[11px] text-on-surface-variant border-t border-outline-variant/20 flex justify-between items-center">
                  <span>A mostrar {filteredPreviewRows.length} de {parsedRows.length} linhas</span>
                  <span>Delimitador padrão: Ponto e vírgula (;)</span>
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
            Campos Mapeados na Tabela plat_movimentos
          </div>
          <p className="text-xs text-on-surface-variant">
            A tabela suporta todos os 32 campos extraídos dos relatórios de stock e movimentos ERP:
          </p>
          <div className="text-[11px] font-mono bg-surface-container/40 rounded-xl p-3 text-on-surface space-y-1">
            <div><span className="text-indigo-600 font-semibold">Cabeçalho & Doc:</span> num_linha, data, documento, chave1, chave2, ativa</div>
            <div><span className="text-indigo-600 font-semibold">Valores:</span> valor_unitario, valor_adicional, valor_abater</div>
            <div><span className="text-indigo-600 font-semibold">Artigo & Lote:</span> artigo, descricao, tipo_artigo, armazem, localizacao, lote, estado_stock</div>
            <div><span className="text-indigo-600 font-semibold">Movimento & Stock:</span> tipo_movimento (E/S), quantidade, stock_anterior, stock_actual, stock_lot_actual, stock_arm_actual, stock_loc_actual</div>
            <div><span className="text-indigo-600 font-semibold">Famílias:</span> familia, sub_familia, cliente_id, sigla_cliente</div>
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
  );
}
