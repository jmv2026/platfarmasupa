-- ==============================================================================
-- ATUALIZAÇÃO DO FORMATO DE POSIÇÃO NA TABELA MOVIMENTOS
-- ==============================================================================
-- Regra de negócio: A posição no armazém é estritamente composta por:
--   - 2 dígitos
--   - 1 letra maiúscula
--   - 2 dígitos
--   Sem espaços ou carateres separadores (exemplo: '01A01', '01Q01', '02B03').
-- ==============================================================================

-- 1. Normalizar quaisquer posições existentes que possam conter separadores (hífens, espaços, pontos, etc.)
UPDATE public.movimentos
SET posicao = UPPER(REGEXP_REPLACE(posicao, '[\s\-_.]+', '', 'g'))
WHERE posicao IS NOT NULL 
  AND posicao ~ '[\s\-_.]';

-- 2. Atualizar o comentário da coluna com a especificação da regra
COMMENT ON COLUMN public.movimentos.posicao IS 'Posição de armazenamento no formato estrito de 2 dígitos + 1 letra + 2 dígitos sem separadores (ex: 01A01, 01Q01)';
