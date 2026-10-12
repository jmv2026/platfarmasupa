-- Migration: add_performance_indexes_movimentos_pedidos
-- Índices para acelerar joins e filtros frequentes nas páginas e views

CREATE INDEX IF NOT EXISTS idx_movimentos_artigo_cli ON public.movimentos USING btree (artigo_cli);
CREATE INDEX IF NOT EXISTS idx_movimentos_doc_ref ON public.movimentos USING btree (documento_ref);
CREATE INDEX IF NOT EXISTS idx_movimentos_doc_linha ON public.movimentos USING btree (doc_linha);
CREATE INDEX IF NOT EXISTS idx_movimentos_tipo_mov_cliente ON public.movimentos USING btree (tipo_movimento, cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_created_at ON public.pedidos USING btree (created_at DESC);
