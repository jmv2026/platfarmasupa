-- Migration: 20261027180500_fix_pedido_linhas_fk_to_artigo_cli.sql
-- Descrição: Ajusta a restrição Foreign Key de pedido_linhas para incidir sobre artigo_cli (que referencia artigos.artigo_cli).

ALTER TABLE public.pedido_linhas DROP CONSTRAINT IF EXISTS pedido_linhas_artigo_id_fkey;

ALTER TABLE public.pedido_linhas 
  ADD CONSTRAINT pedido_linhas_artigo_cli_fkey 
  FOREIGN KEY (artigo_cli) REFERENCES public.artigos(artigo_cli) ON DELETE RESTRICT;
