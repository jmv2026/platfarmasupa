-- Migration: add_fk_movimentos_linhas_movimentos_documento_ref
-- Estabelece a ligação 1:N entre movimentos (cabeçalho) e movimentos_linhas (linhas) através de documento_ref

-- 1. Adicionar restrição UNIQUE em movimentos(documento_ref) para suportar a Foreign Key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'movimentos_documento_ref_key' 
          AND conrelid = 'public.movimentos'::regclass
    ) THEN
        ALTER TABLE public.movimentos 
            ADD CONSTRAINT movimentos_documento_ref_key UNIQUE (documento_ref);
    END IF;
END $$;

-- 2. Criar a Foreign Key em movimentos_linhas apontando para movimentos
ALTER TABLE public.movimentos_linhas
    DROP CONSTRAINT IF EXISTS fk_movimentos_linhas_documento_ref;

ALTER TABLE public.movimentos_linhas
    ADD CONSTRAINT fk_movimentos_linhas_documento_ref 
    FOREIGN KEY (documento_ref) 
    REFERENCES public.movimentos (documento_ref)
    ON UPDATE CASCADE
    ON DELETE CASCADE;

-- 3. Criar índice na coluna documento_ref de movimentos_linhas para otimizar JOINs e integridade
CREATE INDEX IF NOT EXISTS idx_movimentos_linhas_documento_ref 
    ON public.movimentos_linhas USING btree (documento_ref);
