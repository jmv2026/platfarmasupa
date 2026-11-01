# Página de Login

**Rota:** `/login`

Permite ao utilizador autenticar‑se via Supabase Auth.

- **Componente principal:** `src/app/(auth)/login/page.tsx`
- **Funcionalidade chave:** Formulário com campos de email e password, chamada à função RPC `auth.signIn`. Após sucesso, redireciona para o dashboard.
- **Permissões:** Acesso público (não autenticado).

> Consulte o código‑fonte para detalhes de validação e tratamento de erros.
