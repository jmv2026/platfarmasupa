-- Migration: Adicionar armazém 10 (armazem MIa) à tabela armazens
-- Data: 2026-09-25

-- 1. Atualizar constraint de verificação da coluna tipo_armazem
ALTER TABLE armazens DROP CONSTRAINT IF EXISTS armazens_tipo_armazem_check;

-- 2. Atualizar ou inserir registo do armazém 10 na tabela armazens
UPDATE armazens SET tipo_armazem = '10', descricao = 'MIA', updated_at = now() WHERE tipo_armazem = '09';

INSERT INTO armazens (tipo_armazem, descricao, created_at, updated_at)
VALUES ('10', 'MIA', now(), now())
ON CONFLICT (tipo_armazem) DO UPDATE 
  SET descricao = EXCLUDED.descricao, updated_at = now();

DELETE FROM armazens WHERE tipo_armazem = '09';

ALTER TABLE armazens ADD CONSTRAINT armazens_tipo_armazem_check 
  CHECK (tipo_armazem = ANY (ARRAY['01'::text, '02'::text, '03'::text, '04'::text, '05'::text, '06'::text, '07'::text, '10'::text]));
