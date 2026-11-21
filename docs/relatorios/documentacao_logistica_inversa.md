# Documentação Funcional e Técnica — Módulo de Logística Inversa

**Projeto:** PlatFarmaSupa (Sermail)  
**Rota abrangida:** `/logistica-inversa` (Menu: **Logística Inversa**)  
**Documento no repositório:** [DOCUMENTACAO_LOGISTICA_INVERSA.md](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/docs/DOCUMENTACAO_LOGISTICA_INVERSA.md)

---

## 1. Visão Geral

O módulo de **Logística Inversa** (`/logistica-inversa`) centraliza o circuito de recolhas no exterior, devoluções e controlo de receções nos armazéns de devoluções na plataforma **PlatFarmaSupa**. Estrutura-se em três áreas operacionais:
1. **Lançar Pedido de Recolha**: registo de pedidos de recolha em farmácias, hospitais, distribuidores ou outras entidades, gerando referências dedicadas (`[SIGLA]-REC-YYYY-XXXX`) associadas ao armazém de devoluções do cliente (`[SIGLA]04`).
2. **Histórico de Recolhas**: monitorização do estado dos pedidos de recolha lançados (`Pendente` $\rightarrow$ `Recolha Agendada` $\rightarrow$ `Em Recolha` $\rightarrow$ `Recolhido` $\rightarrow$ `Rececionado (Arm. 04)` / `Cancelado`).
3. **Artigos Rececionados (Arm. 04)**: listagem e totalização de todos os artigos cuja entrada (`ES` / `ET`) foi efetuada no armazém com a terminação **`04`** (**Devoluções**) de cada cliente.

### Arquitetura e Fluxo de Dados

![Mapa de Arquitetura e Fluxo de Dados — Logística Inversa](/C:/Users/joaom/.gemini/antigravity/brain/68759e4d-57ed-4be2-abe7-3e139dcca28d/mapa_logistica_inversa.svg)

### Arquitetura de Ficheiros
| Ficheiro | Função Principal |
| :--- | :--- |
| [src/app/logistica-inversa/page.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/logistica-inversa/page.tsx) | *Server Component* da rota `/logistica-inversa`; valida a sessão via [`getAuthContext`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/lib/supabase/session.ts), aplica isolamento RBAC por cliente (`userClientId`) e carrega em paralelo (`Promise.all` + [`fetchAllRowsFast`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/lib/supabase/pagination.ts)) `clientes`, `destinos`, `pedidos_recolha`, `artigos` e as entradas no armazém `*04` (`movimentos_linhas`). |
| [src/app/logistica-inversa/logistica-inversa-view.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/logistica-inversa/logistica-inversa-view.tsx) | *Client Component* interativo com as 3 abas (**Lançar Pedido de Recolha**, **Histórico de Recolhas** e **Artigos Rececionados Arm. 04**), filtros combináveis, janela de resumo por período temporal, modal de detalhe e exportação CSV. |
| [src/app/logistica-inversa/actions.ts](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/logistica-inversa/actions.ts) | *Server Actions* [`criarPedidoRecolhaAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/logistica-inversa/actions.ts#L85-L250), [`criarLocalRecolhaAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/logistica-inversa/actions.ts#L12-L83) e [`atualizarEstadoPedidoRecolhaAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/logistica-inversa/actions.ts#L252-L295). |
| [20261110143200_create_logistica_inversa_tables.sql](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/supabase/migrations/20261110143200_create_logistica_inversa_tables.sql) | Migração SQL das tabelas `public.pedidos_recolha` e `public.pedido_recolha_linhas`, índices e políticas RLS. |

---

## 2. Modelo de Dados e Isolamento com o Stock de Venda

> [!IMPORTANT]
> Os pedidos de recolha são registados nas tabelas dedicadas `public.pedidos_recolha` e `public.pedido_recolha_linhas`, pelo que **nunca abatem o stock disponível de venda (Armazém 01)**.

- **Cabeçalho (`public.pedidos_recolha`)**:
  - `nr_pedido` (`REC-YYYY-XXXX`) e `sigla_pedido` (`[SIGLA]-REC-YYYY-XXXX`).
  - `armazem_destino`: atribuído automaticamente com a sigla do cliente seguida da terminação `04` (`[SIGLA]04`, ex.: `PLS04`, `CRD04`, `MDZ04`, `PNZ04`).
  - `motivo_recolha`: *Devolução Comercial*, *Validade Expirada / Curta*, *Produto Danificado / Avaria*, *Recolha de Lote / Recall*, *Erro de Expedição / Pedido* ou *Outro*.
  - `nome_origem`, `morada`, `codigo_postal`, `localidade`, `pais`, `contacto_local`, `data_pedido`, `data_recolha`, `ref_documento` e `status`.
- **Linhas (`public.pedido_recolha_linhas`)**:
  - `artigo_id`, `artigo_cli`, `descricao`, `lote` (predefinido `'S/LOTE'` quando omitido), `validade`, `quantidade` (`> 0`) e `motivo_linha`.

---

## 3. Regra de Negócio: Artigos Rececionados no Armazém 04

Os artigos rececionados no processo de logística inversa compreendem **todos os artigos cuja entrada (`ES` ou `ET`) é efetuada no armazém com a terminação `04` de cada cliente**:

1. **Filtro na Base de Dados (`movimentos_linhas`)**:
   - Seleciona os registos onde `tipo_armazem = '04'`, `armazem ILIKE '*04'` ou `armazem_loc ILIKE '*04'`.
2. **Validação de Movimento de Entrada**:
   - Considera exclusivamente movimentos de entrada (`ES` — Entrada de Stock e `ET` — Entrada por Transferência) cujo código de armazém/localização termine em `04`.
3. **Normalização de Catálogo**:
   - O servidor resolve o código `artigo_id` e a `descricao` cruzando em $O(1)$ com a tabela `public.artigos`.

---

## 4. Funcionamento das 3 Abas da Página

| Aba | Funcionalidades Principais |
| :--- | :--- |
| **1. Lançar Pedido de Recolha** | Seleção de cliente e visualização automática do armazém `[SIGLA]04`; escolha de local habitual (`public.destinos`) ou preenchimento manual de morada (com opção de guardar endereço); motivo e data pretendida de recolha; adição de linhas de artigos do catálogo com lote, validade e quantidade. |
| **2. Histórico de Recolhas** | 4 KPIs operacionais (*Total Pedidos de Recolha*, *Em Curso / Pendentes*, *Recolhidos / Rececionados* e *Total Unidades Solicitadas*); filtros por cliente, estado, motivo, local de recolha e período; modal de detalhe completo e atualização direta do estado operacional para perfis `admin` / `gestor`. |
| **3. Artigos Rececionados (Arm. 04)** | Filtro por cliente (`[SIGLA]04`), filtro de artigo (pesquisa rápida + dropdown), filtro de período temporal (atalhos + intervalo `De` / `Até`) e filtro por documento/lote (`SER-VGR`); janela de resumo com **Total Rececionado no Armazém 04 (`un`)**, **Artigos Distintos** e **Guias / Documentos**; tabela com rodapé totalizador e exportação CSV. |
