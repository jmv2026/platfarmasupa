-- Migration: 20261028215000_add_idioma_to_users.sql
-- Descrição: Adiciona a coluna idioma ('PT', 'EN', 'ES') à tabela public.users (padrão 'PT')
--            para iniciar a aplicação no idioma configurado para o utilizador.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS idioma text NOT NULL DEFAULT 'PT';

UPDATE public.users
SET idioma = UPPER(TRIM(COALESCE(idioma, 'PT')))
WHERE idioma IS NULL OR UPPER(TRIM(idioma)) NOT IN ('PT', 'EN', 'ES') OR idioma <> UPPER(TRIM(idioma));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_idioma_check;
ALTER TABLE public.users
ADD CONSTRAINT users_idioma_check CHECK (idioma IN ('PT', 'EN', 'ES'));

COMMENT ON COLUMN public.users.idioma IS 'Idioma predefinido do utilizador ao iniciar a aplicação (PT, EN ou ES)';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idioma text;
BEGIN
  v_idioma := UPPER(TRIM(COALESCE(new.raw_user_meta_data->>'idioma', 'PT')));
  IF v_idioma NOT IN ('PT', 'EN', 'ES') THEN
    v_idioma := 'PT';
  END IF;

  INSERT INTO public.users (id, email, full_name, role, cliente_id, empresa, ativo, idioma)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'user1'),
    NULLIF(COALESCE(new.raw_user_meta_data->>'cliente_id', new.raw_user_meta_data->>'client_id'), '')::uuid,
    COALESCE(new.raw_user_meta_data->>'empresa', 'Sermail, Logística Integrada Lda'),
    COALESCE((new.raw_user_meta_data->>'ativo')::boolean, true),
    v_idioma
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(public.users.full_name, EXCLUDED.full_name),
    role = COALESCE(public.users.role, EXCLUDED.role),
    cliente_id = COALESCE(public.users.cliente_id, EXCLUDED.cliente_id),
    empresa = COALESCE(public.users.empresa, EXCLUDED.empresa),
    ativo = COALESCE(public.users.ativo, EXCLUDED.ativo, true),
    idioma = COALESCE(public.users.idioma, EXCLUDED.idioma, 'PT'),
    updated_at = now();
  RETURN new;
END;
$$;

