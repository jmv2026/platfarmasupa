-- Migration: add_tipo_doc_to_movimentos_and_movimentos_sf
-- Adicionar coluna tipo_doc (tipo text) nas tabelas movimentos e movimentos_sf

ALTER TABLE public.movimentos 
ADD COLUMN IF NOT EXISTS tipo_doc text;

ALTER TABLE public.movimentos_sf 
ADD COLUMN IF NOT EXISTS tipo_doc text;
