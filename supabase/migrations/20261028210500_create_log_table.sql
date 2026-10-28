-- Migration: 20261028210500_create_log_table.sql
-- Descrição: Cria a tabela public.log para registo de logins e logouts dos utilizadores,
--            com autopreenchimento de nome, data, hora, tipo_movimento e ordenação decrescente por data e hora.

-- 1. Criar a tabela public.log
CREATE TABLE IF NOT EXISTS public.log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    nome text NOT NULL,
    email text,
    role text,
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    cliente_sigla text,
    empresa text,
    tipo_movimento text NOT NULL CHECK (UPPER(TRIM(tipo_movimento)) IN ('LOGIN', 'LOGOUT')),
    data date NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Lisbon')::date,
    hora time(0) without time zone NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Lisbon')::time(0),
    ip_address text,
    user_agent text,
    observacoes text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.log IS 'Registo de auditoria de acessos (LOGIN e LOGOUT) dos utilizadores da plataforma';
COMMENT ON COLUMN public.log.nome IS 'Nome do utilizador que efetuou o movimento';
COMMENT ON COLUMN public.log.data IS 'Data do movimento (fuso horário Europe/Lisbon)';
COMMENT ON COLUMN public.log.hora IS 'Hora do movimento (fuso horário Europe/Lisbon)';
COMMENT ON COLUMN public.log.tipo_movimento IS 'Tipo de movimento de acesso: LOGIN ou LOGOUT';

-- 2. Índices para performance em consultas e filtros (ordenado por data DESC, hora DESC)
CREATE INDEX IF NOT EXISTS idx_log_user_id ON public.log(user_id);
CREATE INDEX IF NOT EXISTS idx_log_data_hora ON public.log(data DESC, hora DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_tipo_movimento ON public.log(tipo_movimento);
CREATE INDEX IF NOT EXISTS idx_log_cliente_id ON public.log(cliente_id);
CREATE INDEX IF NOT EXISTS idx_log_created_at ON public.log(created_at DESC);

-- 3. Trigger BEFORE INSERT para autopreencher dados do utilizador, data e hora caso não sejam enviados
CREATE OR REPLACE FUNCTION public.fn_autofill_log_user_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user record;
    v_sigla text;
BEGIN
    -- Normalizar tipo_movimento em maiúsculas
    IF NEW.tipo_movimento IS NOT NULL THEN
        NEW.tipo_movimento := UPPER(TRIM(NEW.tipo_movimento));
    END IF;

    -- Definir data e hora atuais (Europe/Lisbon) se nulos
    IF NEW.data IS NULL THEN
        NEW.data := (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Lisbon')::date;
    END IF;

    IF NEW.hora IS NULL THEN
        NEW.hora := (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Lisbon')::time(0);
    END IF;

    -- Identificar user_id a partir da sessão caso não venha preenchido
    IF NEW.user_id IS NULL AND auth.uid() IS NOT NULL THEN
        NEW.user_id := auth.uid();
    END IF;

    -- Obter detalhes do perfil em public.users
    IF NEW.user_id IS NOT NULL THEN
        SELECT u.full_name, u.email, u.role, u.cliente_id, u.empresa
        INTO v_user
        FROM public.users u
        WHERE u.id = NEW.user_id;

        IF FOUND THEN
            NEW.nome := COALESCE(NULLIF(TRIM(NEW.nome), ''), NULLIF(TRIM(v_user.full_name), ''), split_part(v_user.email, '@', 1), 'Utilizador');
            NEW.email := COALESCE(NEW.email, v_user.email);
            NEW.role := COALESCE(NEW.role, v_user.role);
            NEW.cliente_id := COALESCE(NEW.cliente_id, v_user.cliente_id);
            NEW.empresa := COALESCE(NEW.empresa, v_user.empresa);
        END IF;
    END IF;

    -- Garantir que nome nunca fica nulo
    IF NEW.nome IS NULL OR TRIM(NEW.nome) = '' THEN
        NEW.nome := COALESCE(split_part(NEW.email, '@', 1), 'Utilizador');
    END IF;

    -- Preencher sigla do cliente se houver cliente_id
    IF NEW.cliente_id IS NOT NULL AND NEW.cliente_sigla IS NULL THEN
        SELECT c.sigla INTO v_sigla FROM public.clientes c WHERE c.id = NEW.cliente_id;
        NEW.cliente_sigla := v_sigla;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autofill_log_user_data ON public.log;
CREATE TRIGGER trg_autofill_log_user_data
BEFORE INSERT ON public.log
FOR EACH ROW
EXECUTE FUNCTION public.fn_autofill_log_user_data();

-- 4. Trigger AFTER INSERT para manter a tabela public.log fisicamente ordenada por data DESC, hora DESC
CREATE OR REPLACE FUNCTION public.fn_keep_log_ordered_desc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NULL;
    END IF;

    CREATE TEMP TABLE IF NOT EXISTS _tmp_log_order ON COMMIT DROP AS
    SELECT * FROM public.log WITH NO DATA;

    TRUNCATE _tmp_log_order;

    INSERT INTO _tmp_log_order
    SELECT * FROM public.log
    ORDER BY data DESC, hora DESC, created_at DESC;

    DELETE FROM public.log;

    INSERT INTO public.log
    SELECT * FROM _tmp_log_order
    ORDER BY data DESC, hora DESC, created_at DESC;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_keep_log_ordered_desc ON public.log;
CREATE TRIGGER trg_keep_log_ordered_desc
AFTER INSERT ON public.log
FOR EACH STATEMENT
EXECUTE FUNCTION public.fn_keep_log_ordered_desc();

-- 5. Função RPC para registar facilmente login/logout a partir da aplicação
CREATE OR REPLACE FUNCTION public.registar_log_acesso(
    p_tipo_movimento text,
    p_user_agent text DEFAULT NULL,
    p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid;
    v_log_id uuid;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.log (
        user_id,
        nome,
        tipo_movimento,
        user_agent,
        observacoes
    ) VALUES (
        v_uid,
        '', -- preenchido automaticamente pelo trigger trg_autofill_log_user_data
        UPPER(TRIM(p_tipo_movimento)),
        p_user_agent,
        p_observacoes
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registar_log_acesso(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registar_log_acesso(text, text, text) TO authenticated, service_role;

-- 6. Ativar Row Level Security (RLS) e Políticas de Acesso
ALTER TABLE public.log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "log_select_policy" ON public.log;
CREATE POLICY "log_select_policy"
ON public.log
FOR SELECT
TO authenticated
USING (
    public.get_auth_user_role() = ANY (ARRAY['admin'::text, 'gestor'::text])
    OR (SELECT auth.uid()) = user_id
);

DROP POLICY IF EXISTS "log_insert_policy" ON public.log;
CREATE POLICY "log_insert_policy"
ON public.log
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR user_id IS NULL
    OR public.get_auth_user_role() = ANY (ARRAY['admin'::text, 'gestor'::text])
);

GRANT SELECT, INSERT ON public.log TO authenticated, service_role;

-- 7. View vw_log com ordenação explícita por data DESC, hora DESC
CREATE OR REPLACE VIEW public.vw_log WITH (security_invoker = true) AS
SELECT *
FROM public.log
ORDER BY data DESC, hora DESC, created_at DESC;

GRANT SELECT ON public.vw_log TO authenticated, service_role;
