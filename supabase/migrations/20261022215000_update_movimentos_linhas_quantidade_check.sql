-- Migration: Atualizar constraint de quantidade em movimentos_linhas para permitir >= 0
-- Motivo: Registos de ERP/Primavera podem conter linhas informativas ou com quantidade 0 (ex: VGR 26PNZ/50-12)

ALTER TABLE public.movimentos_linhas
  DROP CONSTRAINT IF EXISTS movimentos_sf_quantidade_check;

ALTER TABLE public.movimentos_linhas
  ADD CONSTRAINT movimentos_sf_quantidade_check CHECK (quantidade >= 0);
