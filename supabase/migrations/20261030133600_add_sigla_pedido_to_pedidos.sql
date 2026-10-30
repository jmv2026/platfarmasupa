-- =====================================================================================
-- MIGRAÇÃO: Adicionar campo sigla_pedido (<SIGLA>-<nr_pedido>) na tabela public.pedidos
-- =====================================================================================

-- 1. Adicionar coluna sigla_pedido na tabela public.pedidos
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS sigla_pedido text NULL;

-- 2. Função e Trigger para preenchimento automático de sigla_pedido em INSERT / UPDATE
CREATE OR REPLACE FUNCTION public.fn_set_pedidos_sigla_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_sigla text;
BEGIN
    IF NEW.cliente_id IS NOT NULL THEN
        SELECT UPPER(TRIM(c.sigla))
        INTO v_sigla
        FROM public.clientes c
        WHERE c.id = NEW.cliente_id;
    END IF;

    IF v_sigla IS NOT NULL AND v_sigla <> '' AND NEW.nr_pedido IS NOT NULL THEN
        NEW.sigla_pedido := v_sigla || '-' || TRIM(NEW.nr_pedido);
    ELSIF NEW.nr_pedido IS NOT NULL THEN
        NEW.sigla_pedido := TRIM(NEW.nr_pedido);
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_pedidos_sigla_pedido ON public.pedidos;

CREATE TRIGGER trg_set_pedidos_sigla_pedido
BEFORE INSERT OR UPDATE OF cliente_id, nr_pedido ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_pedidos_sigla_pedido();

-- 3. Preencher retroativamente todos os pedidos já existentes
UPDATE public.pedidos p
SET sigla_pedido = UPPER(TRIM(c.sigla)) || '-' || TRIM(p.nr_pedido)
FROM public.clientes c
WHERE p.cliente_id = c.id
  AND (p.sigla_pedido IS NULL OR p.sigla_pedido <> UPPER(TRIM(c.sigla)) || '-' || TRIM(p.nr_pedido));

NOTIFY pgrst, 'reload schema';

