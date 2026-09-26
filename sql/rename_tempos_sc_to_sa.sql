-- ==============================================================================
-- MIGRAÇÃO: Renomear Colunas VAL_SC e EXP_SC para VAL_SA e EXP_SA em public.tempos
-- ==============================================================================

ALTER TABLE public.tempos RENAME COLUMN "VAL_SC" TO "VAL_SA";
ALTER TABLE public.tempos RENAME COLUMN "EXP_SC" TO "EXP_SA";
