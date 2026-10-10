'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/context';

export default function ImportacaoComprovativosTab() {
  const { t, language } = useLanguage();
  const supabase = createClient();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [clearingStorage, setClearingStorage] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setFeedback(null);
    }
  };

  const handleClearSelection = () => {
    setFiles([]);
    setFeedback(null);
    // Reset do input de ficheiro
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleClearStorage = async () => {
    if (!window.confirm('Tem a certeza que deseja eliminar todos os ficheiros armazenados na storage? Esta ação não pode ser revertida.')) {
      return;
    }

    setClearingStorage(true);
    setFeedback(null);

    try {
      const { data, error } = await supabase.storage.from('comprovativos_ttir').list('', { limit: 10000 });
      if (error) throw error;

      if (!data || data.length === 0) {
        setFeedback({ type: 'success', message: 'A storage já se encontra vazia.' });
      } else {
        const filesToRemove = data.map(file => file.name);
        const { error: removeError } = await supabase.storage.from('comprovativos_ttir').remove(filesToRemove);
        
        if (removeError) throw removeError;

        // Limpar a tabela (reset do campo url_comprovativo)
        const { error: dbError } = await supabase
          .from('torrestir_status')
          .update({ url_comprovativo: null })
          .neq('id', '00000000-0000-0000-0000-000000000000'); // hack for update all
          
        if (dbError) console.error('Erro ao limpar metadados:', dbError);

        setFeedback({ type: 'success', message: `Foram eliminados ${filesToRemove.length} ficheiros com sucesso.` });
      }
    } catch (err: any) {
      console.error('Erro ao limpar storage:', err);
      setFeedback({ type: 'error', message: 'Ocorreu um erro ao tentar limpar a storage.' });
    } finally {
      setClearingStorage(false);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setFeedback({ type: 'error', message: 'Selecione pelo menos um ficheiro para importar.' });
      return;
    }

    setUploading(true);
    setFeedback(null);
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      // O nome do ficheiro será usado diretamente no Storage. 
      // É esperado que o nome corresponda ao 'ref_ser' (ex: '12345.pdf')
      const filePath = file.name;
      const { error } = await supabase.storage
        .from('comprovativos_ttir')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: true
        });

      if (error) {
        console.error('Erro ao importar ficheiro:', error);
        errorCount++;
      } else {
        // Atualizar url_comprovativo na tabela torrestir_status
        const refSerSemExtensao = filePath.substring(0, filePath.lastIndexOf('.')) || filePath;
        
        const { error: dbError } = await supabase
          .from('torrestir_status')
          .update({ url_comprovativo: filePath })
          .eq('ref_comprovativo', refSerSemExtensao);
          
        if (dbError) {
          console.error('Erro ao atualizar url_comprovativo:', dbError);
        }
        successCount++;
      }
    }

    setUploading(false);

    if (errorCount === 0) {
      setFeedback({ type: 'success', message: `Todos os ${successCount} ficheiros foram importados com sucesso!` });
      setFiles([]);
    } else {
      setFeedback({ type: 'error', message: `${successCount} importados com sucesso. ${errorCount} falharam.` });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm">
        <h3 className="text-base font-bold font-headline text-on-surface mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">upload_file</span>
          Importação de Comprovativos
        </h3>
        <p className="text-xs text-on-surface-variant mb-6">
          Selecione múltiplos ficheiros para armazenar no bucket seguro de comprovativos.
        </p>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-outline-variant/40 rounded-xl p-6 flex flex-col items-center justify-center bg-surface-container/20 hover:bg-surface-container/40 transition-colors">
            <span className="material-symbols-outlined text-4xl text-secondary mb-2">cloud_upload</span>
            <input
              id="file-upload"
              type="file"
              multiple
              onChange={handleFileChange}
              className="block w-full max-w-sm text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-xs file:font-semibold
                file:bg-secondary/10 file:text-secondary
                hover:file:bg-secondary/20
                cursor-pointer"
            />
            {files.length > 0 && (
              <p className="mt-3 text-xs font-semibold text-emerald-600">
                {files.length} ficheiro(s) selecionado(s)
              </p>
            )}
          </div>

          {feedback && (
            <div className={`p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-all ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
              <span className="material-symbols-outlined text-base">
                {feedback.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between gap-4 mt-6">
            <button
              onClick={handleClearStorage}
              disabled={clearingStorage || uploading}
              className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">
                {clearingStorage ? 'sync' : 'delete_sweep'}
              </span>
              {clearingStorage ? 'A Limpar...' : 'Limpar Storage'}
            </button>
            <div className="flex items-center justify-end gap-3 flex-wrap">
              {files.length > 0 && (
                <button
                  onClick={handleClearSelection}
                  disabled={uploading}
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">clear_all</span>
                  Limpar Seleção
                </button>
              )}
              <button
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
                className="bg-secondary text-on-secondary hover:bg-secondary/90 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {uploading ? 'sync' : 'upload'}
                </span>
                {uploading ? 'A Importar...' : 'Importar Ficheiros'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
