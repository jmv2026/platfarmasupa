-- Migration: add_fk_artigos_tipos_artigo
-- Estabelece a ligação (Foreign Key) da tabela artigos com a tabela tipos_artigo através do campo id_tipo_artigo

-- 1. Criar índice na coluna id_tipo_artigo de artigos para performance de JOINs e integridade
CREATE INDEX IF NOT EXISTS idx_artigos_id_tipo_artigo 
    ON public.artigos USING btree (id_tipo_artigo);

-- Remover índice duplicado caso exista
DROP INDEX IF EXISTS public.idx_artigos_tipo_artigo;

-- 2. Criar a Foreign Key em artigos apontando para tipos_artigo(id_tipo_artigo)
ALTER TABLE public.artigos 
    DROP CONSTRAINT IF EXISTS fk_artigos_tipos_artigo;

ALTER TABLE public.artigos 
    ADD CONSTRAINT fk_artigos_tipos_artigo 
    FOREIGN KEY (id_tipo_artigo) 
    REFERENCES public.tipos_artigo (id_tipo_artigo) 
    ON UPDATE CASCADE 
    ON DELETE RESTRICT;
