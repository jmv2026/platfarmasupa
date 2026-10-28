-- Adicionar campos lógicos (boolean) processado e processar à tabela public.pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS processado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS processar boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pedidos.processado IS 'Indica se o pedido já foi processado (lógico)';
COMMENT ON COLUMN public.pedidos.processar IS 'Indica se o pedido está marcado para processar (lógico)';

