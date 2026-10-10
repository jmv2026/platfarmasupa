'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { importarTransporteAction } from './actions';
import TransporteView from './transporte-view';
import { createClient } from '@/lib/supabase/client';

export default function ImportacaoTransporteTab({ trackingData = [] }: { trackingData?: any[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatTorrestirDate = (val?: string) => {
    if (!val || typeof val !== 'string') return null;
    const clean = val.trim();
    if (clean.length === 8) {
      // aaaammdd -> YYYY-MM-DD
      return `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}`;
    }
    return clean || null;
  };

  const formatTorrestirTime = (val?: string) => {
    if (!val || typeof val !== 'string') return null;
    const clean = val.trim();
    if (clean.length === 4) {
      // hhmm -> HH:MM:00
      return `${clean.slice(0,2)}:${clean.slice(2,4)}:00`;
    }
    return clean || null;
  };

  const handleProcessFile = async () => {
    if (files.length === 0) {
      setFeedback({ type: 'error', message: 'Selecione pelo menos um ficheiro primeiro.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      let allRows: any[] = [];
      
      for (const file of files) {
        const fileRows = await new Promise<any[]>((resolve, reject) => {
          Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
              const rows = results.data as string[][];
              const payload = rows.map(row => ({
                ref_ser: row[0] || null,
                data_estado: formatTorrestirDate(row[1]),
                hora_estado: formatTorrestirTime(row[2]),
                ref_trans: row[3] || null,
                cod_estado: row[4] ? parseInt(row[4], 10) : null,
                cod_incide: row[5] ? parseInt(row[5], 10) : null,
                data_reg_incide: formatTorrestirDate(row[6]),
                hora_reg_incide: formatTorrestirTime(row[7]),
                desc_estado_expedicao: row[8] || null,
                obs_expedicao: row[9] || null,
                url_comprovativo: row[0] ? String(row[0]).replace(/\//g, '') + '.tif' : null,
              }));
              resolve(payload);
            },
            error: (err) => reject(err),
          });
        });
        allRows = allRows.concat(fileRows);
      }

      const res = await importarTransporteAction(allRows);
      
      if (res.success) {
        setFeedback({ type: 'success', message: `Foram importados ${res.count} registos de ${files.length} ficheiro(s) com sucesso!` });
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao importar registos.' });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: 'Falha ao processar ficheiros. Verifique os formatos.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRefComprovativo = async () => {
    setVerifying(true);
    setFeedback(null);
    try {
      const supabase = createClient();
      
      // O Supabase tem um problema de sintaxe ao fazer REPLACE na API REST
      // Portanto, vamos apenas buscar algumas linhas e verificar no cliente,
      // ou idealmente fazer uma chamada RPC. Mas como é GENERATED, podemos
      // verificar se há alguma linha onde ref_comprovativo seja nulo.
      
      const { count, error } = await supabase
        .from('torrestir_status')
        .select('*', { count: 'exact', head: true })
        .is('ref_comprovativo', null);

      if (error) throw error;

      if (count === 0) {
        setFeedback({ 
          type: 'success', 
          message: 'Verificação concluída: Todas as linhas têm a "ref_comprovativo" preenchida corretamente de acordo com a regra.' 
        });
      } else {
        setFeedback({ 
          type: 'error', 
          message: `Verificação concluída: Encontradas ${count} linha(s) com a "ref_comprovativo" em falta.` 
        });
      }
    } catch (error: any) {
      setFeedback({ type: 'error', message: 'Erro ao verificar a integridade da tabela: ' + error.message });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm">
      <h3 className="text-base font-bold font-headline text-on-surface mb-1 flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary">local_shipping</span>
        Transporte - Importa os ficheiros status da Torrestir diretamente
      </h3>
      <p className="text-xs text-on-surface-variant mb-6">
        Configurações e importação de ficheiros de transporte (ex: Torrestir). 
        Faça upload de ficheiros CSV/TSV sem cabeçalho gerados pelo parceiro. Pode selecionar múltiplos ficheiros.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <input
          type="file"
          accept=".csv, .tsv, .txt"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          ref={fileInputRef}
          className="block w-full text-xs text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-container file:text-on-primary-container hover:file:bg-primary-container/80 cursor-pointer"
        />
        <div className="flex gap-2">
          <button
            onClick={handleProcessFile}
            disabled={files.length === 0 || loading}
            className="bg-secondary text-on-secondary px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? 'A importar...' : `Importar ${files.length > 0 ? files.length + ' Ficheiro(s)' : ''}`}
          </button>
          
          <button
            onClick={handleVerifyRefComprovativo}
            disabled={loading || verifying}
            className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors whitespace-nowrap flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">{verifying ? 'sync' : 'fact_check'}</span>
            Verificar refs
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`mt-4 p-3 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          <span className="material-symbols-outlined text-base">
            {feedback.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {feedback.message}
        </div>
      )}

      {/* Renderizar Tabela de Tracking */}
      <div className="mt-8">
        <TransporteView data={trackingData} />
      </div>
    </div>
  );
}

