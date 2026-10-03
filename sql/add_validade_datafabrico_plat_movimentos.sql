ALTER TABLE public.plat_movimentos 
  ADD COLUMN IF NOT EXISTS validade DATE,
  ADD COLUMN IF NOT EXISTS datafabrico DATE;
