-- ==============================================================================
-- PLATAFORMA FARMA - FASE 5: GESTÃO DE PEDIDOS & EXPEDIÇÃO DE STOCKS
-- ==============================================================================
-- Este script define a estrutura das tabelas de cabeçalho de pedidos (pedidos)
-- e linhas de pedido (pedido_linhas), relacionamentos com clientes, artigos e
-- regras de expedição com movimentos de saída de stock (SS).
-- ==============================================================================

-- 1. TABELA DE CABEÇALHO DE PEDIDOS (pedidos)
CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nr_pedido VARCHAR(50) NOT NULL UNIQUE,
    ref_documento VARCHAR(100),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    
    -- Dados de Destino
    nome_destinatario VARCHAR(255) NOT NULL,
    morada TEXT NOT NULL,
    codigo_postal VARCHAR(20) NOT NULL,
    localidade VARCHAR(100) NOT NULL,
    pais VARCHAR(100) NOT NULL DEFAULT 'Portugal',
    
    -- Datas e Estado
    data_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
    data_entrega DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    observacoes TEXT,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de Performance em Pedidos
CREATE INDEX IF NOT EXISTS idx_pedidos_client_id ON public.pedidos(client_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_nr_pedido ON public.pedidos(nr_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON public.pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_data_pedido ON public.pedidos(data_pedido);

-- 2. TABELA DE LINHAS DO PEDIDO (pedido_linhas)
CREATE TABLE IF NOT EXISTS public.pedido_linhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    artigo_id UUID NOT NULL REFERENCES public.artigos(id) ON DELETE RESTRICT,
    artigo_codigo VARCHAR(50) NOT NULL,
    descricao TEXT NOT NULL,
    lote VARCHAR(50) NOT NULL,
    validade DATE,
    quantidade NUMERIC(12, 2) NOT NULL CHECK (quantidade > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de Performance em Linhas
CREATE INDEX IF NOT EXISTS idx_pedido_linhas_pedido_id ON public.pedido_linhas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_linhas_artigo_id ON public.pedido_linhas(artigo_id);
CREATE INDEX IF NOT EXISTS idx_pedido_linhas_lote ON public.pedido_linhas(lote);

-- Comentários das Tabelas
COMMENT ON TABLE public.pedidos IS 'Cabeçalhos de pedidos de expedição com dados de destino e destinatário.';
COMMENT ON TABLE public.pedido_linhas IS 'Linhas de produtos de cada pedido associadas a lotes farmacêuticos provenientes da view vw_stock_pedidos.';
