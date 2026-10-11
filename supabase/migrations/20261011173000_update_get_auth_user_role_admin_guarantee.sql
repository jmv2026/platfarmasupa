-- Migração: Garantir que admin@sermail.pt tem perfil de admin irrestrito
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_email text;
BEGIN
  -- Verificar se é o email administrador do sistema via JWT ou UID
  IF lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@sermail.pt' OR auth.uid() = 'cdd4b712-dccb-4913-8675-985410427df1'::uuid THEN
    RETURN 'admin';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF lower(coalesce(v_email, '')) = 'admin@sermail.pt' THEN
    RETURN 'admin';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'user1');
END;
$function$;
