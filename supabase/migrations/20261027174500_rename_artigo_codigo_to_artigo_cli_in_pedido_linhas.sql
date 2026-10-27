-- Migration: 20261027174500_rename_artigo_codigo_to_artigo_cli_in_pedido_linhas.sql
-- Descrição: Renomeia a coluna artigo_codigo para artigo_cli na tabela pedido_linhas para padronização com as restantes tabelas/views.

ALTER TABLE public.pedido_linhas RENAME COLUMN artigo_codigo TO artigo_cli;
COMMENT ON COLUMN public.pedido_linhas.artigo_cli IS 'Código do artigo atribuído pelo cliente.';
