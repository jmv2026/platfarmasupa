'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  TIPO_ARTIGO_LABELS,
  TIPO_ARMAZENAMENTO_LABELS,
} from '@/lib/supabase/types';
import {
  ArtigoImportInput,
  parseTextArtigosFile,
  parseExcelArtigosFile,
  generateArtigosSampleCSV,
  generateArtigosSampleExcel,
} from '@/lib/parse-artigos-file';
import { importarArtigosAction } from './actions';

interface ImportacaoArtigosCardProps {
  onSuccess?: (importedArtigos?: any[]) => void;
}

export default function ImportacaoArtigosCard({ onSuccess }: ImportacaoArtigosCardProps) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ArtigoImportInput[]>([]);
  const [parsingLoading, setParsingLoading] = useState(false);
  const [importingLoading, setImportingLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const [importProgress, setImportProgress] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manipular seleção e leitura do ficheiro (.txt, .csv, .xlsx, .xls)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setParsingLoading(true);
    setFeedback(null);
    setImportProgress(null);

    try {
      const fileName = file.name.toLowerCase();
      let rows: ArtigoImportInput[] = [];

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        rows = await parseExcelArtigosFile(arrayBuffer);
      } else {
        // .txt ou .csv
        const textContent = await file.text();
        rows = parseTextArtigosFile(textContent);
      }

      if (rows.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Não foram encontrados artigos válidos no ficheiro selecionado. Verifique os cabeçalhos das colunas.',
        });
        setParsedRows([]);
      } else {
        setParsedRows(rows);
        setFeedback({
          type: 'success',
          message: `Ficheiro analisado com sucesso! ${rows.length} artigos únicos prontos para importação.`,
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

  // Submeter a gravação das linhas na tabela artigos em lotes do cliente (evita limite de 1MB do Next.js)
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    setImportingLoading(true);
    setFeedback(null);

    try {
      const CHUNK_SIZE = 250;
      let totalImported = 0;
      const allImportedData: any[] = [];
      const totalChunks = Math.ceil(parsedRows.length / CHUNK_SIZE);

      for (let i = 0; i < parsedRows.length; i += CHUNK_SIZE) {
        const chunk = parsedRows.slice(i, i + CHUNK_SIZE);
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        setImportProgress(`A gravar lote ${chunkIndex} de ${totalChunks} (${Math.min(i + CHUNK_SIZE, parsedRows.length)} / ${parsedRows.length} artigos)...`);

        const res = await importarArtigosAction(chunk);
        if (!res.success) {
          throw new Error(res.error || `Erro ao gravar lote ${chunkIndex}`);
        }

        totalImported += res.count || chunk.length;
        if (res.artigos) {
          allImportedData.push(...res.artigos);
        }
      }

      setFeedback({
        type: 'success',
        message: `Importação concluída com sucesso! ${totalImported} artigos gravados/atualizados no catálogo.`,
      });

      setSelectedFile(null);
      setParsedRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (onSuccess) onSuccess(allImportedData);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado na importação';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setImportingLoading(false);
      setImportProgress(null);
    }
  };

  // Cancelar seleção
  const handleCancelSelection = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setFeedback(null);
    setImportProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Download do Modelo Excel de Artigos
  const handleDownloadExcelTemplate = async () => {
    try {
      const blob = await generateArtigosSampleExcel();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'modelo_catalogo_artigos_platfarma.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar modelo';
      setFeedback({ type: 'error', message: `Erro ao descarregar modelo Excel: ${msg}` });
    }
  };

  // Download do Modelo CSV de Artigos
  const handleDownloadCSVTemplate = () => {
    try {
      const csv = generateArtigosSampleCSV();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'modelo_catalogo_artigos_platfarma.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar modelo';
      setFeedback({ type: 'error', message: `Erro ao descarregar modelo CSV: ${msg}` });
    }
  };

  // Estatísticas do ficheiro
  const stats = useMemo(() => {
    let comLote = 0;
    let comSerie = 0;
    let mhCount = 0;
    let dmCount = 0;
    let dcCount = 0;
    let frioCount = 0;

    parsedRows.forEach((r) => {
      if (r.tratamento_lote) comLote++;
      if (r.tratamento_serie) comSerie++;
      if (r.tipo_artigo === 'MH' || r.tipo_artigo === 'MV') mhCount++;
      if (r.tipo_artigo === 'DM') dmCount++;
      if (r.tipo_artigo === 'DC') dcCount++;
      if (r.tipo_armazenamento === 'TF' || r.tipo_armazenamento === 'TC') frioCount++;
    });

    return { comLote, comSerie, mhCount, dmCount, dcCount, frioCount };
  }, [parsedRows]);

  // Filtragem na pré-visualização
  const filteredPreview = useMemo(() => {
    if (!searchTerm.trim()) return parsedRows;
    const term = searchTerm.toLowerCase();
    return parsedRows.filter(
      (r) =>
        r.artigo_id.toLowerCase().includes(term) ||
        r.descricao.toLowerCase().includes(term) ||
        (r.tipo_artigo && r.tipo_artigo.toLowerCase().includes(term))
    );
  }, [parsedRows, searchTerm]);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-4">
        <div>
          <h3 className="text-base font-bold font-headline text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">file_upload</span>
            Importação de Catálogo de Artigos (TXT / XLSX)
          </h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Importe ou atualize artigos em lote a partir de ficheiros de texto delimitados ou folhas Excel com cabeçalhos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadExcelTemplate}
            className="px-3 py-1.5 bg-surface border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Descarregar folha de cálculo Excel modelo com colunas formatadas"
          >
            <span className="material-symbols-outlined text-sm text-emerald-600">table_chart</span>
            Modelo Excel
          </button>
          <button
            type="button"
            onClick={handleDownloadCSVTemplate}
            className="px-3 py-1.5 bg-surface border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Descarregar ficheiro CSV modelo"
          >
            <span className="material-symbols-outlined text-sm text-secondary">description</span>
            Modelo CSV
          </button>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="text-xs font-semibold text-secondary hover:text-secondary/80 flex items-center gap-1 cursor-pointer ml-1"
          >
            <span className="material-symbols-outlined text-sm">
              {showHelp ? 'visibility_off' : 'help'}
            </span>
            {showHelp ? 'Ocultar Estrutura' : 'Ver Estrutura'}
          </button>
        </div>
      </div>

      {/* Ajuda / Estrutura do Ficheiro */}
      {showHelp && (
        <div className="p-4 bg-surface-container/40 rounded-xl border border-outline-variant/30 text-xs space-y-3">
          <h4 className="font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-secondary">info</span>
            Colunas e Formatos Aceites:
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] divide-y divide-outline-variant/20">
              <thead className="bg-surface-container/80 text-on-surface-variant font-semibold">
                <tr>
                  <th className="py-2 px-2.5">Nome do Cabeçalho</th>
                  <th className="py-2 px-2.5">Descrição</th>
                  <th className="py-2 px-2.5">Valores Exemplo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                <tr>
                  <td className="py-2 px-2.5 font-mono font-bold text-secondary">artigo_id</td>
                  <td className="py-2 px-2.5">Código único identificador do artigo (Obrigatório)</td>
                  <td className="py-2 px-2.5 font-mono text-on-surface-variant">A024273070, 00 1275627</td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-mono font-bold text-secondary">Descricao</td>
                  <td className="py-2 px-2.5">Designação comercial ou nome do produto</td>
                  <td className="py-2 px-2.5 font-mono text-on-surface-variant">LUVION 200 MG/2ML, SELOKEN 1MG</td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-mono font-bold text-secondary">tratamento_serie</td>
                  <td className="py-2 px-2.5">Exige controlo de número de série unitário (0 ou 1)</td>
                  <td className="py-2 px-2.5 font-mono text-on-surface-variant">0 (Não), 1 (Sim)</td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-mono font-bold text-secondary">tratamento_lote</td>
                  <td className="py-2 px-2.5">Exige rastreabilidade por lote de fabrico (0 ou 1)</td>
                  <td className="py-2 px-2.5 font-mono text-on-surface-variant">1 (Sim), 0 (Não)</td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-mono font-bold text-secondary">tipo_artigo</td>
                  <td className="py-2 px-2.5">Classificação regulamentar (MH, MV, DM, DC, SC ou MED)</td>
                  <td className="py-2 px-2.5 font-mono text-on-surface-variant">MH (Medicamento Humano), DM, DC</td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-mono font-bold text-secondary">tipo_armazenamento</td>
                  <td className="py-2 px-2.5">Condição térmica de conservação (TA, TC, TF)</td>
                  <td className="py-2 px-2.5 font-mono text-on-surface-variant">TA (Ambiente), TC (15-25ºC), TF (2-8ºC)</td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 font-mono font-bold text-secondary">pvp</td>
                  <td className="py-2 px-2.5">Preço de Venda ao Público / PVP (Opcional)</td>
                  <td className="py-2 px-2.5 font-mono text-on-surface-variant">12.50, 4.99, 0.00</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            * <strong>Nota:</strong> Se o artigo já existir na base de dados, os seus dados serão atualizados com as novas definições (upsert automático por <code>artigo_id</code>).
          </p>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span className="material-symbols-outlined text-base">
            {feedback.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <p className="flex-1">{feedback.message}</p>
        </div>
      )}

      {/* Dropzone de Ficheiro */}
      <div className="border-2 border-dashed border-outline-variant/60 hover:border-secondary/60 transition-colors rounded-2xl p-6 sm:p-8 text-center bg-surface-container/20">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".txt,.csv,.xlsx,.xls"
          className="hidden"
          id="artigo-file-input"
          disabled={parsingLoading || importingLoading}
        />

        <label htmlFor="artigo-file-input" className="cursor-pointer block">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-3xl">upload_file</span>
          </div>

          <p className="text-sm font-bold text-on-surface">
            {selectedFile ? selectedFile.name : 'Clique para selecionar ou arraste o ficheiro de artigos'}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            Formatos suportados: <strong>TXT / CSV</strong> (delimitado por ;) ou folhas de cálculo <strong>XLSX / XLS</strong>
          </p>

          {selectedFile && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-sm text-secondary">description</span>
              <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
        </label>

        {parsingLoading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-secondary">
            <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
            <span>A analisar estrutura e campos do ficheiro...</span>
          </div>
        )}
      </div>

      {/* Se existirem registos analisados: Pré-visualização & Ações */}
      {parsedRows.length > 0 && (
        <div className="space-y-4 pt-2">
          {/* Painel de Estatísticas e Ações */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container/40 p-4 rounded-xl border border-outline-variant/30">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
              <span className="px-2.5 py-1 bg-secondary text-on-secondary rounded-lg font-bold">
                Total: {parsedRows.length} Artigos
              </span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-medium text-[11px]">
                Medicamentos: {stats.mhCount}
              </span>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md font-medium text-[11px]">
                Dispositivos: {stats.dmCount}
              </span>
              <span className="px-2 py-0.5 bg-pink-100 text-pink-800 rounded-md font-medium text-[11px]">
                Dermo/Cosméticos: {stats.dcCount}
              </span>
              <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 rounded-md font-medium text-[11px]">
                Frio/Controlado: {stats.frioCount}
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-medium text-[11px]">
                Lote: {stats.comLote}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
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
                className="bg-secondary text-on-secondary hover:bg-secondary/90 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {importingLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{importProgress || `A importar (${parsedRows.length})...`}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">cloud_upload</span>
                    <span>Gravar no Catálogo ({parsedRows.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Barra de Pesquisa na Pré-visualização */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar artigos da pré-visualização..."
                className="w-full bg-surface-container/50 border border-outline-variant/30 rounded-xl pl-9 pr-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
            <p className="text-[11px] text-on-surface-variant font-medium">
              A mostrar {Math.min(filteredPreview.length, 100)} de {filteredPreview.length} registos
            </p>
          </div>

          {/* Tabela de Pré-visualização */}
          <div className="overflow-x-auto border border-outline-variant/20 rounded-xl max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container text-on-surface-variant font-semibold uppercase tracking-wider text-[10px] sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Descrição Comercial</th>
                  <th className="py-2.5 px-3">Tipo Artigo</th>
                  <th className="py-2.5 px-3">Conservação</th>
                  <th className="py-2.5 px-3 text-right">PVP (€)</th>
                  <th className="py-2.5 px-3 text-center">Lote</th>
                  <th className="py-2.5 px-3 text-center">Série</th>
                  <th className="py-2.5 px-3 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {filteredPreview.slice(0, 100).map((row, idx) => (
                  <tr key={`${row.artigo_id}-${idx}`} className="hover:bg-surface-container/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-secondary">
                      {row.artigo_id}
                    </td>
                    <td className="py-2.5 px-3 font-medium">
                      {row.descricao}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] text-on-surface-variant">
                        {TIPO_ARTIGO_LABELS[row.tipo_artigo || 'MH'] || row.tipo_artigo}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          row.tipo_armazenamento === 'TF'
                             ? 'bg-cyan-100 text-cyan-800'
                            : row.tipo_armazenamento === 'TC'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {row.tipo_armazenamento === 'TF' ? 'ac_unit' : 'thermostat'}
                        </span>
                        {TIPO_ARMAZENAMENTO_LABELS[row.tipo_armazenamento || 'TA'] || row.tipo_armazenamento}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-on-surface">
                      {typeof row.pvp === 'number' && row.pvp > 0
                        ? `${row.pvp.toFixed(2)} €`
                        : <span className="text-on-surface-variant/50">-</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`material-symbols-outlined text-sm ${row.tratamento_lote ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {row.tratamento_lote ? 'check_circle' : 'cancel'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`material-symbols-outlined text-sm ${row.tratamento_serie ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {row.tratamento_serie ? 'check_circle' : 'cancel'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`inline-flex items-center gap-1 font-medium ${row.ativo ? 'text-emerald-700' : 'text-slate-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${row.ativo ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {row.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
