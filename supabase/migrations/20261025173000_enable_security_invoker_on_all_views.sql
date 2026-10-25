-- Migração para aplicar políticas de RLS a todas as views do esquema public
-- No PostgreSQL / Supabase, as views não suportam 'ENABLE ROW LEVEL SECURITY' diretamente;
-- Para que as views respeitem e apliquem as políticas de RLS das tabelas subjacentes
-- de acordo com o utilizador que executa a query (evitando que operem como SECURITY DEFINER),
-- é configurada a propriedade 'security_invoker = true'.

ALTER VIEW public.vw_saidas SET (security_invoker = true);
ALTER VIEW public.vw_pedidos SET (security_invoker = true);
ALTER VIEW public."VW_torrestir_last" SET (security_invoker = true);
ALTER VIEW public.vw_stock_pedidos SET (security_invoker = true);
ALTER VIEW public.vw_stock_atual SET (security_invoker = true);
ALTER VIEW public.vw_fact_mes SET (security_invoker = true);
ALTER VIEW public.vw_movimentos_detalhe SET (security_invoker = true);
ALTER VIEW public.vw_stock_zero SET (security_invoker = true);

-- Garantir concessão de permissões de leitura às roles da aplicação
GRANT SELECT ON public.vw_saidas TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_pedidos TO authenticated, anon, service_role;
GRANT SELECT ON public."VW_torrestir_last" TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_stock_pedidos TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_stock_atual TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_fact_mes TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_movimentos_detalhe TO authenticated, anon, service_role;
GRANT SELECT ON public.vw_stock_zero TO authenticated, anon, service_role;
