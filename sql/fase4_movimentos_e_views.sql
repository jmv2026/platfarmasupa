-- ==============================================================================
-- PLATAFORMA FARMA - FASE 4: MOVIMENTOS DE ARTIGOS E VIEWS DE STOCK
-- ==============================================================================
-- Este script define a estrutura da tabela de movimentos de stock, regras de
-- integridade referencial, restrições e views analíticas de stock por armazém.
-- ==============================================================================

-- 1. TABELA DE MOVIMENTOS DE ARTIGOS (movimentos)
CREATE TABLE IF NOT EXISTS public.movimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artigo_id UUID NOT NULL REFERENCES public.artigos(id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    tipo_movimento VARCHAR(2) NOT NULL CHECK (tipo_movimento IN ('es', 'ss', 'et', 'st')),
    quantidade NUMERIC(12, 2) NOT NULL CHECK (quantidade > 0),
    tipo_armazem VARCHAR(2) NOT NULL REFERENCES public.armazens(tipo_armazem) ON DELETE RESTRICT,
    armazem_loc VARCHAR(10) NOT NULL, -- Ex: PFIZ-01, NOVA-01
    posicao VARCHAR(30),              -- Ex: A-01-01, B-02-03
    lote VARCHAR(50),
    nr_serie VARCHAR(100),
    validade DATE,
    data_fabrico DATE,
    data_movimento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    documento_ref VARCHAR(100),
    observacoes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_movimentos_artigo_id ON public.movimentos(artigo_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_client_id ON public.movimentos(client_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_tipo_movimento ON public.movimentos(tipo_movimento);
CREATE INDEX IF NOT EXISTS idx_movimentos_tipo_armazem ON public.movimentos(tipo_armazem);
CREATE INDEX IF NOT EXISTS idx_movimentos_armazem_loc ON public.movimentos(armazem_loc);
CREATE INDEX IF NOT EXISTS idx_movimentos_lote ON public.movimentos(lote);

-- Comentários das Colunas
COMMENT ON TABLE public.movimentos IS 'Registo transacional de todos os movimentos de stock de artigos farmacêuticos.';
COMMENT ON COLUMN public.movimentos.tipo_movimento IS 'es: Entrada Stock, ss: Saída Stock, et: Entrada Transferência, st: Saída Transferência';
COMMENT ON COLUMN public.movimentos.armazem_loc IS 'Identificador do armazém do cliente (ex: Sigla + Tipo Armazém -> PFIZ-01)';

-- ------------------------------------------------------------------------------
-- 2. VIEW: vw_stock_atual (Stock Consolidado com Localização)
-- ------------------------------------------------------------------------------
-- Agrupa todos os movimentos e calcula o saldo atual por cliente, artigo, lote,
-- validade, armazem_loc e posição. Apenas inclui lotes com saldo positivo (> 0).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_stock_atual AS
SELECT 
    m.client_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    m.artigo_id,
    a.artigo_id AS artigo_codigo,
    a.descricao AS artigo_descricao,
    a.tipo_artigo,
    a.tipo_armazenamento,
    m.tipo_armazem,
    arm.descricao AS armazem_descricao,
    m.armazem_loc,
    m.posicao,
    m.lote,
    m.validade,
    m.data_fabrico,
    SUM(
        CASE 
            WHEN m.tipo_movimento IN ('es', 'et') THEN m.quantidade
            WHEN m.tipo_movimento IN ('ss', 'st') THEN -m.quantidade
            ELSE 0 
        END
    ) AS stock,
    MAX(m.data_movimento) AS ultimo_movimento
FROM public.movimentos m
JOIN public.clients c ON c.id = m.client_id
JOIN public.artigos a ON a.id = m.artigo_id
JOIN public.armazens arm ON arm.tipo_armazem = m.tipo_armazem
GROUP BY 
    m.client_id,
    c.name,
    c.sigla,
    m.artigo_id,
    a.artigo_id,
    a.descricao,
    a.tipo_artigo,
    a.tipo_armazenamento,
    m.tipo_armazem,
    arm.descricao,
    m.armazem_loc,
    m.posicao,
    m.lote,
    m.validade,
    m.data_fabrico
HAVING SUM(
    CASE 
        WHEN m.tipo_movimento IN ('es', 'et') THEN m.quantidade
        WHEN m.tipo_movimento IN ('ss', 'st') THEN -m.quantidade
        ELSE 0 
    END
) > 0;

-- ------------------------------------------------------------------------------
-- 3. VIEW: vw_stock_pedidos (Stock Disponível para Pedidos / Expedição)
-- ------------------------------------------------------------------------------
-- Similar a vw_stock_atual, mas filtra estritamente o Armazém '01' (Venda) e omite
-- armazém e posição para fins de alocação de encomendas.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_stock_pedidos AS
SELECT 
    m.client_id,
    c.name AS cliente_nome,
    c.sigla AS cliente_sigla,
    m.artigo_id,
    a.artigo_id AS artigo_codigo,
    a.descricao AS artigo_descricao,
    a.tipo_artigo,
    a.tipo_armazenamento,
    m.lote,
    m.validade,
    m.data_fabrico,
    SUM(
        CASE 
            WHEN m.tipo_movimento IN ('es', 'et') THEN m.quantidade
            WHEN m.tipo_movimento IN ('ss', 'st') THEN -m.quantidade
            ELSE 0 
        END
    ) AS stock,
    MAX(m.data_movimento) AS ultimo_movimento
FROM public.movimentos m
JOIN public.clients c ON c.id = m.client_id
JOIN public.artigos a ON a.id = m.artigo_id
WHERE m.tipo_armazem = '01'
GROUP BY 
    m.client_id,
    c.name,
    c.sigla,
    m.artigo_id,
    a.artigo_id,
    a.descricao,
    a.tipo_artigo,
    a.tipo_armazenamento,
    m.lote,
    m.validade,
    m.data_fabrico
HAVING SUM(
    CASE 
        WHEN m.tipo_movimento IN ('es', 'et') THEN m.quantidade
        WHEN m.tipo_movimento IN ('ss', 'st') THEN -m.quantidade
        ELSE 0 
    END
) > 0;
