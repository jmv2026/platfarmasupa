-- Create the acessos_log table
CREATE TABLE IF NOT EXISTS public.acessos_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.acessos_log ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs
CREATE POLICY "Gestores e Admins podem ver todos os logs" ON public.acessos_log
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'gestor')
  )
);

-- Trigger function to capture auth audit log entries
CREATE OR REPLACE FUNCTION public.handle_auth_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_action text;
  v_actor_id uuid;
BEGIN
  -- Extract action and actor_id from the JSON payload
  v_action := NEW.payload->>'action';
  v_actor_id := (NEW.payload->>'actor_id')::uuid;

  -- Log logins, logouts, etc
  IF v_action IN ('login', 'logout', 'user_signedup', 'token_refreshed', 'user_updated') THEN
    -- Only insert if the actor_id matches an existing user in public.users to maintain foreign key constraint
    IF EXISTS (SELECT 1 FROM public.users WHERE id = v_actor_id) THEN
      INSERT INTO public.acessos_log (user_id, action, ip_address, created_at)
      VALUES (v_actor_id, v_action, NEW.ip_address, NEW.created_at);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to listen for auth logs
DROP TRIGGER IF EXISTS on_auth_audit_log_insert ON auth.audit_log_entries;
CREATE TRIGGER on_auth_audit_log_insert
  AFTER INSERT ON auth.audit_log_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_audit_log();
