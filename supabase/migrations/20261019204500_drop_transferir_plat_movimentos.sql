-- Migration: drop_transferir_plat_movimentos
-- Remove a função transferir_plat_movimentos_para_movimentos para redefinição do zero a pedido do utilizador

DROP FUNCTION IF EXISTS public.transferir_plat_movimentos_para_movimentos();
