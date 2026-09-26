-- ==============================================================================
-- ADIÇÃO DO ARMAZÉM 09 (Validade) À TABELA public.armazens
-- ==============================================================================
-- Descrição: Atualiza a constraint de verificação dos tipos de armazém e insere
--            o armazém 09 com a descrição 'Validade'.
-- ==============================================================================

-- 1. Atualizar constraint de verificação da coluna tipo_armazem
ALTER TABLE public.armazens DROP CONSTRAINT IF EXISTS armazens_tipo_armazem_check;

ALTER TABLE public.armazens ADD CONSTRAINT armazens_tipo_armazem_check 
  CHECK (tipo_armazem = ANY (ARRAY['01'::text, '02'::text, '03'::text, '04'::text, '05'::text, '06'::text, '07'::text, '09'::text, '10'::text]));

-- 2. Inserir ou atualizar registo do armazém 09 (Validade)
INSERT INTO public.armazens (tipo_armazem, descricao, created_at, updated_at)
VALUES ('09', 'Validade', now(), now())
ON CONFLICT (tipo_armazem) DO UPDATE 
  SET descricao = EXCLUDED.descricao, updated_at = now();
