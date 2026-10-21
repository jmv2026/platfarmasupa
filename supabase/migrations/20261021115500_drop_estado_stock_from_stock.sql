-- ==============================================================================
-- Migration: 20261021115500_drop_estado_stock_from_stock.sql
-- Descrição: Remoção da coluna estado_stock e respetivo índice da tabela public.stock
-- ==============================================================================

DROP INDEX IF EXISTS public.idx_stock_estado_stock;

ALTER TABLE IF EXISTS public.stock 
DROP COLUMN IF EXISTS estado_stock;
