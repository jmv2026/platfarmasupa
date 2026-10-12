-- Migration: add_missing_columns_to_movimentos_sf
-- Completar tabela movimentos_sf com os campos em falta e presentes na tabela movimentos

ALTER TABLE public.movimentos_sf
  ADD COLUMN IF NOT EXISTS total_iva numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_merc numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_outros numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_desc numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_unitario numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_adicional numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_abater numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_registo bigint,
  ADD COLUMN IF NOT EXISTS chave1 text,
  ADD COLUMN IF NOT EXISTS chave2 text,
  ADD COLUMN IF NOT EXISTS num_chave1 integer,
  ADD COLUMN IF NOT EXISTS num_chave2 integer,
  ADD COLUMN IF NOT EXISTS estado_stock text,
  ADD COLUMN IF NOT EXISTS familia text,
  ADD COLUMN IF NOT EXISTS sub_familia text,
  ADD COLUMN IF NOT EXISTS tipo_artigo text,
  ADD COLUMN IF NOT EXISTS sistema boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ativa boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS chave_ativa boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS num_linha integer;
