-- Trigger on_user_login was attempting to insert into public.acessos_log, which was dropped in migration 20261004114400.
-- This caused login to fail with "Database error Granting user".
DROP TRIGGER IF EXISTS on_user_login ON auth.users;
DROP FUNCTION IF EXISTS public.handle_user_login();
