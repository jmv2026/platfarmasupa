-- Migration: 20261029140500_add_datetime_proc_to_pedidos.sql
-- Descrição: Cria o campo datetime_proc (timestamptz) na tabela public.pedidos e preenche-o
--            automaticamente sempre que o campo processar for selecionado (true).

-- 1. Adicionar coluna datetime_proc à tabela public.pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS datetime_proc timestamp with time zone NULL;

COMMENT ON COLUMN public.pedidos.datetime_proc IS 'Data e hora em que o campo processar foi selecionado';

-- 2. Função e Trigger para preencher automaticamente datetime_proc quando processar passa a true
CREATE OR REPLACE FUNCTION public.fn_set_pedidos_datetime_proc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.processar IS TRUE AND NEW.datetime_proc IS NULL THEN
      NEW.datetime_proc := now();
    ELSIF NEW.processar IS NOT TRUE THEN
      NEW.datetime_proc := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.processar IS TRUE AND (OLD.processar IS DISTINCT FROM TRUE OR NEW.datetime_proc IS NULL) THEN
      NEW.datetime_proc := now();
    ELSIF NEW.processar IS NOT TRUE THEN
      NEW.datetime_proc := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_pedidos_datetime_proc ON public.pedidos;
CREATE TRIGGER trg_set_pedidos_datetime_proc
BEFORE INSERT OR UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_pedidos_datetime_proc();

-- 3. Preencher datetime_proc para eventuais pedidos já com processar = true
UPDATE public.pedidos
SET datetime_proc = COALESCE(datetime_proc, updated_at, now())
WHERE processar IS TRUE AND datetime_proc IS NULL;

NOTIFY pgrst, 'reload schema';

