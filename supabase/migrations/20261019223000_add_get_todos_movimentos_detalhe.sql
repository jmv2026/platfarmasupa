-- Migration: 20261019223000_add_get_todos_movimentos_detalhe.sql
-- Permite obter a totalidade dos movimentos sem sofrer a limitação default de 1000 linhas do PostgREST

CREATE OR REPLACE FUNCTION public.get_todos_movimentos_detalhe()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(v)), '[]'::jsonb)
  FROM (
    SELECT *
    FROM public.vw_movimentos_detalhe
    ORDER BY data_movimento DESC
  ) v;
$$;

GRANT EXECUTE ON FUNCTION public.get_todos_movimentos_detalhe() TO authenticated, anon, service_role;
