-- ==============================================================================
-- PLATAFORMA FARMA - ADICIONAR CAMPO SIGLA NA TABELA MOVIMENTOS
-- ==============================================================================
-- Reproduz e mantém automaticamente a sigla do cliente da tabela clients.
-- ==============================================================================

-- 1. Adicionar a coluna sigla na tabela movimentos
ALTER TABLE public.movimentos 
ADD COLUMN IF NOT EXISTS sigla VARCHAR(10);

-- 2. Atualizar os registos existentes com a sigla correspondente da tabela clients
UPDATE public.movimentos m
SET sigla = c.sigla
FROM public.clients c
WHERE m.client_id = c.id;

-- 3. Criar função para preencher/manter automaticamente a sigla a partir do client_id
CREATE OR REPLACE FUNCTION public.fn_sync_movimento_sigla()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.client_id IS NOT NULL THEN
        SELECT sigla INTO NEW.sigla FROM public.clients WHERE id = NEW.client_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar o trigger na tabela movimentos
DROP TRIGGER IF EXISTS trg_sync_movimento_sigla ON public.movimentos;

CREATE TRIGGER trg_sync_movimento_sigla
BEFORE INSERT OR UPDATE OF client_id ON public.movimentos
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_movimento_sigla();

-- 5. Criar índice e comentário
CREATE INDEX IF NOT EXISTS idx_movimentos_sigla ON public.movimentos(sigla);
COMMENT ON COLUMN public.movimentos.sigla IS 'Sigla do cliente (reproduzida da tabela clients).';
