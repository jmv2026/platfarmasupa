-- 1. Criar bucket 'Documentos' no Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'Documentos',
  'Documentos',
  false,
  52428800, -- 50 MB
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = NULL;

-- 2. Políticas RLS em storage.objects para o bucket 'Documentos'
DROP POLICY IF EXISTS "Permitir leitura Documentos" ON storage.objects;
CREATE POLICY "Permitir leitura Documentos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'Documentos');

DROP POLICY IF EXISTS "Permitir upload Documentos" ON storage.objects;
CREATE POLICY "Permitir upload Documentos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'Documentos');

DROP POLICY IF EXISTS "Permitir update Documentos" ON storage.objects;
CREATE POLICY "Permitir update Documentos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'Documentos')
WITH CHECK (bucket_id = 'Documentos');

DROP POLICY IF EXISTS "Permitir delete Documentos" ON storage.objects;
CREATE POLICY "Permitir delete Documentos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'Documentos');

-- 3. Adicionar coluna documentos_anexos à tabela public.pedidos
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS documentos_anexos jsonb DEFAULT '[]'::jsonb;
