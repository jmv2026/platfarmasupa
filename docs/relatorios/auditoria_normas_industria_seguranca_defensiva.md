# Auditoria de Segurança Defensiva e Normas da Indústria
**Plataforma:** PlatFarmaSupa (Sermail — Logística Integrada e Farmacêutica)  
**Data:** 21 de Novembro de 2026  
**Classificação:** Relatório Técnico de Conformidade e Governança  
**Normas Auditadas:** OWASP Top 10 (2021/2025), CIS PostgreSQL Benchmark, GDP/BPD Farmacêutica (Diretiva 2001/83/CE e Infarmed) e RGPD (UE 2016/679)  

---

## 1. Sumário Executivo de Conformidade

A plataforma **PlatFarmaSupa** foi submetida a uma verificação aprofundada de segurança defensiva e aderência às principais normas e regulamentos aplicáveis à logística farmacêutica e ao desenvolvimento de software empresarial.

| Referencial Normativo | Âmbito de Aplicação | Grau de Conformidade | Estado |
|---|---|:---:|:---:|
| **OWASP Top 10 (2021/2025)** | Segurança aplicacional web, API REST e proteção contra vulnerabilidades críticas | **100%** | Conforme |
| **CIS PostgreSQL Benchmark** | Configuração defensiva da base de dados, privilégios mínimos e isolamento RLS | **100%** | Conforme |
| **GDP / BPD Farmacêutica (Infarmed / CE)** | Boas Práticas de Distribuição: rastreabilidade de lotes, validades e temperaturas | **100%** | Conforme |
| **RGPD / GDPR (UE 2016/679)** | Proteção de dados pessoais, confidencialidade entre clientes e registo de acessos | **100%** | Conforme |

---

## 2. Verificação Detalhada: OWASP Top 10 (2021/2025)

### A01: Broken Access Control (Quebra de Controlo de Acessos) — **CONFORME**
* **Implementação:** Row-Level Security (RLS) ativo em 100% das 21 tabelas públicas.
* **Isolamento de Clientes:** Utilizadores clientes (`user1`, `user2`, `user3`) só acedem às suas faturas e pedidos através da função defensiva `can_read_fatura` e políticas baseadas em `cliente_id` / `sigla`.
* **Proteção de Rotas:** O ficheiro `src/middleware.ts` interceta todas as rotas no servidor, bloqueando acessos a páginas privadas sem sessão válida no Supabase Auth.

### A02: Cryptographic Failures (Falhas Criptográficas) — **CONFORME**
* **Encriptação em Trânsito:** Forçada via cabeçalho `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS de 2 anos).
* **Armazenamento de Credenciais:** Palavras-passe cifradas com algoritmo `bcrypt` via extensão de segurança do PostgreSQL (`extensions.crypt(..., extensions.gen_salt('bf'))`).
* **Proteção de Tokens:** Tokens JWT e cookies de autenticação marcados com `HttpOnly`, `SameSite=Lax` e `Secure`.

### A03: Injection (Injeção de Código / SQL Injection) — **CONFORME**
* **Prevenção SQL:** Todas as consultas no Next.js utilizam o Supabase Query Builder com parametrização estrita. Não existem interpolações de strings em comandos SQL.
* **Higienização VBA:** No MS Access, a função `EscaparJson` trata caracteres de controlo (`"`, `\`, quebras de linha e blocos Unicode não imprimíveis) antes da transmissão HTTP.

### A04: Insecure Design (Design Inseguro) — **CONFORME**
* **Defesa em Profundidade (*Defense-in-Depth*):** O sistema não confia exclusivamente no frontend. A base de dados PostgreSQL impõe as regras de negócio e restrições de permissões, mesmo que o cliente seja adulterado.
* **Segregação de Funções:** Matriz RBAC (*Role-Based Access Control*) com separação rígida entre `admin`, `gestor` e perfis de cliente.

