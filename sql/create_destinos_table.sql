-- ==============================================================================
-- PLATAFORMA FARMA - TABELA DE DESTINOS / ENTIDADES DE EXPEDIÇÃO
-- ==============================================================================
-- Estrutura para armazenamento e gestão de entidades de destino de pedidos.
-- Regra de código: Cada destino tem um código único no formato [SIGLA_CLIENTE]-[0001],
-- gerado e incrementado automaticamente a partir do 0001 para cada cliente.
-- ==============================================================================

-- 1. TABELA DE DESTINOS (destinos)
CREATE TABLE IF NOT EXISTS public.destinos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    morada TEXT NOT NULL,
    codigo_postal VARCHAR(20) NOT NULL,
    localidade VARCHAR(100) NOT NULL,
    pais VARCHAR(100) NOT NULL DEFAULT 'Portugal',
    nif VARCHAR(50),
    telefone VARCHAR(50),
    email VARCHAR(255),
    observacoes TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_destinos_client_codigo UNIQUE (client_id, codigo)
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_destinos_client_id ON public.destinos(client_id);
CREATE INDEX IF NOT EXISTS idx_destinos_codigo ON public.destinos(codigo);
CREATE INDEX IF NOT EXISTS idx_destinos_nome ON public.destinos(nome);
CREATE INDEX IF NOT EXISTS idx_destinos_ativo ON public.destinos(ativo);

-- 2. FUNÇÃO E TRIGGER PARA GERAÇÃO AUTOMÁTICA DO CÓDIGO [SIGLA]-0001
CREATE OR REPLACE FUNCTION public.fn_gerar_codigo_destino()
RETURNS TRIGGER AS $$
DECLARE
    v_sigla VARCHAR(50);
    v_max_num INTEGER;
BEGIN
    -- Obter a sigla do cliente
    SELECT sigla INTO v_sigla
    FROM public.clients
    WHERE id = NEW.client_id;

    IF v_sigla IS NULL OR TRIM(v_sigla) = '' THEN
        RAISE EXCEPTION 'Cliente não encontrado ou sem sigla definida';
    END IF;

    -- Se o código não foi fornecido explicitamente, calcular o próximo número
    IF NEW.codigo IS NULL OR TRIM(NEW.codigo) = '' THEN
        SELECT COALESCE(
            MAX(
                CASE 
                    WHEN codigo ~ ('^' || v_sigla || '-[0-9]+$') 
                    THEN SUBSTRING(codigo FROM LENGTH(v_sigla) + 2)::INTEGER 
                    ELSE 0 
                END
            ), 0
        ) + 1
        INTO v_max_num
        FROM public.destinos
        WHERE client_id = NEW.client_id;

        NEW.codigo := v_sigla || '-' || LPAD(v_max_num::TEXT, 4, '0');
    END IF;

    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gerar_codigo_destino ON public.destinos;
CREATE TRIGGER trg_gerar_codigo_destino
BEFORE INSERT OR UPDATE ON public.destinos
FOR EACH ROW
EXECUTE FUNCTION public.fn_gerar_codigo_destino();

-- 3. POLÍTICAS DE SEGURANÇA ROW LEVEL SECURITY (RLS)
ALTER TABLE public.destinos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS destinos_select_policy ON public.destinos;
CREATE POLICY destinos_select_policy ON public.destinos
FOR SELECT TO authenticated
USING (
    ((SELECT users.role FROM users WHERE users.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gestor'::text])) 
    OR (client_id = (SELECT users.client_id FROM users WHERE users.id = auth.uid()))
);

DROP POLICY IF EXISTS destinos_insert_policy ON public.destinos;
CREATE POLICY destinos_insert_policy ON public.destinos
FOR INSERT TO authenticated
WITH CHECK (
    ((SELECT users.role FROM users WHERE users.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gestor'::text])) 
    OR (client_id = (SELECT users.client_id FROM users WHERE users.id = auth.uid()))
);

DROP POLICY IF EXISTS destinos_update_policy ON public.destinos;
CREATE POLICY destinos_update_policy ON public.destinos
FOR UPDATE TO authenticated
USING (
    ((SELECT users.role FROM users WHERE users.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gestor'::text])) 
    OR (client_id = (SELECT users.client_id FROM users WHERE users.id = auth.uid()))
);

DROP POLICY IF EXISTS destinos_delete_policy ON public.destinos;
CREATE POLICY destinos_delete_policy ON public.destinos
FOR DELETE TO authenticated
USING (
    (SELECT users.role FROM users WHERE users.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gestor'::text])
);

-- 4. ATUALIZAÇÃO DA TABELA DE PEDIDOS COM FK PARA DESTINOS
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS destino_id UUID REFERENCES public.destinos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_destino_id ON public.pedidos(destino_id);

-- 5. MIGRAÇÃO DE DESTINOS EXISTENTES A PARTIR DOS PEDIDOS
INSERT INTO public.destinos (client_id, codigo, nome, morada, codigo_postal, localidade, pais, ativo)
SELECT DISTINCT p.client_id, '', p.nome_destinatario, p.morada, p.codigo_postal, p.localidade, p.pais, true
FROM public.pedidos p
WHERE NOT EXISTS (
    SELECT 1 FROM public.destinos d
    WHERE d.client_id = p.client_id
      AND d.nome = p.nome_destinatario
      AND d.morada = p.morada
      AND d.codigo_postal = p.codigo_postal
);

UPDATE public.pedidos p
SET destino_id = d.id
FROM public.destinos d
WHERE p.destino_id IS NULL
  AND p.client_id = d.client_id
  AND p.nome_destinatario = d.nome
  AND p.morada = d.morada
  AND p.codigo_postal = d.codigo_postal;
