'use client';

import { useState, useMemo, useRef } from 'react';
import { ImpStk, ImpStkInput } from '@/lib/supabase/types';
import { parseTextStockFile, parseExcelStockFile } from '@/lib/parse-stock-file';
import { importarStocksAction, limparImportacoesStockAction } from './actions';

interface ImportacaoMovimentosTabProps {
  initialImpStk: ImpStk[];
  onRefresh?: () => void;
}

export default function ImportacaoMovimentosTab({
  initialImpStk,
  onRefresh,
}: ImportacaoMovimentosTabProps) {
  const [impStkList, setImpStkList] = useState<ImpStk[]>(initialImpStk);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ImpStkInput[]>([]);
  const [parsingLoading, setParsingLoading] = useState(false);
  const [importingLoading, setImportingLoading] = useState(false);
  const [clearingLoading, setClearingLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmClearModal, setConfirmClearModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manipular seleção e leitura do ficheiro (.txt, .csv, .xlsx, .xls)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setParsingLoading(true);
    setFeedback(null);

    try {
      const fileName = file.name.toLowerCase();
      let rows: ImpStkInput[] = [];

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        rows = await parseExcelStockFile(arrayBuffer, file.name);
      } else {
        // .txt ou .csv
        const textContent = await file.text();
        rows = parseTextStockFile(textContent, file.name);
      }

      if (rows.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Não foram encontradas linhas de dados válidas no ficheiro selecionado.',
        });
        setParsedRows([]);
      } else {
        setParsedRows(rows);
        setFeedback({
          type: 'success',
          message: `Ficheiro analisado com sucesso! ${rows.length} registos prontos para importação.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar ficheiro';
      setFeedback({ type: 'error', message: `Erro ao ler ficheiro: ${msg}` });
      setParsedRows([]);
    } finally {
      setParsingLoading(false);
    }
  };

  // Submeter a gravação das linhas na tabela imp_stk
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    setImportingLoading(true);
    setFeedback(null);

    try {
      const res = await importarStocksAction(parsedRows);

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Importação concluída com sucesso! ${res.count} registos gravados na tabela imp_stk.`,
        });

        // Adicionar localmente à lista para visualização imediata
        const newMockItems: ImpStk[] = parsedRows.map((r) => ({
          artigo: r.artigo || null,
          descricao: r.descricao || null,
          armazem: r.armazem || null,
          lote: r.lote || null,
          estado_stock: r.estado_stock || 'DISP',
          stk: r.stk || 0,
          data_stock: r.data_stock || null,
          bloqueado: r.bloqueado || '0',
          familia: r.familia || null,
          tipo_artigo: r.tipo_artigo || null,
          sub_familia: r.sub_familia || null,
          filename: r.filename || null,
          created_at: new Date().toISOString(),
        }));

        setImpStkList((prev) => [...newMockItems, ...prev]);
        setSelectedFile(null);
        setParsedRows([]);
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (onRefresh) onRefresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao importar registos.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado na importação';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setImportingLoading(false);
    }
  };

  // Limpar a seleção atual
  const handleCancelSelection = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setFeedback(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Limpar todos os registos da tabela imp_stk
  const handleClearTable = async () => {
    setClearingLoading(true);
    try {
      const res = await limparImportacoesStockAction();
      if (res.success) {
        setImpStkList([]);
        setFeedback({ type: 'success', message: 'Tabela imp_stk limpa com sucesso.' });
        setConfirmClearModal(false);
        if (onRefresh) onRefresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao limpar tabela.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao limpar';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setClearingLoading(false);
    }
  };

  // Exportar dados atuais de imp_stk em CSV
  const handleExportCSV = () => {
    if (impStkList.length === 0) return;

    let csv = 'Artigo;Descricao;Armazem;Lote;EstadoStock;Stk;DataStock;Bloqueado;Familia;TipoArtigo;SubFamilia;Ficheiro;DataImportacao\n';
    impStkList.forEach((r) => {
      csv += `"${r.artigo || ''}";"${(r.descricao || '').replace(/"/g, '""')}";"${r.armazem || ''}";"${r.lote || ''}";"${r.estado_stock || ''}";${r.stk};"${r.data_stock || ''}";"${r.bloqueado || ''}";"${r.familia || ''}";"${r.tipo_artigo || ''}";"${r.sub_familia || ''}";"${r.filename || ''}";"${r.created_at || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `imp_stk_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // KPIs de imp_stk
  const totalRegistos = impStkList.length;
  const totalStockVolume = useMemo(() => {
    return impStkList.reduce((acc, curr) => acc + Number(curr.stk || 0), 0);
  }, [impStkList]);

  const artigosDistintos = useMemo(() => {
    const set = new Set<string>();
    impStkList.forEach((r) => {
      if (r.artigo) set.add(r.artigo);
    });
    return set.size;
  }, [impStkList]);

  const armazensDistintos = useMemo(() => {
    const set = new Set<string>();
    impStkList.forEach((r) => {
      if (r.armazem) set.add(r.armazem);
    });
    return Array.from(set);
  }, [impStkList]);

  // Filtragem de registos por termo de busca
  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return impStkList;
    const q = searchTerm.toLowerCase();
    return impStkList.filter(
      (r) =>
        r.artigo?.toLowerCase().includes(q) ||
        r.descricao?.toLowerCase().includes(q) ||
        r.armazem?.toLowerCase().includes(q) ||
        r.lote?.toLowerCase().includes(q) ||
        r.familia?.toLowerCase().includes(q) ||
        r.sub_familia?.toLowerCase().includes(q) ||
        r.filename?.toLowerCase().includes(q)
    );
  }, [impStkList, searchTerm]);

  return (
    <div className="space-y-8">
      {/* Feedback Toast */}
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

      {/* Janela de Importação de Stocks */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold font-headline text-on-surface mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">upload_file</span>
              Janela de Importação de Stocks (Tabela imp_stk)
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Selecione ou arraste um ficheiro de stock em formato <strong>TXT</strong> (delimitado por ponto-e-vírgula <code>;</code>) ou <strong>Excel (.xlsx / .csv)</strong> para carregar na tabela <code>imp_stk</code>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setConfirmClearModal(true)}
            disabled={clearingLoading}
            className="shrink-0 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Limpar todos os dados armazenados na tabela imp_stk"
          >
            <span className="material-symbols-outlined text-base">delete_sweep</span>
            Limpar Dados de Stock
          </button>
        </div>

        {/* Zona de Upload / Drag & Drop */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            selectedFile
              ? 'border-secondary/60 bg-secondary/5'
              : 'border-outline-variant/50 hover:border-secondary/40 hover:bg-surface-container/30 bg-surface-container/10'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-14 h-14 rounded-2xl bg-secondary/10 text-secondary mx-auto flex items-center justify-center mb-3 shadow-inner">
            <span className="material-symbols-outlined text-3xl">
              {selectedFile ? 'task_alt' : 'cloud_upload'}
            </span>
          </div>

          {selectedFile ? (
            <div>
              <p className="text-sm font-bold text-on-surface flex items-center justify-center gap-2">
                <span>{selectedFile.name}</span>
                <span className="text-xs font-mono font-normal text-on-surface-variant">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </p>
              <p className="text-xs text-emerald-700 font-semibold mt-1">
                {parsingLoading ? 'A processar estrutura...' : `${parsedRows.length} linhas detetadas`}
              </p>
              <p className="text-[11px] text-on-surface-variant mt-2">
                Clique para escolher outro ficheiro
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs sm:text-sm font-bold text-on-surface">
                Clique aqui para selecionar o ficheiro ou arraste para esta área
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                Formatos suportados: <strong>.txt</strong>, <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong>
              </p>
            </div>
          )}
        </div>

        {/* Formato de Campos Suportado */}
        <div className="bg-surface-container/40 border border-outline-variant/20 rounded-xl p-3.5 text-xs text-on-surface-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-on-surface">Estrutura esperada: </span>
            <code className="text-[11px] text-secondary font-mono">
              Artigo; Descricao; Armazem; Lote; EstadoStock; Stk; DataStock; Bloqueado; Familia; TipoArtigo; SubFamilia
            </code>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded shrink-0">
            <span className="material-symbols-outlined text-xs">auto_fix_high</span>
            Mapeamento Automático
          </span>
        </div>

        {/* Pré-visualização das Primeiras Linhas & Botão de Gravação */}
        {parsedRows.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-outline-variant/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-secondary">visibility</span>
                  Pré-visualização dos Dados ({parsedRows.length} registos)
                </h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  A mostrar as primeiras {Math.min(5, parsedRows.length)} linhas analisadas do ficheiro.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelSelection}
                  disabled={importingLoading}
                  className="px-3.5 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importingLoading}
                  className="bg-secondary text-on-secondary hover:bg-secondary/90 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  {importingLoading
                    ? 'A gravar na tabela...'
                    : `Gravar ${parsedRows.length} Registos em imp_stk`}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-outline-variant/30 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container/70 text-on-surface-variant font-semibold text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Artigo</th>
                    <th className="py-2 px-3">Descrição</th>
                    <th className="py-2 px-3">Armazém</th>
                    <th className="py-2 px-3">Lote</th>
                    <th className="py-2 px-3">Estado</th>
                    <th className="py-2 px-3 text-right">Stk</th>
                    <th className="py-2 px-3">Data Stock</th>
                    <th className="py-2 px-3">Família</th>
                    <th className="py-2 px-3">Sub-Família</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-on-surface bg-surface-container-lowest font-mono text-[11px]">
                  {parsedRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-surface-container/20">
                      <td className="py-2 px-3 text-on-surface-variant font-sans">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-secondary">{row.artigo}</td>
                      <td className="py-2 px-3 font-sans truncate max-w-[180px]">{row.descricao}</td>
                      <td className="py-2 px-3 font-bold">{row.armazem}</td>
                      <td className="py-2 px-3">{row.lote || '-'}</td>
                      <td className="py-2 px-3 text-[10px]">{row.estado_stock}</td>
                      <td className="py-2 px-3 text-right font-bold text-on-surface">
                        {row.stk?.toLocaleString('pt-PT')}
                      </td>
                      <td className="py-2 px-3 text-on-surface-variant">{row.data_stock || '-'}</td>
                      <td className="py-2 px-3">{row.familia || '-'}</td>
                      <td className="py-2 px-3">{row.sub_familia || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* KPIs da Tabela imp_stk */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Registos em imp_stk</p>
              <p className="text-2xl font-bold font-headline text-secondary mt-1">{totalRegistos}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-xl">database</span>
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">table_rows</span>
            Total de linhas importadas
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Volume Total Stk</p>
              <p className="text-2xl font-bold font-headline text-on-surface mt-1">
                {totalStockVolume.toLocaleString('pt-PT')}{' '}
                <span className="text-xs font-normal text-on-surface-variant">un</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">inventory_2</span>
            </div>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">sum</span>
            Soma da coluna Stk
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Artigos Distintos</p>
              <p className="text-2xl font-bold font-headline text-on-surface mt-1">{artigosDistintos}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined text-xl">medication</span>
            </div>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">check_circle</span>
            Códigos únicos importados
          </p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-on-surface-variant">Armazéns Identificados</p>
              <p className="text-2xl font-bold font-headline text-on-surface mt-1">
                {armazensDistintos.length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-700">
              <span className="material-symbols-outlined text-xl">warehouse</span>
            </div>
          </div>
          <p className="text-[11px] text-indigo-700 font-medium mt-3 truncate">
            {armazensDistintos.length > 0 ? armazensDistintos.join(', ') : 'Nenhum'}
          </p>
        </div>
      </div>

      {/* Tabela de Registos da Tabela imp_stk */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold font-headline text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">list_alt</span>
              Registos Existentes na Tabela imp_stk ({filteredList.length})
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Dados consolidados provenientes das importações de ficheiros TXT / Excel.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Barra de Pesquisa */}
            <div className="relative min-w-[220px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar em imp_stk..."
                className="w-full pl-9 pr-3 py-1.5 bg-surface border border-outline-variant/40 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>

            {/* Exportar CSV */}
            {impStkList.length > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-surface border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-secondary">download</span>
                Exportar CSV
              </button>
            )}

            {/* Limpar Tabela */}
            {impStkList.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearModal(true)}
                disabled={clearingLoading}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">delete_sweep</span>
                Limpar Tabela
              </button>
            )}
          </div>
        </div>

        {/* Tabela de Dados */}
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-outline-variant/20 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container/80 sticky top-0 z-10 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Artigo</th>
                <th className="py-2.5 px-3">Descrição</th>
                <th className="py-2.5 px-3">Armazém</th>
                <th className="py-2.5 px-3">Lote</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 text-right">Stk</th>
                <th className="py-2.5 px-3">Data Stock</th>
                <th className="py-2.5 px-3">Bloq.</th>
                <th className="py-2.5 px-3">Família</th>
                <th className="py-2.5 px-3">Sub-Família</th>
                <th className="py-2.5 px-3">Ficheiro Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-on-surface bg-surface-container-lowest">
              {filteredList.length > 0 ? (
                filteredList.map((item, idx) => (
                  <tr key={`${item.artigo || ''}-${item.lote || ''}-${item.armazem || ''}-${item.data_stock || ''}-${idx}`} className="hover:bg-surface-container/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-secondary">{item.artigo || '-'}</td>
                    <td className="py-2.5 px-3 font-medium truncate max-w-[200px]" title={item.descricao || ''}>
                      {item.descricao || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/10 text-secondary">
                        {item.armazem || '-'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold">{item.lote || '-'}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {item.estado_stock || 'DISP'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-on-surface">
                      {Number(item.stk || 0).toLocaleString('pt-PT')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-on-surface-variant">
                      {item.data_stock || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.bloqueado === '1' || item.bloqueado === 'true'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.bloqueado || '0'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-on-surface-variant">{item.familia || '-'}</td>
                    <td className="py-2.5 px-3 font-medium text-on-surface-variant">{item.sub_familia || '-'}</td>
                    <td className="py-2.5 px-3 text-on-surface-variant text-[11px] truncate max-w-[150px]" title={item.filename || ''}>
                      {item.filename || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl text-outline-variant mb-2 block">
                      inventory_2
                    </span>
                    <p className="text-xs font-semibold">Nenhum registo encontrado na tabela imp_stk.</p>
                    <p className="text-[11px] text-on-surface-variant/80 mt-1">
                      Utilize a janela acima para importar o seu primeiro ficheiro TXT ou Excel.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmação para Limpar Tabela */}
      {confirmClearModal && (
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
              Tem a certeza de que deseja eliminar permanentemente todos os <strong>{totalRegistos} registos</strong> da tabela <code>imp_stk</code>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearModal(false)}
                className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearTable}
                disabled={clearingLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">delete_forever</span>
                {clearingLoading ? 'A eliminar...' : 'Sim, Limpar Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
