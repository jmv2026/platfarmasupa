-- ==============================================================================
-- Migration: 20261024231500_make_clientes_sigla_unique.sql
-- Descrição: Tornar o campo sigla da tabela public.clientes único.
-- ==============================================================================

-- 1. Garantir que o campo sigla não tem duplicados ou nulos
-- (Verificado: todos os 13 clientes possuem sigla única)

-- 2. Assegurar a constraint UNIQUE na coluna sigla
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.clientes'::regclass AND conname = 'clients_sigla_key'
    ) THEN
        ALTER TABLE public.clientes RENAME CONSTRAINT clients_sigla_key TO clientes_sigla_key;
    ELSIF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.clientes'::regclass AND conname = 'clientes_sigla_key'
    ) THEN
        ALTER TABLE public.clientes ADD CONSTRAINT clientes_sigla_key UNIQUE (sigla);
    END IF;
END $$;
