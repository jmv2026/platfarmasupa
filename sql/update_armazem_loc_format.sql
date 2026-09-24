-- =========================================================================
-- PLATAFORMA FARMA - PADRONIZAÇÃO DO FORMATO DE ARMAZEM_LOC
-- =========================================================================
-- O campo armazem_loc deve ser composto exclusivamente pela SIGLA do
-- cliente seguida do código do armazém, sem espaço ou hífen entre eles
-- (Exemplos: CRD01, CRD03, CRD04, CRD06, PFIZ01, BAYR01, GOH01).
-- =========================================================================

-- 1. Atualizar registos em public.movimentos para SIGLA + TIPO_ARMAZEM
UPDATE public.movimentos m
SET armazem_loc = COALESCE(c.sigla, m.sigla, 'ARM') || m.tipo_armazem
FROM public.clients c
WHERE m.client_id = c.id;

-- 2. Limpeza adicional de qualquer hífen, underscore ou espaço remanescente
UPDATE public.movimentos
SET armazem_loc = REPLACE(REPLACE(REPLACE(armazem_loc, '-', ''), '_', ''), ' ', '')
WHERE armazem_loc LIKE '%-%' OR armazem_loc LIKE '%_%' OR armazem_loc LIKE '% %';

COMMENT ON COLUMN public.movimentos.armazem_loc IS 'Localização do armazém: SIGLA do cliente seguida do código do armazém sem separadores (ex: CRD01, PFIZ01)';
