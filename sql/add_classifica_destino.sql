-- Adicionar campo classifica_destino às tabelas destinos e pedidos
ALTER TABLE public.destinos ADD COLUMN IF NOT EXISTS classifica_destino VARCHAR(100);
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS classifica_destino VARCHAR(100);

COMMENT ON COLUMN public.destinos.classifica_destino IS 'Classificação do tipo de destino (ex: Farmácia, Grupos Farmacia, Hospital, Grossista / Distribuidor, Exportação, Clínica / Centro de Saúde, Laboratório, Outro)';
COMMENT ON COLUMN public.pedidos.classifica_destino IS 'Classificação do destino registada no pedido de entrega';

