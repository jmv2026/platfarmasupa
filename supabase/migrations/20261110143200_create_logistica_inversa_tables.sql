-- Migração: Criação das tabelas dedicadas para Logística Inversa (pedidos_recolha e pedido_recolha_linhas)
CREATE TABLE IF NOT EXISTS public.pedidos_recolha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nr_pedido text NOT NULL UNIQUE,
  sigla_pedido text,
  ref_documento text,
  motivo_recolha text DEFAULT 'Devolução Comercial',
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  destino_id uuid REFERENCES public.destinos(id) ON DELETE SET NULL,
  classifica_destino varchar(100),
  nome_origem text NOT NULL,
  morada text NOT NULL,
  codigo_postal text NOT NULL,
  localidade text NOT NULL,
  pais text NOT NULL DEFAULT 'Portugal',
  contacto_local text,
  data_pedido date NOT NULL DEFAULT CURRENT_DATE,
  data_recolha date,
  status text NOT NULL DEFAULT 'pendente',
  armazem_destino text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pedido_recolha_linhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_recolha_id uuid NOT NULL REFERENCES public.pedidos_recolha(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  artigo_id text NOT NULL,
  artigo_cli text NOT NULL,
  descricao text NOT NULL,
  lote text DEFAULT '',
  validade date,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  motivo_linha text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_recolha_cliente_created ON public.pedidos_recolha(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_recolha_status ON public.pedidos_recolha(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_recolha_destino ON public.pedidos_recolha(destino_id);
CREATE INDEX IF NOT EXISTS idx_pedido_recolha_linhas_pedido_id ON public.pedido_recolha_linhas(pedido_recolha_id);
CREATE INDEX IF NOT EXISTS idx_pedido_recolha_linhas_cliente_id ON public.pedido_recolha_linhas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedido_recolha_linhas_artigo_id ON public.pedido_recolha_linhas(artigo_id);

ALTER TABLE public.pedidos_recolha ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_recolha_linhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedidos_recolha_select_policy ON public.pedidos_recolha;
CREATE POLICY pedidos_recolha_select_policy ON public.pedidos_recolha
  FOR SELECT TO authenticated
  USING (
    ((SELECT users.role FROM public.users WHERE users.id = (SELECT auth.uid())) = ANY (ARRAY['admin'::text, 'gestor'::text]))
    OR (cliente_id = (SELECT users.cliente_id FROM public.users WHERE users.id = (SELECT auth.uid())))
  );

DROP POLICY IF EXISTS pedidos_recolha_insert_policy ON public.pedidos_recolha;
CREATE POLICY pedidos_recolha_insert_policy ON public.pedidos_recolha
  FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT users.role FROM public.users WHERE users.id = (SELECT auth.uid())) = ANY (ARRAY['admin'::text, 'gestor'::text]))
    OR (cliente_id = (SELECT users.cliente_id FROM public.users WHERE users.id = (SELECT auth.uid())))
  );

DROP POLICY IF EXISTS pedidos_recolha_update_policy ON public.pedidos_recolha;
CREATE POLICY pedidos_recolha_update_policy ON public.pedidos_recolha
  FOR UPDATE TO authenticated
  USING (
    ((SELECT users.role FROM public.users WHERE users.id = (SELECT auth.uid())) = ANY (ARRAY['admin'::text, 'gestor'::text]))
    OR (cliente_id = (SELECT users.cliente_id FROM public.users WHERE users.id = (SELECT auth.uid())))
  );

DROP POLICY IF EXISTS pedidos_recolha_delete_policy ON public.pedidos_recolha;
CREATE POLICY pedidos_recolha_delete_policy ON public.pedidos_recolha
  FOR DELETE TO authenticated
  USING (
    ((SELECT users.role FROM public.users WHERE users.id = (SELECT auth.uid())) = ANY (ARRAY['admin'::text, 'gestor'::text]))
  );

DROP POLICY IF EXISTS pedido_recolha_linhas_select_policy ON public.pedido_recolha_linhas;
CREATE POLICY pedido_recolha_linhas_select_policy ON public.pedido_recolha_linhas
  FOR SELECT TO authenticated
  USING (
    ((SELECT users.role FROM public.users WHERE users.id = (SELECT auth.uid())) = ANY (ARRAY['admin'::text, 'gestor'::text]))
    OR (cliente_id = (SELECT users.cliente_id FROM public.users WHERE users.id = (SELECT auth.uid())))
  );

DROP POLICY IF EXISTS pedido_recolha_linhas_insert_policy ON public.pedido_recolha_linhas;
CREATE POLICY pedido_recolha_linhas_insert_policy ON public.pedido_recolha_linhas
  FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT users.role FROM public.users WHERE users.id = (SELECT auth.uid())) = ANY (ARRAY['admin'::text, 'gestor'::text]))
    OR (cliente_id = (SELECT users.cliente_id FROM public.users WHERE users.id = (SELECT auth.uid())))
  );

DROP POLICY IF EXISTS pedido_recolha_linhas_update_policy ON public.pedido_recolha_linhas;
CREATE POLICY pedido_recolha_linhas_update_policy ON public.pedido_recolha_linhas
  FOR UPDATE TO authenticated
  USING (
    ((SELECT users.role FROM public.users WHERE users.id = (SELECT auth.uid())) = ANY (ARRAY['admin'::text, 'gestor'::text]))
    OR (cliente_id = (SELECT users.cliente_id FROM public.users WHERE users.id = (SELECT auth.uid())))
  );

DROP POLICY IF EXISTS pedido_recolha_linhas_delete_policy ON public.pedido_recolha_linhas;
CREATE POLICY pedido_recolha_linhas_delete_policy ON public.pedido_recolha_linhas
  FOR DELETE TO authenticated
  USING (
    ((SELECT users.role FROM public.users WHERE users.id = (SELECT auth.uid())) = ANY (ARRAY['admin'::text, 'gestor'::text]))
  );