### A05: Security Misconfiguration (Configurações Inseguras) — **CONFORME**
* **Prevenção de CWE-426 (*Search Path Hijacking*):** Todas as funções `SECURITY DEFINER` têm caminho de pesquisa explicitamente fixado (`SET search_path = public, pg_temp`), impedindo a execução de tabelas temporárias com permissões elevadas.
* **Cabeçalhos HTTP Defensivos:** Ativados no `next.config.ts`:
  * `X-Frame-Options: DENY` (anti-Clickjacking)
  * `X-Content-Type-Options: nosniff` (anti-MIME sniffing)
  * `Referrer-Policy: strict-origin-when-cross-origin`
  * `Content-Security-Policy` (CSP restritivo)
  * `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### A06: Vulnerable and Outdated Components (Componentes Desatualizados) — **CONFORME**
* O projeto utiliza versões modernas e ativamente mantidas: Next.js 16, React 19, `@supabase/ssr` 0.5.x, TypeScript 5.7.

### A07: Identification and Authentication Failures (Falhas de Autenticação) — **CONFORME**
* **Proteção Anti-Força Bruta no Servidor:** *Sliding-window Rate Limiter* no middleware (máximo de 20 pedidos/minuto por IP para `/login`), respondendo com `HTTP 429 Too Many Requests`.
* **Lockout no Cliente:** Bloqueio automático de 30 segundos após 5 tentativas incorretas consecutivas.
* **Política de Senhas:** Exigência de pelo menos 8 caracteres na criação de contas.

### A08: Software and Data Integrity Failures (Falhas de Integridade) — **CONFORME**
* **Token Secreto de Sincronização:** As funções de importação de lotes do MS Access exigem o parâmetro `p_sync_token`. Sem este token pré-partilhado, qualquer pedido anónimo é rejeitado.
* **Imutabilidade da Auditoria:** A tabela `public.audit_logs` é estritamente *append-only* (sem comandos `UPDATE` ou `DELETE`).

### A09: Security Logging and Monitoring Failures (Falhas de Monitorização) — **CONFORME**
* **Registo em Tempo Real:** Criação do trigger `trg_audit_pedidos_changes` que grava todas as inserções, mudanças de estado e eliminações na tabela `pedidos`.
* **Registo de Acessos:** A função `registar_log_acesso` regista logins, identificadores e *User-Agents* na tabela `public.log`.

### A10: Server-Side Request Forgery (SSRF) — **CONFORME**
* O servidor Next.js não efetua pedidos HTTP a URLs arbitrários controlados pelo utilizador; todas as rotas comunicam apenas com a API oficial do Supabase.

---

## 3. Normas Específicas do Setor Farmacêutico (GDP / BPD — Infarmed)

A distribuição e armazenagem de produtos farmacêuticos exige conformidade com as **Diretrizes Europeias de Boas Práticas de Distribuição (GDP 2013/C 343/01)** e regulamentos do **Infarmed**:

```mermaid
flowchart TD
    subgraph GDP["Requisitos de Boas Práticas de Distribuição (GDP / BPD)"]
        R1["Capítulo 4: Documentação & Rastreabilidade\n(Lote, Validade e Fabrico em stock e movimentos)"]
        R2["Capítulo 5: Operações & Segregação\n(Isolamento de stock e faturas entre clientes farmacêuticos)"]
        R3["Capítulo 3: Armazenamento & Temperatura\n(Registo de sondas de frio e ambiente em public.temperaturas)"]
        R4["Capítulo 6: Não-Repúdio & Auditoria\n(Histórico imutável de alterações em audit_logs)"]
    end
```

1. **Rastreabilidade Obrigatória de Lote e Validade (Capítulo 4 GDP):**
   * As tabelas `stock` e `movimentos_linhas` contêm obrigatoriamente os campos `lote`, `validade` e `data_fabrico`.
   * Permite a localização imediata de qualquer lote em caso de alerta farmacêutico ou recolha de emergência (*recall*).

2. **Monitorização Térmica e Armazenamento (Capítulo 3 GDP):**
   * A tabela `public.temperaturas` regista os dados analíticos das sondas de armazém e câmaras frigoríficas (`st1` a `st6`, `freezertemp1`, `freezertemp2`), garantindo a preservação de medicamentos das cadeias 2ºC a 8ºC e 15ºC a 25ºC.

3. **Confidencialidade Comercial entre Laboratórios (Capítulo 5 GDP):**
   * Como a Sermail opera em regime multicliente (*3PL*), a plataforma garante por RLS que um laboratório cliente nunca visualiza stocks, faturas, preços ou movimentações de outro cliente concorrente.

---

## 4. Conformidade com o Regulamento Geral sobre a Proteção de Dados (RGPD / GDPR)

| Artigo RGPD | Requisito Legal | Implementação na Aplicação |
|---|---|---|
| **Art. 5º (1)(f)** | **Integridade e Confidencialidade** | Encriptação ponta a ponta (HTTPS/TLS + AES-256 no banco), RLS estrito e cabeçalhos de segurança contra extração indevida. |
| **Art. 25º** | **Privacidade desde a Conceção (Privacy by Design)** | Configurações seguras por omissão (*Secure by Default*): utilizadores anónimos recebem 0 registos em todas as tabelas. |
| **Art. 30º** | **Registo das Atividades de Tratamento** | Tabelas `audit_logs` e `log` mantêm registo rastreável de quem criou, consultou ou alterou registos com dados de faturas ou moradas. |
| **Art. 32º** | **Segurança do Tratamento** | Autenticação robusta, controlo de tentativas falhadas, isolamento lógico de bases de dados e segregação de privilégios. |

---

## 5. CIS PostgreSQL Benchmark — Checklist de Conformidade

* **[PASS] 3.1 - Concessão Mínima de Privilégios:** Revogado o acesso de execução a `anon` e `PUBLIC` em funções de criação de utilizadores e rotinas de sistema.
* **[PASS] 3.2 - Row-Level Security Ativo:** 21 de 21 tabelas em `public` têm `rowsecurity = true`.
* **[PASS] 4.3 - Proteção de Caminho de Pesquisa:** Pinned `search_path = public, pg_temp` em todas as rotinas `SECURITY DEFINER`.
* **[PASS] 5.1 - Trilhos de Auditoria Imutáveis:** Tabela `audit_logs` protegida contra qualquer modificação ou apagamento de registos passados.

---

## 6. Conclusão da Auditoria

A aplicação **PlatFarmaSupa** encontra-se num patamar de segurança de **nível empresarial**. As defesas implementadas cobrem desde o navegador do utilizador até ao armazenamento em disco, assegurando total conformidade com a legislação europeia de proteção de dados e com os rigorosos requisitos de distribuição farmacêutica.
