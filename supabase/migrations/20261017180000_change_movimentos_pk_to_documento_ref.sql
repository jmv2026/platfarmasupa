-- Migration: change_movimentos_pk_to_documento_ref
-- Troca a chave primária da tabela movimentos de id para documento_ref

-- 1. Remover temporariamente a foreign key em movimentos_linhas que referenciava documento_ref
ALTER TABLE public.movimentos_linhas 
    DROP CONSTRAINT IF EXISTS fk_movimentos_linhas_documento_ref;

-- 2. Garantir que a coluna documento_ref em movimentos é NOT NULL
ALTER TABLE public.movimentos 
    ALTER COLUMN documento_ref SET NOT NULL;

-- 3. Remover a chave primária antiga baseada na coluna id
ALTER TABLE public.movimentos 
    DROP CONSTRAINT IF EXISTS movimentos_pkey;

-- 4. Remover o índice/restrição UNIQUE que existia em documento_ref (agora coberto pela PK)
ALTER TABLE public.movimentos 
    DROP CONSTRAINT IF EXISTS movimentos_documento_ref_key;

-- 5. Definir documento_ref como a nova PRIMARY KEY de movimentos
ALTER TABLE public.movimentos 
    ADD CONSTRAINT movimentos_pkey PRIMARY KEY (documento_ref);

-- 6. Recriar a Foreign Key em movimentos_linhas apontando para a nova Primary Key
ALTER TABLE public.movimentos_linhas
    ADD CONSTRAINT fk_movimentos_linhas_documento_ref 
    FOREIGN KEY (documento_ref) 
    REFERENCES public.movimentos (documento_ref)
    ON UPDATE CASCADE
    ON DELETE CASCADE;
