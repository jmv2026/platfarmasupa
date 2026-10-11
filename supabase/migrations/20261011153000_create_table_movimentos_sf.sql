-- Migration: create table movimentos_sf
-- Criar tabela movimentos_sf identica a movimentos para alojar dados de clientes SF

CREATE TABLE IF NOT EXISTS public.movimentos_sf (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    artigo_cli text NOT NULL,
    sigla character varying,
    tipo_movimento text NOT NULL,
    quantidade numeric NOT NULL,
    tipo_armazem text NOT NULL,
    armazem_loc text NOT NULL,
    posicao text,
    lote text,
    nr_serie text,
    validade date,
    data_fabrico date,
    data_movimento timestamp with time zone DEFAULT now() NOT NULL,
    documento_ref text,
    doc_linha text,
    requisicao text,
    entidade text,
    num_contribuinte text,
    nome text,
    morada text,
    localidade text,
    cod_postal text,
    cod_postal_localidade text,
    ref_ser text,
    observacoes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT movimentos_sf_pkey PRIMARY KEY (id),
    CONSTRAINT movimentos_sf_quantidade_check CHECK ((quantidade > (0)::numeric)),
    CONSTRAINT movimentos_sf_tipo_movimento_check CHECK ((tipo_movimento = ANY (ARRAY['es'::text, 'ss'::text, 'et'::text, 'st'::text]))),
    CONSTRAINT movimentos_sf_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE RESTRICT,
    CONSTRAINT movimentos_sf_artigo_id_fkey FOREIGN KEY (artigo_cli) REFERENCES public.artigos(artigo_cli) ON DELETE RESTRICT,
    CONSTRAINT movimentos_sf_tipo_armazem_fkey FOREIGN KEY (tipo_armazem) REFERENCES public.armazens(tipo_armazem) ON DELETE RESTRICT,
    CONSTRAINT movimentos_sf_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_movimentos_sf_cliente_id ON public.movimentos_sf USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_sf_tipo_armazem ON public.movimentos_sf USING btree (tipo_armazem);
CREATE INDEX IF NOT EXISTS idx_movimentos_sf_armazem_loc ON public.movimentos_sf USING btree (armazem_loc);
CREATE INDEX IF NOT EXISTS idx_movimentos_sf_lote ON public.movimentos_sf USING btree (lote);
CREATE INDEX IF NOT EXISTS idx_movimentos_sf_tipo_movimento ON public.movimentos_sf USING btree (tipo_movimento);
CREATE INDEX IF NOT EXISTS idx_movimentos_sf_data_movimento ON public.movimentos_sf USING btree (data_movimento);
CREATE INDEX IF NOT EXISTS idx_movimentos_sf_sigla ON public.movimentos_sf USING btree (sigla);

-- Trigger de sincronização de sigla
DROP TRIGGER IF EXISTS trg_sync_movimento_sf_sigla ON public.movimentos_sf;
CREATE TRIGGER trg_sync_movimento_sf_sigla
    BEFORE INSERT OR UPDATE ON public.movimentos_sf
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_movimento_sigla();

-- Enable RLS
ALTER TABLE public.movimentos_sf ENABLE ROW LEVEL SECURITY;

-- Permissions for Data API / PostgREST
GRANT ALL ON public.movimentos_sf TO authenticated;
GRANT ALL ON public.movimentos_sf TO service_role;

-- RLS Policies
DROP POLICY IF EXISTS "Permitir gestão de movimentos_sf para administradores" ON public.movimentos_sf;
CREATE POLICY "Permitir gestão de movimentos_sf para administradores"
    ON public.movimentos_sf
    FOR ALL
    TO authenticated
    USING (((SELECT users.role FROM public.users WHERE users.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gestor'::text])));

DROP POLICY IF EXISTS "Permitir leitura de movimentos_sf conforme perfil" ON public.movimentos_sf;
CREATE POLICY "Permitir leitura de movimentos_sf conforme perfil"
    ON public.movimentos_sf
    FOR SELECT
    TO authenticated
    USING (
        ((SELECT users.role FROM public.users WHERE users.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gestor'::text]))
        OR (cliente_id = (SELECT users.cliente_id FROM public.users WHERE users.id = auth.uid()))
    );

DROP POLICY IF EXISTS "Permitir inserção de movimentos_sf para utilizadores autorizados" ON public.movimentos_sf;
CREATE POLICY "Permitir inserção de movimentos_sf para utilizadores autorizados"
    ON public.movimentos_sf
    FOR INSERT
    TO authenticated
    WITH CHECK (
        ((SELECT users.role FROM public.users WHERE users.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gestor'::text]))
        OR (
            ((SELECT users.role FROM public.users WHERE users.id = auth.uid()) = ANY (ARRAY['user1'::text, 'user2'::text]))
            AND (cliente_id = (SELECT users.cliente_id FROM public.users WHERE users.id = auth.uid()))
        )
    );
