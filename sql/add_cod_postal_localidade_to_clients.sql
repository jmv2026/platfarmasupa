-- ==============================================================================
-- ADIÇÃO DOS CAMPOS cod_postal E localidade À TABELA public.clients
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase (Project: ujyqepohbtbgxjsksnyn)
-- ==============================================================================

-- 1. Adicionar as colunas cod_postal e localidade à tabela clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS cod_postal TEXT,
ADD COLUMN IF NOT EXISTS localidade TEXT;

-- 2. Adicionar comentários descritivos
COMMENT ON COLUMN public.clients.cod_postal IS 'Código Postal do cliente (ex: 4745-457)';
COMMENT ON COLUMN public.clients.localidade IS 'Localidade / Freguesia do cliente (ex: Coronado)';
