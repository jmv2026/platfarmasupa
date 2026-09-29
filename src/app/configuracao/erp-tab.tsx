'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import {
  obterResumoErpAction,
  importarErpEntradasAction,
  importarErpSaidasAction,
  limparTabelaErpAction,
  obterStatusSincronizacaoErpAction,
  sincronizarErpAction,
  obterClientesParaSyncAction,
  StatusSincronizacaoErp,
} from './actions';
import {
  PlatEntradaRow,
  PlatSaidaRow,
  parseEntradasFile,
  parseSaidasFile,
} from '@/lib/parse-erp-file';

export default function ErpTab({ onRefresh }: { onRefresh?: () => void }) {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Totais e Registos Atuais
  const [entradasCount, setEntradasCount] = useState(0);
  const [saidasCount, setSaidasCount] = useState(0);
  const [entradasList, setEntradasList] = useState<PlatEntradaRow[]>([]);
  const [saidasList, setSaidasList] = useState<PlatSaidaRow[]>([]);

  // Estados da Janela 1: Importação de Entradas
  const [fileEntradas, setFileEntradas] = useState<File | null>(null);
  const [parsedEntradas, setParsedEntradas] = useState<PlatEntradaRow[]>([]);
  const [parsingEntradasLoading, setParsingEntradasLoading] = useState(false);
  const [importingEntradasLoading, setImportingEntradasLoading] = useState(false);
  const [importProgressEntradas, setImportProgressEntradas] = useState<string | null>(null);
  const [modoEntradas, setModoEntradas] = useState<'adicionar' | 'substituir'>('adicionar');
  const fileInputEntradasRef = useRef<HTMLInputElement>(null);

  // Estados da Janela 2: Importação de Saídas
  const [fileSaidas, setFileSaidas] = useState<File | null>(null);
  const [parsedSaidas, setParsedSaidas] = useState<PlatSaidaRow[]>([]);
  const [parsingSaidasLoading, setParsingSaidasLoading] = useState(false);
  const [importingSaidasLoading, setImportingSaidasLoading] = useState(false);
  const [importProgressSaidas, setImportProgressSaidas] = useState<string | null>(null);
  const [modoSaidas, setModoSaidas] = useState<'adicionar' | 'substituir'>('adicionar');
  const fileInputSaidasRef = useRef<HTMLInputElement>(null);

  // Estados do Processo de Sincronização ERP
  const [syncStatus, setSyncStatus] = useState<StatusSincronizacaoErp | null>(null);
  const [syncStatusLoading, setSyncStatusLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncArtigos, setSyncArtigos] = useState(true);
  const [syncDocVenda, setSyncDocVenda] = useState(true);
  const [syncMovimentos, setSyncMovimentos] = useState(true);
  const [clientsList, setClientsList] = useState<Array<{ id: string; sigla: string; name: string; cli_primavera?: string | null }>>([]);
  const [selectedDefaultClient, setSelectedDefaultClient] = useState<string>('');
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    artigosNovos: number;
    docVendaNovos: number;
    movimentosTotalNovos: number;
    data: string;
  } | null>(null);

  // Sub-aba de visualização das tabelas
  const [viewTab, setViewTab] = useState<'entradas' | 'saidas'>('entradas');
  const [searchEntradas, setSearchEntradas] = useState('');
  const [searchSaidas, setSearchSaidas] = useState('');

  // Carregar dados do Supabase (resumo das tabelas e estado da sincronização)
  const carregarDados = async () => {
    setLoading(true);
    try {
      const [res] = await Promise.all([
        obterResumoErpAction(),
        carregarStatusSync(),
      ]);
      if (res.success) {
        setEntradasCount(res.entradasCount);
        setSaidasCount(res.saidasCount);
        setEntradasList(res.entradasRecentes || []);
        setSaidasList(res.saidasRecentes || []);
      }
    } catch {
      // Ignora erro
    } finally {
      setLoading(false);
    }
  };

  const carregarStatusSync = async () => {
    setSyncStatusLoading(true);
    try {
      const [statusRes, clientsRes] = await Promise.all([
        obterStatusSincronizacaoErpAction(),
        obterClientesParaSyncAction(),
      ]);
      if (statusRes.success && statusRes.status) {
        setSyncStatus(statusRes.status);
      }
      if (clientsRes.success && clientsRes.clients) {
        setClientsList(clientsRes.clients);
        if (clientsRes.clients.length > 0) {
          setSelectedDefaultClient(prev => prev || clientsRes.clients[0].id);
        }
      }
    } catch {
      // Ignora erro
    } finally {
      setSyncStatusLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    carregarStatusSync();
  }, []);

  // Handler Janela 1: Seleção de Ficheiro de Entradas
  const handleSelectFileEntradas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileEntradas(file);
    setParsingEntradasLoading(true);
    setFeedback(null);
    setImportProgressEntradas(null);

    try {
      const rows = await parseEntradasFile(file);
      if (rows.length === 0) {
        setFeedback({ type: 'error', message: 'Nenhum registo de entrada válido detetado no ficheiro selecionado.' });
        setParsedEntradas([]);
      } else {
        setParsedEntradas(rows);
        setFeedback({
          type: 'success',
          message: `Ficheiro de entradas lido com sucesso: ${rows.length} registos prontos para gravação.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro de entradas';
      setFeedback({ type: 'error', message: msg });
      setParsedEntradas([]);
    } finally {
      setParsingEntradasLoading(false);
    }
  };

  // Handler Janela 1: Confirmar Gravação de Entradas em Lotes
  const handleConfirmarEntradas = async () => {
    if (parsedEntradas.length === 0) return;

    setImportingEntradasLoading(true);
    setFeedback(null);
    setImportProgressEntradas('A iniciar preparação para gravação...');

    try {
      if (modoEntradas === 'substituir') {
        setImportProgressEntradas('A limpar registos anteriores de plat_entradas...');
        const limpaRes = await limparTabelaErpAction('plat_entradas');
        if (!limpaRes.success) {
          throw new Error(`Falha ao limpar tabela antes de substituir: ${limpaRes.error}`);
        }
      }

      const CHUNK_SIZE = 500;
      let totalImported = 0;
      const totalChunks = Math.ceil(parsedEntradas.length / CHUNK_SIZE);

      for (let i = 0; i < parsedEntradas.length; i += CHUNK_SIZE) {
        const chunk = parsedEntradas.slice(i, i + CHUNK_SIZE);
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        const currentCount = Math.min(i + CHUNK_SIZE, parsedEntradas.length);
        const pct = Math.round((currentCount / parsedEntradas.length) * 100);

        setImportProgressEntradas(
          `A gravar lote ${chunkIndex} de ${totalChunks} (${currentCount} de ${parsedEntradas.length} registos - ${pct}%)...`
        );

        const res = await importarErpEntradasAction(chunk);
        if (!res.success) {
          throw new Error(res.error || `Erro ao gravar lote ${chunkIndex}`);
        }
        totalImported += res.count || chunk.length;
      }

      setFeedback({
        type: 'success',
        message: `Sucesso! ${totalImported} registos gravados com sucesso na tabela plat_entradas.`,
      });
      setFileEntradas(null);
      setParsedEntradas([]);
      if (fileInputEntradasRef.current) fileInputEntradasRef.current.value = '';
      await carregarDados();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado na gravação';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setImportingEntradasLoading(false);
      setImportProgressEntradas(null);
    }
  };

  // Handler Janela 2: Seleção de Ficheiro de Saídas
  const handleSelectFileSaidas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileSaidas(file);
    setParsingSaidasLoading(true);
    setFeedback(null);
    setImportProgressSaidas(null);

    try {
      const rows = await parseSaidasFile(file);
      if (rows.length === 0) {
        setFeedback({ type: 'error', message: 'Nenhum registo de saída válido detetado no ficheiro selecionado.' });
        setParsedSaidas([]);
      } else {
        setParsedSaidas(rows);
        setFeedback({
          type: 'success',
          message: `Ficheiro de saídas lido com sucesso: ${rows.length} registos prontos para gravação.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro de saídas';
      setFeedback({ type: 'error', message: msg });
      setParsedSaidas([]);
    } finally {
      setParsingSaidasLoading(false);
    }
  };

  // Handler Janela 2: Confirmar Gravação de Saídas em Lotes
  const handleConfirmarSaidas = async () => {
    if (parsedSaidas.length === 0) return;

    setImportingSaidasLoading(true);
    setFeedback(null);
    setImportProgressSaidas('A iniciar preparação para gravação...');

    try {
      if (modoSaidas === 'substituir') {
        setImportProgressSaidas('A limpar registos anteriores de plat_saidas...');
        const limpaRes = await limparTabelaErpAction('plat_saidas');
        if (!limpaRes.success) {
          throw new Error(`Falha ao limpar tabela antes de substituir: ${limpaRes.error}`);
        }
      }

      const CHUNK_SIZE = 500;
      let totalImported = 0;
      const totalChunks = Math.ceil(parsedSaidas.length / CHUNK_SIZE);

      for (let i = 0; i < parsedSaidas.length; i += CHUNK_SIZE) {
        const chunk = parsedSaidas.slice(i, i + CHUNK_SIZE);
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        const currentCount = Math.min(i + CHUNK_SIZE, parsedSaidas.length);
        const pct = Math.round((currentCount / parsedSaidas.length) * 100);

        setImportProgressSaidas(
          `A gravar lote ${chunkIndex} de ${totalChunks} (${currentCount} de ${parsedSaidas.length} registos - ${pct}%)...`
        );

        const res = await importarErpSaidasAction(chunk);
        if (!res.success) {
          throw new Error(res.error || `Erro ao gravar lote ${chunkIndex}`);
        }
        totalImported += res.count || chunk.length;
      }

      setFeedback({
        type: 'success',
        message: `Sucesso! ${totalImported} registos gravados com sucesso na tabela plat_saidas.`,
      });
      setFileSaidas(null);
      setParsedSaidas([]);
      if (fileInputSaidasRef.current) fileInputSaidasRef.current.value = '';
      await carregarDados();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado na gravação';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setImportingSaidasLoading(false);
      setImportProgressSaidas(null);
    }
  };

  // Limpeza direta
  const handleLimparTabela = async (tabela: 'plat_entradas' | 'plat_saidas') => {
    const nome = tabela === 'plat_entradas' ? 'Entradas (plat_entradas)' : 'Saídas (plat_saidas)';
    if (!confirm(`Tem a certeza que deseja limpar todos os registos da tabela ${nome}?`)) return;

    setLoading(true);
    try {
      const res = await limparTabelaErpAction(tabela);
      if (res.success) {
        setFeedback({ type: 'success', message: `Tabela ${nome} limpa com sucesso!` });
        await carregarDados();
        if (onRefresh) onRefresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao limpar' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  // Handler do Processo de Sincronização
  const handleExecutarSincronizacao = async () => {
    if (!syncArtigos && !syncDocVenda && !syncMovimentos) {
      setFeedback({
        type: 'error',
        message: 'Selecione pelo menos um módulo para sincronizar (Artigos, Documentos de Venda ou Movimentos).',
      });
      return;
    }

    setSyncLoading(true);
    setSyncProgress('A processar sincronização na base de dados PostgreSQL...');
    setFeedback(null);

    try {
      const res = await sincronizarErpAction({
        syncArtigos,
        syncDocVenda,
        syncMovimentos,
        defaultClientId: selectedDefaultClient || undefined,
      });

      if (!res.success) {
        throw new Error(res.error || 'Falha na sincronização.');
      }

      setSyncResult({
        artigosNovos: res.artigosNovos ?? 0,
        docVendaNovos: res.docVendaNovos ?? 0,
        movimentosTotalNovos: res.movimentosTotalNovos ?? 0,
        data: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });

      setFeedback({
        type: 'success',
        message: `Sincronização concluída com sucesso! ${res.artigosNovos ?? 0} novos artigos, ${res.docVendaNovos ?? 0} faturas em doc_venda e ${res.movimentosTotalNovos ?? 0} movimentos criados.`,
      });

      await Promise.all([carregarDados(), carregarStatusSync()]);
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na sincronização';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSyncLoading(false);
      setSyncProgress(null);
    }
  };

  // Filtros de busca
  const filteredEntradas = useMemo(() => {
    if (!searchEntradas.trim()) return entradasList;
    const term = searchEntradas.toLowerCase();
    return entradasList.filter(
      r =>
        r.artigo?.toLowerCase().includes(term) ||
        r.descricao?.toLowerCase().includes(term) ||
        r.nome?.toLowerCase().includes(term) ||
        r.lote?.toLowerCase().includes(term) ||
        r.serie?.toLowerCase().includes(term) ||
        String(r.num_doc || '').includes(term)
    );
  }, [entradasList, searchEntradas]);

  const filteredSaidas = useMemo(() => {
    if (!searchSaidas.trim()) return saidasList;
    const term = searchSaidas.toLowerCase();
    return saidasList.filter(
      r =>
        r.artigo?.toLowerCase().includes(term) ||
        r.descricao?.toLowerCase().includes(term) ||
        r.nome?.toLowerCase().includes(term) ||
        r.lote?.toLowerCase().includes(term) ||
        r.serie?.toLowerCase().includes(term) ||
        String(r.num_doc || '').includes(term)
    );
  }, [saidasList, searchSaidas]);

  return (
    <div className="space-y-8">
      {/* Banner Principal */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-2xl">domain</span>
            </div>
            <div>
              <h3 className="text-lg font-bold font-headline text-on-surface">
                {language === 'pt' ? 'Módulo ERP • Importação & Sincronização' : 'Módulo ERP • Importación y Sincronización'}
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Carregamento e sincronização direta de ficheiros TXT, CSV ou Excel (.xlsx, .xls) do ERP Cegid Primavera.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            PostgreSQL 17 Supabase
          </span>
          <div className="relative group">
            <button
              type="button"
              onClick={carregarDados}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-xl bg-lime-400 hover:bg-lime-300 active:bg-lime-500 text-slate-950 font-bold border border-lime-500 text-xs shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={`material-symbols-outlined text-sm text-slate-950 font-medium ${loading ? 'animate-spin' : ''}`}>sync</span>
              Atualizar
            </button>
            {/* Pop-up explicativo ao passar o rato */}
            <div className="pointer-events-none absolute right-0 top-full mt-2 w-72 p-3 bg-neutral-900/95 text-white text-xs rounded-xl shadow-2xl border border-neutral-700/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 z-50">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary text-base shrink-0 mt-0.5">refresh</span>
                <div>
                  <p className="font-bold text-white text-xs mb-0.5">Atualizar Dados ERP</p>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Recarrega as contagens totais, os registos recentes de entradas e saídas e revalida o estado da sincronização em tempo real.
                  </p>
                </div>
              </div>
              <div className="absolute -top-1.5 right-6 w-3 h-3 bg-neutral-900/95 border-t border-l border-neutral-700/60 rotate-45"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span className="material-symbols-outlined text-base">
            {feedback.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {feedback.message}
        </div>
      )}

      {/* ========================================================================= */}
      {/* AS 2 JANELAS DE IMPORTAÇÃO LADO A LADO */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ----------------------------------------------------------------------- */}
        {/* JANELA 1: IMPORTAÇÃO PARA TABELA plat_entradas */}
        {/* ----------------------------------------------------------------------- */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-xl">move_to_inbox</span>
                  <h4 className="text-base font-bold font-headline text-on-surface">
                    Importação de Entradas ERP
                  </h4>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Inserção na tabela <code className="font-mono text-secondary font-bold">public.plat_entradas</code>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20">
                {entradasCount} registos atuais
              </span>
            </div>

            {/* Zona de Drop / Seleção de Arquivo */}
            <div className="border-2 border-dashed border-outline-variant/50 hover:border-secondary/70 rounded-xl p-5 text-center transition-all bg-surface-container-low/40">
              <input
                ref={fileInputEntradasRef}
                type="file"
                accept=".txt,.csv,.tsv,.xlsx,.xls"
                onChange={handleSelectFileEntradas}
                className="hidden"
                id="file-input-entradas"
              />
              <label htmlFor="file-input-entradas" className="cursor-pointer block space-y-2">
                <span className="material-symbols-outlined text-3xl text-secondary mx-auto block">
                  upload_file
                </span>
                <p className="text-xs font-bold text-on-surface">
                  Clique ou arraste o ficheiro de Entradas
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  Formatos aceites: <strong>.txt</strong>, <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong> (UTF-8)
                </p>
              </label>
            </div>

            {/* Painel do Ficheiro Carregado e Pré-visualização */}
            {fileEntradas && (
              <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/30 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="material-symbols-outlined text-secondary text-base">description</span>
                    <span className="font-bold text-on-surface truncate">{fileEntradas.name}</span>
                    <span className="text-[11px] text-on-surface-variant">
                      ({(fileEntradas.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFileEntradas(null);
                      setParsedEntradas([]);
                      if (fileInputEntradasRef.current) fileInputEntradasRef.current.value = '';
                    }}
                    className="text-on-surface-variant hover:text-rose-600 p-1"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>

                {parsingEntradasLoading ? (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant py-2">
                    <span className="material-symbols-outlined text-sm animate-spin text-secondary">progress_activity</span>
                    A processar e validar colunas...
                  </div>
                ) : parsedEntradas.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">task_alt</span>
                        {parsedEntradas.length} linhas detetadas
                      </span>

                      {/* Modo de Gravação */}
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-medium text-on-surface-variant">Modo:</label>
                        <select
                          value={modoEntradas}
                          onChange={e => setModoEntradas(e.target.value as any)}
                          className="text-xs bg-surface border border-outline-variant/40 rounded-lg px-2 py-1"
                        >
                          <option value="adicionar">Adicionar registos</option>
                          <option value="substituir">Substituir tabela (Limpar antes)</option>
                        </select>
                      </div>
                    </div>

                    {/* Amostra das primeiras 3 linhas */}
                    <div className="overflow-x-auto border border-outline-variant/30 rounded-lg max-h-36">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-surface-container-highest text-on-surface-variant font-bold sticky top-0">
                          <tr>
                            <th className="py-1.5 px-2">Data</th>
                            <th className="py-1.5 px-2">Doc</th>
                            <th className="py-1.5 px-2">Fornecedor</th>
                            <th className="py-1.5 px-2">Artigo</th>
                            <th className="py-1.5 px-2">Qtd</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/20 bg-surface">
                          {parsedEntradas.slice(0, 3).map((r, i) => (
                            <tr key={i}>
                              <td className="py-1.5 px-2 font-mono whitespace-nowrap">{r.data ? String(r.data).substring(0, 10) : '-'}</td>
                              <td className="py-1.5 px-2 whitespace-nowrap">{r.tipo_doc} {r.serie}/{r.num_doc}</td>
                              <td className="py-1.5 px-2 truncate max-w-[120px]">{r.nome || r.entidade}</td>
                              <td className="py-1.5 px-2 font-mono">{r.artigo}</td>
                              <td className="py-1.5 px-2 font-mono">{r.quantidade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Progresso de Importação de Entradas */}
            {importProgressEntradas && (
              <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-xl text-xs text-secondary font-medium flex items-center gap-2 animate-pulse">
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                <span>{importProgressEntradas}</span>
              </div>
            )}
          </div>

          {/* Botão de Ação Janela 1 */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleLimparTabela('plat_entradas')}
              disabled={loading || entradasCount === 0 || importingEntradasLoading}
              className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Limpar Tabela
            </button>

            <button
              type="button"
              onClick={handleConfirmarEntradas}
              disabled={parsedEntradas.length === 0 || importingEntradasLoading || parsingEntradasLoading}
              className="px-5 py-2.5 rounded-xl bg-secondary text-on-secondary text-xs sm:text-sm font-bold shadow-md hover:bg-secondary/90 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importingEntradasLoading ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  A gravar na BD...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">cloud_upload</span>
                  Gravar em plat_entradas
                </>
              )}
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* JANELA 2: IMPORTAÇÃO PARA TABELA plat_saidas */}
        {/* ----------------------------------------------------------------------- */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-xl">outbox</span>
                  <h4 className="text-base font-bold font-headline text-on-surface">
                    Importação de Saídas ERP
                  </h4>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Inserção na tabela <code className="font-mono text-secondary font-bold">public.plat_saidas</code>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20">
                {saidasCount} registos atuais
              </span>
            </div>

            {/* Zona de Drop / Seleção de Arquivo */}
            <div className="border-2 border-dashed border-outline-variant/50 hover:border-secondary/70 rounded-xl p-5 text-center transition-all bg-surface-container-low/40">
              <input
                ref={fileInputSaidasRef}
                type="file"
                accept=".txt,.csv,.tsv,.xlsx,.xls"
                onChange={handleSelectFileSaidas}
                className="hidden"
                id="file-input-saidas"
              />
              <label htmlFor="file-input-saidas" className="cursor-pointer block space-y-2">
                <span className="material-symbols-outlined text-3xl text-secondary mx-auto block">
                  upload_file
                </span>
                <p className="text-xs font-bold text-on-surface">
                  Clique ou arraste o ficheiro de Saídas
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  Formatos aceites: <strong>.txt</strong>, <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong> (UTF-8)
                </p>
              </label>
            </div>

            {/* Painel do Ficheiro Carregado e Pré-visualização */}
            {fileSaidas && (
              <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/30 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="material-symbols-outlined text-secondary text-base">description</span>
                    <span className="font-bold text-on-surface truncate">{fileSaidas.name}</span>
                    <span className="text-[11px] text-on-surface-variant">
                      ({(fileSaidas.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFileSaidas(null);
                      setParsedSaidas([]);
                      if (fileInputSaidasRef.current) fileInputSaidasRef.current.value = '';
                    }}
                    className="text-on-surface-variant hover:text-rose-600 p-1"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>

                {parsingSaidasLoading ? (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant py-2">
                    <span className="material-symbols-outlined text-sm animate-spin text-secondary">progress_activity</span>
                    A processar e validar colunas...
                  </div>
                ) : parsedSaidas.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">task_alt</span>
                        {parsedSaidas.length} linhas detetadas
                      </span>

                      {/* Modo de Gravação */}
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-medium text-on-surface-variant">Modo:</label>
                        <select
                          value={modoSaidas}
                          onChange={e => setModoSaidas(e.target.value as any)}
                          className="text-xs bg-surface border border-outline-variant/40 rounded-lg px-2 py-1"
                        >
                          <option value="adicionar">Adicionar registos</option>
                          <option value="substituir">Substituir tabela (Limpar antes)</option>
                        </select>
                      </div>
                    </div>

                    {/* Amostra das primeiras 3 linhas */}
                    <div className="overflow-x-auto border border-outline-variant/30 rounded-lg max-h-36">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-surface-container-highest text-on-surface-variant font-bold sticky top-0">
                          <tr>
                            <th className="py-1.5 px-2">Data</th>
                            <th className="py-1.5 px-2">Doc</th>
                            <th className="py-1.5 px-2">Cliente</th>
                            <th className="py-1.5 px-2">Artigo</th>
                            <th className="py-1.5 px-2">Qtd</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/20 bg-surface">
                          {parsedSaidas.slice(0, 3).map((r, i) => (
                            <tr key={i}>
                              <td className="py-1.5 px-2 font-mono whitespace-nowrap">{r.data ? String(r.data).substring(0, 10) : '-'}</td>
                              <td className="py-1.5 px-2 whitespace-nowrap">{r.tipo_doc} {r.serie}/{r.num_doc}</td>
                              <td className="py-1.5 px-2 truncate max-w-[120px]">{r.nome || r.entidade}</td>
                              <td className="py-1.5 px-2 font-mono">{r.artigo}</td>
                              <td className="py-1.5 px-2 font-mono">{r.quantidade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Progresso de Importação de Saídas */}
            {importProgressSaidas && (
              <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-xl text-xs text-secondary font-medium flex items-center gap-2 animate-pulse">
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                <span>{importProgressSaidas}</span>
              </div>
            )}
          </div>

          {/* Botão de Ação Janela 2 */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleLimparTabela('plat_saidas')}
              disabled={loading || saidasCount === 0 || importingSaidasLoading}
              className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Limpar Tabela
            </button>

            <button
              type="button"
              onClick={handleConfirmarSaidas}
              disabled={parsedSaidas.length === 0 || importingSaidasLoading || parsingSaidasLoading}
              className="px-5 py-2.5 rounded-xl bg-secondary text-on-secondary text-xs sm:text-sm font-bold shadow-md hover:bg-secondary/90 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importingSaidasLoading ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  A gravar na BD...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">cloud_upload</span>
                  Gravar em plat_saidas
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO DO PROCESSO DE SINCRONIZAÇÃO ERP */}
      {/* ========================================================================= */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Cabeçalho da Sincronização */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-secondary/15 flex items-center justify-center text-secondary shadow-sm">
              <span className="material-symbols-outlined text-2xl">sync_alt</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold font-headline text-on-surface">
                  Processo de Sincronização ERP
                </h4>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20">
                  Consolidação Operacional
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                Converte e consolida os registos carregados em <code className="font-mono text-secondary font-bold">plat_entradas</code> e <code className="font-mono text-secondary font-bold">plat_saidas</code> para alimentar o Catálogo de Artigos, Documentos de Venda e Movimentos de Stock.
              </p>
            </div>
          </div>

          <div className="relative group">
            <button
              type="button"
              onClick={carregarStatusSync}
              disabled={syncStatusLoading || syncLoading}
              className="px-3.5 py-2 rounded-xl bg-lime-400 hover:bg-lime-300 active:bg-lime-500 text-slate-950 font-bold border border-lime-500 text-xs shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={`material-symbols-outlined text-sm text-slate-950 font-medium ${syncStatusLoading ? 'animate-spin' : ''}`}>sync</span>
              Verificar Estado
            </button>
            {/* Pop-up explicativo ao passar o rato */}
            <div className="pointer-events-none absolute right-0 top-full mt-2 w-72 p-3 bg-neutral-900/95 text-white text-xs rounded-xl shadow-2xl border border-neutral-700/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 z-50">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary text-base shrink-0 mt-0.5">sync_alt</span>
                <div>
                  <p className="font-bold text-white text-xs mb-0.5">Verificar Estado da Sincronização</p>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Recalcula os novos artigos, documentos de venda e movimentos pendentes de consolidação, atualizando os indicadores.
                  </p>
                </div>
              </div>
              <div className="absolute -top-1.5 right-6 w-3 h-3 bg-neutral-900/95 border-t border-l border-neutral-700/60 rotate-45"></div>
            </div>
          </div>
        </div>

        {/* 3 Cartões de Estado dos Módulos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Artigos */}
          <div className="bg-surface-container-low/50 border border-outline-variant/30 rounded-xl p-4.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">inventory_2</span>
                <span className="text-xs font-bold text-on-surface">Catálogo de Artigos</span>
              </div>
              {syncStatus?.artigos_pendentes === 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Sincronizado
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                  {syncStatus?.artigos_pendentes ?? 0} pendentes
                </span>
              )}
            </div>
            <div className="text-2xl font-bold font-headline text-on-surface">
              {syncStatus?.total_artigos ?? 0}
              <span className="text-xs font-normal text-on-surface-variant ml-1.5">artigos no catálogo</span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              {syncStatus?.artigos_pendentes ?? 0} novos artigos detetados nas compras e vendas do ERP.
            </p>
          </div>

          {/* Card 2: Documentos de Venda */}
          <div className="bg-surface-container-low/50 border border-outline-variant/30 rounded-xl p-4.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">receipt_long</span>
                <span className="text-xs font-bold text-on-surface">Documentos de Venda</span>
              </div>
              {syncStatus?.doc_venda_pendentes === 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Sincronizado
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                  {syncStatus?.doc_venda_pendentes ?? 0} pendentes
                </span>
              )}
            </div>
            <div className="text-2xl font-bold font-headline text-on-surface">
              {syncStatus?.total_doc_venda ?? 0}
              <span className="text-xs font-normal text-on-surface-variant ml-1.5">faturas registadas</span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Tabela operacional <code className="font-mono text-secondary">doc_venda</code> sincronizada com as saídas do ERP.
            </p>
          </div>

          {/* Card 3: Movimentos de Stock */}
          <div className="bg-surface-container-low/50 border border-outline-variant/30 rounded-xl p-4.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">swap_horiz</span>
                <span className="text-xs font-bold text-on-surface">Movimentos de Stock</span>
              </div>
              {syncStatus?.movimentos_pendentes === 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Sincronizado
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                  {syncStatus?.movimentos_pendentes ?? 0} pendentes
                </span>
              )}
            </div>
            <div className="text-2xl font-bold font-headline text-on-surface">
              {syncStatus?.total_movimentos ?? 0}
              <span className="text-xs font-normal text-on-surface-variant ml-1.5">movimentos gerados</span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              {syncStatus?.mov_entradas_pendentes ?? 0} entradas (compras) e {syncStatus?.mov_saidas_pendentes ?? 0} saídas (vendas).
            </p>
          </div>
        </div>

        {/* Painel de Configuração e Execução */}
        <div className="bg-surface-container-low/30 border border-outline-variant/30 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Opção 1: Artigos */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-outline-variant/30 bg-surface cursor-pointer hover:border-secondary/50 transition-all">
              <input
                type="checkbox"
                checked={syncArtigos}
                onChange={e => setSyncArtigos(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-outline-variant text-secondary focus:ring-secondary/40"
              />
              <div>
                <span className="text-xs font-bold text-on-surface block">
                  Sincronizar Artigos
                </span>
                <span className="text-[11px] text-on-surface-variant mt-0.5 block leading-relaxed">
                  Insere ou atualiza os artigos na tabela <code className="font-mono text-secondary">artigos</code> com descrição e tipo de conservação.
                </span>
              </div>
            </label>

            {/* Opção 2: Documentos de Venda */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-outline-variant/30 bg-surface cursor-pointer hover:border-secondary/50 transition-all">
              <input
                type="checkbox"
                checked={syncDocVenda}
                onChange={e => setSyncDocVenda(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-outline-variant text-secondary focus:ring-secondary/40"
              />
              <div>
                <span className="text-xs font-bold text-on-surface block">
                  Documentos de Venda
                </span>
                <span className="text-[11px] text-on-surface-variant mt-0.5 block leading-relaxed">
                  Converte as linhas de faturação de <code className="font-mono text-secondary">plat_saidas</code> para a tabela <code className="font-mono text-secondary">doc_venda</code>.
                </span>
              </div>
            </label>

            {/* Opção 3: Movimentos de Stock */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-outline-variant/30 bg-surface cursor-pointer hover:border-secondary/50 transition-all">
              <input
                type="checkbox"
                checked={syncMovimentos}
                onChange={e => setSyncMovimentos(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-outline-variant text-secondary focus:ring-secondary/40"
              />
              <div>
                <span className="text-xs font-bold text-on-surface block">
                  Movimentos de Stock
                </span>
                <span className="text-[11px] text-on-surface-variant mt-0.5 block leading-relaxed">
                  Gera entradas (<code className="font-mono">es</code>) e saídas (<code className="font-mono">ss</code>) na tabela <code className="font-mono text-secondary">movimentos</code>.
                </span>
              </div>
            </label>
          </div>

          {/* Seleção de Cliente Padrão (Fallback) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-outline-variant/20">
            <div className="flex-1 max-w-md">
              <label className="text-xs font-semibold text-on-surface block mb-1">
                Cliente Padrão (Fallback para movimentos sem sigla direta)
              </label>
              <select
                value={selectedDefaultClient}
                onChange={e => setSelectedDefaultClient(e.target.value)}
                disabled={syncLoading || clientsList.length === 0}
                className="w-full text-xs bg-surface border border-outline-variant/40 rounded-xl px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/40"
              >
                {clientsList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.sigla} • {c.name} {c.cli_primavera ? `(Cód: ${c.cli_primavera})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExecutarSincronizacao}
                disabled={syncLoading || (!syncArtigos && !syncDocVenda && !syncMovimentos)}
                className="px-6 py-3 rounded-xl bg-secondary text-on-secondary text-xs sm:text-sm font-bold shadow-md hover:bg-secondary/90 transition-all flex items-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {syncLoading ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">sync</span>
                    A sincronizar dados...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">cloud_sync</span>
                    Executar Sincronização
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Barra de Progresso durante a sincronização */}
          {syncProgress && (
            <div className="p-3.5 bg-secondary/10 border border-secondary/20 rounded-xl text-xs text-secondary font-medium flex items-center gap-2.5 animate-pulse">
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              <span>{syncProgress}</span>
            </div>
          )}

          {/* Resumo do Último Resultado */}
          {syncResult && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 space-y-2">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-emerald-700">check_circle</span>
                  Última Sincronização Concluída ({syncResult.data})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-emerald-800 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  Artigos adicionados: <strong>{syncResult.artigosNovos}</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  Doc. Venda criados: <strong>{syncResult.docVendaNovos}</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  Movimentos de stock: <strong>{syncResult.movimentosTotalNovos}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO INFERIOR: VISUALIZADOR DE DADOS EXISTENTES */}
      {/* ========================================================================= */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewTab('entradas')}
              className={`py-2 px-4 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 ${
                viewTab === 'entradas'
                  ? 'bg-secondary text-on-secondary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-base">input</span>
              Consultar Entradas ({entradasCount})
            </button>

            <button
              type="button"
              onClick={() => setViewTab('saidas')}
              className={`py-2 px-4 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 ${
                viewTab === 'saidas'
                  ? 'bg-secondary text-on-secondary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-base">output</span>
              Consultar Saídas ({saidasCount})
            </button>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
              search
            </span>
            <input
              type="text"
              placeholder={`Filtrar ${viewTab === 'entradas' ? 'entradas' : 'saídas'}...`}
              value={viewTab === 'entradas' ? searchEntradas : searchSaidas}
              onChange={e =>
                viewTab === 'entradas'
                  ? setSearchEntradas(e.target.value)
                  : setSearchSaidas(e.target.value)
              }
              className="w-full pl-9 pr-3 py-1.5 bg-surface border border-outline-variant/40 rounded-xl text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/20"
            />
          </div>
        </div>

        {/* Tabela de Visualização */}
        <div className="overflow-x-auto border border-outline-variant/30 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-surface-container-low text-on-surface-variant font-bold border-b border-outline-variant/30">
              <tr>
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3">Documento</th>
                <th className="py-2.5 px-3">{viewTab === 'entradas' ? 'Fornecedor' : 'Cliente'}</th>
                <th className="py-2.5 px-3">Artigo</th>
                <th className="py-2.5 px-3">Descrição</th>
                <th className="py-2.5 px-3">Lote</th>
                <th className="py-2.5 px-3">Armazém</th>
                <th className="py-2.5 px-3 text-right">Qtd</th>
                <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                <th className="py-2.5 px-3 text-right">Total Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {viewTab === 'entradas' ? (
                filteredEntradas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-on-surface-variant">
                      {loading ? 'A carregar dados...' : 'Nenhum registo de entrada encontrado.'}
                    </td>
                  </tr>
                ) : (
                  filteredEntradas.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-on-surface-variant">
                        {row.data ? String(row.data).substring(0, 16) : '-'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-secondary font-semibold">
                        {row.tipo_doc} {row.serie}/{row.num_doc}
                      </td>
                      <td className="py-2 px-3 max-w-[150px] truncate" title={row.nome || ''}>
                        {row.nome || row.entidade || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono font-medium">{row.artigo || '-'}</td>
                      <td className="py-2 px-3 max-w-[180px] truncate" title={row.descricao || ''}>
                        {row.descricao || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px]">{row.lote || '-'}</td>
                      <td className="py-2 px-3 font-mono text-[11px]">{row.armazem || '-'}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {row.quantidade !== null && row.quantidade !== undefined ? Number(row.quantidade).toLocaleString() : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-on-surface-variant">
                        {row.prec_unit !== null && row.prec_unit !== undefined ? Number(row.prec_unit).toFixed(2) + ' €' : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-on-surface">
                        {row.total_iliquido !== null && row.total_iliquido !== undefined ? Number(row.total_iliquido).toFixed(2) + ' €' : '-'}
                      </td>
                    </tr>
                  ))
                )
              ) : (
                filteredSaidas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-on-surface-variant">
                      {loading ? 'A carregar dados...' : 'Nenhum registo de saída encontrado.'}
                    </td>
                  </tr>
                ) : (
                  filteredSaidas.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-on-surface-variant">
                        {row.data ? String(row.data).substring(0, 16) : '-'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-secondary font-semibold">
                        {row.tipo_doc} {row.serie}/{row.num_doc}
                      </td>
                      <td className="py-2 px-3 max-w-[150px] truncate" title={row.nome || ''}>
                        {row.nome || row.entidade || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono font-medium">{row.artigo || '-'}</td>
                      <td className="py-2 px-3 max-w-[180px] truncate" title={row.descricao || ''}>
                        {row.descricao || '-'}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px]">{row.lote || '-'}</td>
                      <td className="py-2 px-3 font-mono text-[11px]">{row.armazem || '-'}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {row.quantidade !== null && row.quantidade !== undefined ? Number(row.quantidade).toLocaleString() : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-on-surface-variant">
                        {row.prec_unit !== null && row.prec_unit !== undefined ? Number(row.prec_unit).toFixed(2) + ' €' : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-on-surface">
                        {row.total_iliquido !== null && row.total_iliquido !== undefined ? Number(row.total_iliquido).toFixed(2) + ' €' : '-'}
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
