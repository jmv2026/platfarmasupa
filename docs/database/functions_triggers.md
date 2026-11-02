# Funções RPC e Triggers — Base de Dados Supabase (`public`)

Este documento cataloga as funções PostgreSQL (RPCs e funções de trigger) e os triggers ativos no esquema `public`.

---

## 1. Funções RPC Principais

### 1.1 `public.transferir_plat_movimentos_para_movimentos()`
- **Retorno:** `jsonb` (`inserted_headers`, `inserted_lines`, `skipped_count`, `errors`)
- **Definida em:** `20261028214500_optimize_transferir_plat_movimentos.sql`
- **Descrição:** Transfere em lote (set-based) os registos importados na tabela de staging `public.plat_movimentos` para as tabelas definitivas `public.movimentos` (cabeçalhos) e `public.movimentos_linhas` (linhas), validando a existência de clientes, artigos (`cli_primavera` / `artigo_cli`) e tipos de armazém, e sincronizando a validade dos lotes.

### 1.2 `public.sincronizar_pedido_para_movimentos(p_pedido_id uuid)`
- **Retorno:** `void`
- **Definida em:** `20261101101500_add_stock_field_to_pedidos.sql`
- **Descrição:** Sincroniza um pedido com as tabelas `movimentos` e `movimentos_linhas` para clientes demo (`DDD`):
  - Se o pedido tiver `stock = false` ou `status = 'cancelado'`, remove eventual movimento associado para repor o stock.
  - Se o pedido tiver `stock = true` e estiver concluído (`status = 'concluido'` ou `processado = true`), cria ou atualiza o cabeçalho em `public.movimentos` e as linhas de saída (`tipo_movimento = 'ss'`) em `public.movimentos_linhas`.

### 1.3 `public.sync_stock_from_access(p_rows jsonb)`
- **Retorno:** `jsonb`
- **Definida em:** `20261029203000_create_sync_stock_from_access_rpc.sql`
- **Descrição:** Sincroniza o snapshot de stock proveniente do sistema Access/ERP para a tabela `public.stock`, resolvendo siglas de clientes e códigos de artigos.

### 1.4 `public.get_todos_movimentos_detalhe()`
- **Retorno:** ` SETOF record`
- **Definida em:** `20261019223000_add_get_todos_movimentos_detalhe.sql`
- **Descrição:** Retorna o detalhe completo de movimentos combinando cabeçalhos e linhas para consulta administrativa.

### 1.5 `public.registar_log_acesso(p_tipo_movimento text, p_user_agent text, p_observacoes text, p_user_id uuid)`
- **Retorno:** `void`
- **Definida em:** `20261028210500_create_log_table.sql`
- **Descrição:** Regista eventos de `LOGIN` e `LOGOUT` na tabela de auditoria `public.log`.

### 1.6 Funções Auxiliares de Autenticação e RLS
- **`public.get_auth_user_role()`**: Retorna o `role` (`admin`, `gestor`, `user1`, `user2`) do utilizador autenticado (`auth.uid()`), com `SECURITY DEFINER` para evitar recursão infinita nas políticas RLS (`20261011173000_update_get_auth_user_role_admin_guarantee.sql`).
- **`public.get_auth_user_client_id()`**: Retorna o `cliente_id` associado ao utilizador autenticado com `SECURITY DEFINER` (`20261011180000_fix_get_auth_user_client_id_recursion.sql`).

---

## 2. Triggers e Funções de Trigger

### 2.1 `trg_pedidos_sync_movimentos` (Tabela `public.pedidos`)
- **Evento:** `AFTER INSERT OR UPDATE OF status, processado, stock ON public.pedidos`
- **Função executada:** `public.trg_fn_pedidos_sync_movimentos()`
- **Definido em:** `20261101101500_add_stock_field_to_pedidos.sql`
- **Comportamento:** Sempre que um pedido é inserido ou vê alterado o seu `status`, `processado` ou flag booleana `stock`, invoca `public.sincronizar_pedido_para_movimentos(NEW.id)` para manter os movimentos e o stock em total coerência.

### 2.2 `trg_set_sigla_pedido` (Tabela `public.pedidos`)
- **Evento:** `BEFORE INSERT OR UPDATE OF cliente_id, nr_pedido ON public.pedidos`
- **Função executada:** `public.fn_set_sigla_pedido()`
- **Definido em:** `20261030133600_add_sigla_pedido_to_pedidos.sql`
- **Comportamento:** Preenche automaticamente a coluna `sigla_pedido` no formato `<SIGLA_CLIENTE>-<NR_PEDIDO>` (ex.: `DDD-2026-0001`).

### 2.3 `trg_set_datetime_proc_pedidos` (Tabela `public.pedidos`)
- **Evento:** `BEFORE INSERT OR UPDATE OF processado ON public.pedidos`
- **Função executada:** `public.fn_set_datetime_proc_pedidos()`
- **Definido em:** `20261029140500_add_datetime_proc_to_pedidos.sql`
- **Comportamento:** Regista automaticamente o timestamp `datetime_proc = now()` quando `processado` passa a `true`, ou limpa para `NULL` se `processado` passar a `false`.

### 2.4 `trg_sync_movimento_sigla` / `trg_sync_movimento_sf_sigla`
- **Tabelas:** `public.movimentos`, `public.movimentos_sf`
- **Evento:** `BEFORE INSERT OR UPDATE`
- **Função executada:** `public.fn_sync_movimento_sigla()`
- **Comportamento:** Sincroniza automaticamente a coluna `sigla` do movimento a partir de `public.clientes` com base em `cliente_id`.

### 2.5 Sincronização de Validades de Lote (`20261026154500_sync_stock_validade_and_update_views.sql`)
- Mantém as datas de validade consistentes entre entradas de movimentos (`movimentos_linhas`) e os registos de lote em `public.stock`.

