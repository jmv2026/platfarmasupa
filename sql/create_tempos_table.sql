-- ==============================================================================
-- CRIAÇÃO DA TABELA public.tempos (Colunas em Maiúsculas - 5 Tipos Regulamentares)
-- ==============================================================================
-- Descrição: Parametrização de dias de Validade (VAL - 180d) e Expirados (EXP - 60d)
--            por tipo regulamentar (MH, MV, DM, DC, SC) para cada cliente.
-- ==============================================================================

-- 1. Criação da tabela
DROP TABLE IF EXISTS public.tempos CASCADE;

CREATE TABLE public.tempos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_cliente UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
    sigla VARCHAR(10) NOT NULL,
    
    -- Medicamentos Uso Humano (MH)
    "VAL_MH" INTEGER NOT NULL DEFAULT 180 CONSTRAINT chk_tempos_val_mh CHECK ("VAL_MH" >= 0),
    "EXP_MH" INTEGER NOT NULL DEFAULT 60 CONSTRAINT chk_tempos_exp_mh CHECK ("EXP_MH" >= 0),
    
    -- Medicamentos Uso Veterinário (MV)
    "VAL_MV" INTEGER NOT NULL DEFAULT 180 CONSTRAINT chk_tempos_val_mv CHECK ("VAL_MV" >= 0),
    "EXP_MV" INTEGER NOT NULL DEFAULT 60 CONSTRAINT chk_tempos_exp_mv CHECK ("EXP_MV" >= 0),
    
    -- Dispositivos Médicos (DM)
    "VAL_DM" INTEGER NOT NULL DEFAULT 180 CONSTRAINT chk_tempos_val_dm CHECK ("VAL_DM" >= 0),
    "EXP_DM" INTEGER NOT NULL DEFAULT 60 CONSTRAINT chk_tempos_exp_dm CHECK ("EXP_DM" >= 0),
    
    -- Dermo-Cosméticos (DC)
    "VAL_DC" INTEGER NOT NULL DEFAULT 180 CONSTRAINT chk_tempos_val_dc CHECK ("VAL_DC" >= 0),
    "EXP_DC" INTEGER NOT NULL DEFAULT 60 CONSTRAINT chk_tempos_exp_dc CHECK ("EXP_DC" >= 0),
    
    -- Suplementos Alimentares (SA)
    "VAL_SA" INTEGER NOT NULL DEFAULT 180 CONSTRAINT chk_tempos_val_sa CHECK ("VAL_SA" >= 0),
    "EXP_SA" INTEGER NOT NULL DEFAULT 60 CONSTRAINT chk_tempos_exp_sa CHECK ("EXP_SA" >= 0),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Comentários explicativos
COMMENT ON TABLE public.tempos IS 'Parametrização de dias de Validade (VAL - 180d) e Expirados (EXP - 60d) por tipo regulamentar para cada cliente.';
COMMENT ON COLUMN public.tempos.id_cliente IS 'Chave estrangeira única para a tabela clients (id)';
COMMENT ON COLUMN public.tempos.sigla IS 'Sigla replicada da tabela clients';

-- 3. Índices de performance
CREATE INDEX IF NOT EXISTS idx_tempos_id_cliente ON public.tempos(id_cliente);
CREATE INDEX IF NOT EXISTS idx_tempos_sigla ON public.tempos(sigla);

-- 4. Habilitar RLS
ALTER TABLE public.tempos ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Segurança (RLS)
CREATE POLICY "tempos_select_policy" ON public.tempos
    FOR SELECT TO authenticated
    USING (
        ((SELECT users.role FROM public.users WHERE users.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gestor'::text]))
        OR (id_cliente = (SELECT users.client_id FROM public.users WHERE users.id = auth.uid()))
    );

CREATE POLICY "tempos_all_admin_gestor_policy" ON public.tempos
    FOR ALL TO authenticated
    USING (
        (SELECT users.role FROM public.users WHERE users.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gestor'::text])
    )
    WITH CHECK (
        (SELECT users.role FROM public.users WHERE users.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gestor'::text])
    );
