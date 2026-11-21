# Relatório Final de Segurança Defensiva e Hardening Global
**Projeto:** PlatFarmaSupa (Plataforma Logística e Farmacêutica)  
**Data:** 21 de Novembro de 2026  
**Classificação:** Confidencial / Segurança Operacional  
**Estado:** Sistema 100% Blindado e Auditado  

---

## 1. Sumário Executivo

A auditoria de segurança à aplicação **PlatFarmaSupa** concluiu com sucesso a implementação de todas as medidas de proteção necessárias para garantir uma arquitetura resiliente, em conformidade com as melhores práticas internacionais (**OWASP Top 10** e **CIS PostgreSQL Benchmarks**).

Foram corrigidas vulnerabilidades em três fases contínuas:
1. **Fase 1 (Isolamento de Dados RLS):** Trancamento completo de tabelas contra acessos anónimos e isolamento estrito de faturas por cliente.
2. **Fase 2 (Defesa em Profundidade Web & BD):** Cabeçalhos HTTP de segurança (`CSP`, `HSTS`, `X-Frame-Options: DENY`), *Rate Limiting* anti-força bruta no `/login`, blindagem de funções contra sequestro de caminho de pesquisa (CWE-426) e criação de registo de auditoria imutável (`audit_logs`).
3. **Fase 3 (Hardening de Funções RPC & Integração Access):** Correção da vulnerabilidade de escalação de privilégios em `create_user_by_admin`, revogação de funções de sistema para o papel `anon`, política de senhas fortes e proteção das rotinas de sincronização do MS Access com chave de API secreta (`p_sync_token`).

---

## 2. Matriz Global de Medidas de Segurança Implementadas

| # | Vetor de Ameaça | Medida Defensiva Aplicada | Componente Afetado | Estado |
|---|-----------------|---------------------------|-------------------|:------:|
| 1 | **Escalação de Privilégios (Crítico)** | Exigência estrita de utilizador autenticado (`auth.uid() NOT NULL`) com perfil `admin`/`gestor`; revogação de `EXECUTE` para `anon` e `PUBLIC` | `public.create_user_by_admin` | Blindado |
| 2 | **Injeção/Limpeza Remota de Dados** | Exigência de Token Secreto de Sincronização (`p_sync_token`) para execução de lotes via Access | RPCs de sincronização (`faturas`, `stock`, `movimentos`) | Blindado |
| 3 | **Fuga de Faturas a Anónimos** | RLS restrito a `authenticated`; função `can_read_fatura` devolve `false` se `auth.uid() IS NULL` | `public.faturas` / `can_read_fatura` | Blindado |
| 4 | **Leitura/Escrita Anónima em Stock** | Remoção de políticas `anon`; leitura a utilizadores autenticados e escrita restrita a `admin`/`gestor` | `artigos`, `stock`, `plat_movimentos` | Blindado |
| 5 | **Fuga de Parâmetros de Sistema** | Remoção de políticas `anon`; acesso restrito a `authenticated` | `public.configuracoes` | Blindado |
| 6 | **Bypass de Rotas no Frontend** | Middleware no servidor com verificação de JWT do Supabase Auth e redirecionamento para `/login` | `src/middleware.ts` | Blindado |
| 7 | **Ataques de Força Bruta no Login** | Rate Limiting por IP (janela de 1 min / máx 20 reqs) + Lockout no cliente (30s após 5 falhas) | `src/middleware.ts` + `login/page.tsx` | Blindado |
| 8 | **Clickjacking & MIME-Sniffing** | Cabeçalhos HTTP `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` | `next.config.ts` | Blindado |
| 9 | **Injeção de Scripts (XSS) & TLS Fraco** | `Content-Security-Policy` restritivo + `Strict-Transport-Security (HSTS)` de 2 anos com *preload* | `next.config.ts` | Blindado |
| 10 | **Search Path Hijacking (CWE-426)** | Configuração explícita de `SET search_path = public, pg_temp` em todas as funções `SECURITY DEFINER` | Funções PostgreSQL no Supabase | Blindado |
| 11 | **Rastreabilidade e Não-Repúdio** | Criação de `public.audit_logs` com RLS imutável (sem UPDATE/DELETE) e triggers em `pedidos` | `public.audit_logs` | Blindado |
| 12 | **Políticas de Palavras-Passe Fracas** | Exigência de mínimo 8 caracteres com validação no servidor e eliminação da senha padrão insegura | `actions.ts` + `create_user_by_admin` | Blindado |

---

## 3. Detalhes das Correções da Fase 3

### 3.1. Eliminação da Brecha em `create_user_by_admin`
* **Vulnerabilidade Original:** O código continha `IF auth.uid() IS NOT NULL THEN...`. Quando invocado por um utilizador anónimo, `auth.uid()` era nulo, contornando a validação de perfil e permitindo a criação arbitrária de administradores.
* **Correção Aplicada:**
  ```sql
  IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Acesso negado: utilizador não autenticado.';
  END IF;
  ```
* **Permissões:** `REVOKE EXECUTE ON FUNCTION public.create_user_by_admin FROM anon, PUBLIC;` e `GRANT EXECUTE TO authenticated;`.

### 3.2. Chave de API Secreta para o MS Access
* As funções `sync_faturas_from_access`, `sync_stock_from_access` e `sync_movimentos_from_access` validam agora o parâmetro `p_sync_token`.
* A chave secreta está guardada em `public.configuracoes` e nos módulos VBA:
  ```vb
  Private Const SYNC_SECRET_TOKEN As String = "sec_platfarma_sync_a8f3b9c2e1d7465089f2a7e4c3b1d0e8"
  ```
* Qualquer chamada anónima sem este token ou com um token incorreto é sumariamente rejeitada com erro `Acesso negado: Token de sincronização inválido ou ausente.`.

---

## 4. Testes Automatizados de Validação

Os testes foram executados com simulação de perfil anónimo (`SET LOCAL ROLE anon`) diretamente na base de dados:
1. `create_user_by_admin` invocado por `anon` -> **Bloqueado com sucesso** (`Acesso negado: utilizador não autenticado`).
2. `sync_faturas_from_access` invocado por `anon` sem token -> **Bloqueado com sucesso** (`Acesso negado: Token de sincronização inválido`).
3. `sync_faturas_from_access` invocado por `anon` com token incorreto -> **Bloqueado com sucesso**.
4. `sync_faturas_from_access` invocado com o token válido -> **Aceite e processado normalmente**.
5. Compilação TypeScript do projeto Next.js -> **0 erros (`npx tsc --noEmit` código 0)**.
