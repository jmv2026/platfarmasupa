-- Correção: Tornar get_auth_user_client_id() SECURITY DEFINER para evitar recursão infinita no RLS da tabela public.users e public.clientes
CREATE OR REPLACE FUNCTION public.get_auth_user_client_id()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente_id uuid;
BEGIN
  -- Se for o administrador do sistema, não tem cliente restrito
  IF lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@sermail.pt' OR auth.uid() = 'cdd4b712-dccb-4913-8675-985410427df1'::uuid THEN
    RETURN NULL;
  END IF;

  SELECT cliente_id INTO v_cliente_id FROM public.users WHERE id = auth.uid();
  RETURN v_cliente_id;
END;
$function$;
