# Documentação Funcional e Técnica — Módulo de Logística Inversa

**Projeto:** PlatFarmaSupa (Sermail)  
**Rota abrangida:** `/logistica-inversa` (Menu: **Logística Inversa**)  
**Documento no repositório:** [DOCUMENTACAO_LOGISTICA_INVERSA.md](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/docs/DOCUMENTACAO_LOGISTICA_INVERSA.md)

---

## 1. Visão Geral

O módulo de **Logística Inversa** (`/logistica-inversa`) centraliza todo o circuito de recolhas, devoluções e receções de produtos devolvidos na plataforma **PlatFarmaSupa**. Permite aos clientes e equipa operacional:
1. **Lançar Pedidos de Recolha** junto de farmácias, hospitais, distribuidores ou outras entidades, gerando referências dedicadas (`[SIGLA]-REC-YYYY-XXXX`) direcionadas para o armazém de devoluções do respetivo cliente (`[SIGLA]04`).
2. **Monitorizar o Histórico de Pedidos de Recolha**, acompanhando o ciclo de vida operacional (`Pendente` -> `Recolha Agendada` -> `Em Recolha` -> `Recolhido` -> `Rececionado (Arm. 04)` / `Cancelado`).
3. **Consultar e auditar os Artigos Rececionados no Armazém 04**, englobando todos os movimentos de entrada (`ES` / `ET`) efetuados nos armazéns com terminação **`04`** (**Devoluções**) de cada cliente.

### Arquitetura e Fluxo de Dados

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#e5e7eb", "primaryColor": "#e5e7eb", "primaryTextColor": "#000000", "primaryBorderColor": "#374151", "lineColor": "#000000", "secondaryColor": "#e5e7eb", "tertiaryColor": "#d1d5db", "mainBkg": "#e5e7eb", "nodeBkg": "#e5e7eb", "clusterBkg": "#d1d5db", "clusterBorder": "#374151", "titleColor": "#000000", "edgeLabelBackground": "#e5e7eb", "textColor": "#000000", "nodeTextColor": "#000000"}}}%%
flowchart TD
    subgraph Canvas ["Mapa de Arquitetura e Fluxo de Dados — Página Logística Inversa (/logistica-inversa)"]
        subgraphBD ["Tabelas Base (PostgreSQL / Supabase)"]
        subgraph Origem ["Tabelas Base (PostgreSQL / Supabase)"]
            T_REC["pedidos_recolha + pedido_recolha_linhas (Pedidos de Recolha)"]
            T_MOV["movimentos + movimentos_linhas (Entradas Armazém *04)"]
            T_CAT["clientes + destinos + artigos (Catálogos Base)"]
        end

        subgraph Server ["Next.js Server Component & Server Actions"]
            P_LOG["/logistica-inversa (page.tsx - Promise.all + fetchAllRowsFast)"]
            A_LOG["actions.ts (criarPedidoRecolhaAction / atualizarEstadoPedidoRecolhaAction)"]
        end

        subgraph Client ["Interface Interativa (LogisticaInversaView - logistica-inversa-view.tsx)"]
            ABA1["Aba 1: Lançar Pedido de Recolha (Destino [SIGLA]04)"]
            ABA2["Aba 2: Histórico e Monitorização de Recolhas (KPIs + Estados)"]
            ABA3["Aba 3: Artigos Rececionados no Armazém 04 (Resumo + CSV)"]
        end

        T_REC & T_MOV & T_CAT --> P_LOG
        P_LOG --> ABA1 & ABA2 & ABA3
        ABA1 --> A_LOG
        ABA2 --> A_LOG
        A_LOG --> T_REC
    end

    style Canvas fill:#e5e7eb,stroke:#374151,stroke-width:2px,color:#000000
    style Origem fill:#d1d5db,stroke:#374151,stroke-width:2px,color:#000000
    style Server fill:#d1d5db,stroke:#374151,stroke-width:2px,color:#000000
    style Client fill:#d1d5db,stroke:#374151,stroke-width:2px,color:#000000

    style T_REC fill:#e5e7eb,stroke:#374151,stroke-width:2px,color:#000000
    style T_MOV fill:#e5e7eb,stroke:#374151,stroke-width:2px,color:#000000
    style T_CAT fill:#e5e7eb,stroke:#374151,stroke-width:2px,color:#000000
    style P_LOG fill:#e5e7eb,stroke:#374151,stroke-width:2px,color:#000000
    style A_LOG fill:#e5e7eb,stroke:#374151,stroke-width:2px,color:#000000
    style ABA1 fill:#e5e7eb,stroke:#374151,stroke-width:2px,color:#000000
    style ABA2 fill:#e5e7eb,stroke:#374151,stroke-width:2px,color:#000000
    style ABA3 fill:#e5e7eb,stroke:#374151,stroke-width:2px,color:#000000

    linkStyle default stroke:#000000,stroke-width:2.5px,color:#000000
