-- ==============================================================================
-- ADIÇÃO DO CAMPO tipo_cliente À TABELA public.clients
-- ==============================================================================
-- Descrição: Cria o campo tipo_cliente para distinguir clientes com faturação
--            (CF) e sem faturação (SF). Valor por defeito: 'SF'.
-- ==============================================================================

-- 1. Adicionar a coluna tipo_cliente com constraint de validação e valor por defeito 'SF'
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS tipo_cliente TEXT NOT NULL DEFAULT 'SF' 
CONSTRAINT clients_tipo_cliente_check CHECK (tipo_cliente IN ('CF', 'SF'));

-- 2. Adicionar comentário descritivo na coluna
COMMENT ON COLUMN public.clients.tipo_cliente IS 'Tipo de cliente: CF (Com Faturação) ou SF (Sem Faturação)';