```

### Arquitetura de Ficheiros
| Ficheiro | Função Principal |
| :--- | :--- |
| [src/app/logistica-inversa/page.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/logistica-inversa/page.tsx) | *Server Component* da rota `/logistica-inversa`; valida a sessão e perfil RBAC via [`getAuthContext`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/lib/supabase/session.ts), carrega em paralelo (`Promise.all` + [`fetchAllRowsFast`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/lib/supabase/pagination.ts)) `clientes`, `destinos`, `pedidos_recolha`, `artigos` e os movimentos de entrada nos armazéns com terminação `04` (`movimentos_linhas`). |
| [src/app/logistica-inversa/logistica-inversa-view.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/logistica-inversa/logistica-inversa-view.tsx) | *Client Component* interativo estruturado em 3 abas (**Lançar Pedido de Recolha**, **Histórico de Recolhas** e **Artigos Rececionados Arm. 04**), com filtros multi-critério, KPIs de monitorização, modal de detalhe e exportação CSV. |
| [src/app/logistica-inversa/actions.ts](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/logistica-inversa/actions.ts) | *Server Actions* para criação de pedidos de recolha ([`criarPedidoRecolhaAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/logistica-inversa/actions.ts#L85-L250)), gravação opcional de novos locais de recolha ([`criarLocalRecolhaAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/logistica-inversa/actions.ts#L12-L83)) e atualização de estados operacionais ([`atualizarEstadoPedidoRecolhaAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/logistica-inversa/actions.ts#L252-L295)). |
| [supabase/migrations/20261110143200_create_logistica_inversa_tables.sql](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/supabase/migrations/20261110143200_create_logistica_inversa_tables.sql) | Migração SQL que cria as tabelas dedicadas `public.pedidos_recolha` e `public.pedido_recolha_linhas`, respetivos índices compostos e políticas de *Row-Level Security* (RLS). |

---

## 2. Modelo de Dados e Segurança (PostgreSQL / RLS)

### 2.1 Tabelas Dedicadas (`pedidos_recolha` e `pedido_recolha_linhas`)
Os pedidos de recolha são armazenados separadamente dos pedidos de expedição comercial (`public.pedidos`), garantindo que um pedido de recolha **não abate stock de venda (Armazém 01)**:

- **`public.pedidos_recolha`**:
  - `id` (`uuid`, PK)
  - `nr_pedido` (`text`, único, formato `REC-YYYY-XXXX`)
  - `sigla_pedido` (`text`, formato `[SIGLA]-REC-YYYY-XXXX`)
  - `armazem_destino` (`text`, preenchido automaticamente como `[SIGLA]04`, ex.: `PLS04`, `CRD04`, `MDZ04`)
  - `motivo_recolha` (`text`: *Devolução Comercial*, *Validade Expirada / Curta*, *Produto Danificado / Avaria*, *Recolha de Lote / Recall*, *Erro de Expedição / Pedido*, *Outro*)
  - `ref_documento` (`text`: N.º Guia / Referência do cliente)
  - `cliente_id` (`uuid`, FK para `public.clientes`)
  - `destino_id` (`uuid`, FK opcional para `public.destinos`)
  - `classifica_destino`, `nome_origem`, `morada`, `codigo_postal`, `localidade`, `pais`, `contacto_local`
  - `data_pedido` (`date`), `data_recolha` (`date`)
  - `status` (`text`: `'pendente'`, `'agendada'`, `'em_recolha'`, `'recolhido'`, `'rececionado'`, `'cancelado'`)
  - `observacoes` (`text`), `created_by` (`uuid`), `created_at`, `updated_at`

- **`public.pedido_recolha_linhas`**:
  - `id` (`uuid`, PK), `pedido_recolha_id` (`uuid`, FK `ON DELETE CASCADE`), `cliente_id` (`uuid`, FK)
  - `artigo_id` (`text`), `artigo_cli` (`text`), `descricao` (`text`)
  - `lote` (`text`, predefinido `'S/LOTE'` quando não especificado), `validade` (`date`, opcional)
  - `quantidade` (`numeric`, `CHECK (quantidade > 0)`), `motivo_linha` (`text`)

### 2.2 Políticas de Isolamento Multi-Tenant (RLS)
Ambas as tabelas têm *Row-Level Security* ativa:
- **Utilizadores `admin` e `gestor`**: acesso de leitura, criação, edição de estado e eliminação sobre os pedidos de recolha de todos os clientes.
- **Utilizadores de Cliente (`user1`, `user2`, `user3`)**: acesso restrito exclusivamente aos registos onde `cliente_id = users.cliente_id`.

---

## 3. Regra de Identificação de Artigos Rececionados (Armazém 04)

> [!IMPORTANT]
> Todos os artigos rececionados no processo de logística inversa correspondem aos movimentos cuja **entrada (`ES` — Entrada de Stock ou `ET` — Entrada por Transferência)** é efetuada no **armazém com a terminação `04`** (**Devoluções**) de cada cliente.

No servidor ([`src/app/logistica-inversa/page.tsx`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/logistica-inversa/page.tsx#L63-L185)):
1. A consulta a `public.movimentos_linhas` (com `INNER JOIN` a `public.movimentos`) filtra na base de dados todos os movimentos onde:
   ```sql
   tipo_armazem = '04' OR armazem ILIKE '%04' OR armazem_loc ILIKE '%04'
   ```
2. São selecionados os movimentos de entrada (`tipo_movimento IN ('ES', 'ET')`) cujo código de armazém termina em `04` (por exemplo: `PLS04`, `CRD04`, `MDZ04`, `PNZ04` ou localização `*-04`).
3. O código de artigo (`artigo_id`) e a descrição (`descricao`) são cruzados em $O(1)$ com o catálogo `public.artigos` para garantir nomenclatura normalizada.

---

## 4. Estrutura Funcional das 3 Abas da Interface

### 4.1 Aba 1 — Lançar Pedido de Recolha (`lancar_recolha`)
Dividida em 3 painéis operacionais:
1. **Cliente Proprietário & Armazém de Logística Inversa**:
   - Seleção do cliente (para `admin`/`gestor`) ou exibição fixa do cliente associado ao utilizador.
   - Apresenta de imediato o badge do armazém de destino: **`Armazém: [SIGLA]04 (Devoluções)`**.
   - Campos de **Motivo da Recolha**, **Data Pretendida de Recolha**, **N.º Guia / Referência Cliente** e **Contacto Local / Telefone**.
2. **Local de Recolha (Origem dos Artigos)**:
   - Permite pesquisar rapidamente um local habitual pelo código (`[SIGLA]-0001`) ou escolher na lista de locais arquivados (`public.destinos`), preenchendo automaticamente morada, código postal, localidade e contacto.
   - Permite também o preenchimento manual de qualquer endereço de recolha e a opção **"Guardar este endereço na lista de locais habituais do cliente"**.
3. **Artigos a Recolher**:
   - Pesquisa rápida e seleção de artigos do catálogo ativo do cliente (`public.artigos`), com indicação de **Lote** (opcional), **Validade** (opcional) e **Quantidade a Recolher**.
   - Tabela de revisão das linhas adicionadas com soma total de unidades e submissão direta para a base de dados.

### 4.2 Aba 2 — Histórico e Monitorização de Recolhas (`historico_recolhas`)
- **4 Cartões de KPI**:
  - **Total Pedidos de Recolha**
  - **Em Curso / Pendentes** (`pendente`, `agendada`, `em_recolha`)
  - **Recolhidos / Rececionados** (`recolhido`, `rececionado`)
  - **Total Unidades Solicitadas**
- **Filtros Combináveis**: Pesquisa textual global, Cliente, Estado da Recolha, Motivo da Recolha, Local de Recolha e Período Temporal.
- **Gestão Operacional de Estado**: Utilizadores `admin` e `gestor` podem atualizar diretamente na tabela o estado de cada pedido (`Pendente`, `Recolha Agendada`, `Em Recolha`, `Recolhido`, `Rececionado (Arm. 04)`, `Cancelado`).
- **Modal de Detalhe**: Clicar no número do pedido (`[SIGLA]-REC-YYYY-XXXX`) abre a ficha completa com morada de origem, contacto, motivo e tabela de artigos/lotes a recolher.

### 4.3 Aba 3 — Artigos Rececionados no Armazém 04 (`rececoes_04`)
- **Painel de Filtros Alinhados**:
  - **Filtro de Cliente (`[SIGLA]04`)**: isolado no topo para perfis `admin` e `gestor`.
  - **Linha Principal Alinhada**: **Artigo Rececionado** (pesquisa rápida + seletor dropdown), **Período Temporal de Receção** (atalhos rápidos + intervalo de datas `De` / `Até`) e **Documento / Lote** (ex.: `SER-VGR`).
- **Janela de Resumo do Período**:
  - Destaca o **Total Rececionado no Armazém 04 (`un`)**, o **N.º de Artigos Distintos** e o **N.º de Guias / Documentos (`SER-VGR`)** no período temporal selecionado.
- **Tabela de Entradas no Armazém 04 e Exportação CSV**:
  - Lista cada entrada (`Documento`, `Mov.`, `Data Receção`, `Cliente`, `Armazém *04`, `Artigo`, `Descrição`, `Lote`, `Validade` e `Qtd Rececionada`) com rodapé totalizador e exportação direta para ficheiro CSV compatível com Excel (`UTF-8 BOM`).

