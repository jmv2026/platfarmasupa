# Documentação Funcional e Técnica — Módulo Processar Pedidos

**Projeto:** PlatFarmaSupa (Sermail)  
**Rota abrangida:** `/Proc_Pedidos`  
**Documento no repositório:** [DOCUMENTACAO_PROCESSAR_PEDIDO.md](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/docs/DOCUMENTACAO_PROCESSAR_PEDIDO.md)

---

## 1. Visão Geral

O módulo **Processar Pedidos** (`/Proc_Pedidos`) é o painel operacional exclusivo das equipas de **Gestão** e **Administração** (`gestor` e `admin`) para controlo logístico, faturação/integração com o ERP **Primavera**, edição integral de encomendas e gestão do ciclo de abate e transição (*handoff*) de stock entre a tabela `public.pedidos` e a tabela `public.movimentos`.

### Arquitetura e Fluxo de Dados

![Mapa de Arquitetura e Fluxo de Dados — Página Processar Pedidos](/C:/Users/joaom/.gemini/antigravity/brain/68759e4d-57ed-4be2-abe7-3e139dcca28d/mapa_processar_pedido.svg)

### Arquitetura de Ficheiros
| Ficheiro | Função Principal |
| :--- | :--- |
| [src/app/Proc_Pedidos/page.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/page.tsx) | *Server Component* da rota `/Proc_Pedidos`; valida o acesso restrito (`isManagerOrAdmin`) via [`getAuthContext`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/lib/supabase/session.ts) e carrega em paralelo (`Promise.all`) `clientes`, `pedidos` (com `pedido_linhas`, `clientes` e `destinos`), `vw_stock_pedidos` e `artigos`. |
| [src/app/Proc_Pedidos/proc-pedidos-view.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/proc-pedidos-view.tsx) | *Client Component* principal: apresenta os 4 KPIs de processamento, filtros multi-critério, grelha interativa com *checkboxes* de atualização otimista e 4 modais operacionais (**Documento Primavera**, **Ver Detalhes**, **Editar Pedido** e **Apagar Pedido**). |
| [src/app/Proc_Pedidos/actions.ts](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts) | *Server Actions* [`atualizarProcessamentoPedidoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts#L39-L97), [`atualizarDocPrimaveraAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts#L356-L406), [`editarPedidoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts#L131-L309) e [`apagarPedidoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts#L311-L354), com sincronização automática de stock via RPC. |

---

## 2. Controlo de Acesso (RBAC)

A página `/Proc_Pedidos` e todas as suas *Server Actions* ([`checkGestorOrAdmin`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts#L6-L37)) aplicam validação dupla (no carregamento SSR e em cada mutação):

| Perfil | Permissão em `/Proc_Pedidos` | Comportamento |
| :--- | :--- | :--- |
| **`admin` / `gestor`** | **Acesso Total** | Visualização de todos os clientes, associação de Documento Primavera, marcação `Processar` / `Processado` / `Stock`, edição completa de cabeçalho e linhas e eliminação de pedidos. |
| **`user1` / `user2`** | **Sem Acesso** | Redirecionamento automático para `/dashboard?error=unauthorized` (os clientes consultam os seus pedidos através de `/historico-pedidos`). |

---

## 3. Indicadores de Topo (4 KPIs) e Filtros Operacionais

Calculados em memória em [`ProcPedidosView`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/proc-pedidos-view.tsx#L559-L574):

| # | Indicador (KPI) | Critério de Cálculo | Significado Operacional |
| :-: | :--- | :--- | :--- |
| **1** | **Total Pedidos** | `pedidosList.length` | Volume total de pedidos registados na plataforma. |
| **2** | **Por Processar** | `!p.processado` | Pedidos que ainda aguardam conclusão logística. |
| **3** | **A Processar** | `!p.processado && p.processar` | Pedidos já com Documento Primavera atribuído e sinalizados como em preparação/integração ativa. |
| **4** | **Processados** | `p.processado === true` | Pedidos cujo processamento operacional foi dado como concluído. |

### Filtros Combináveis
- **Pesquisa Textual Rápida**: Filtra em tempo real por `nr_pedido`, `ref_documento`, `nome_destinatario`, sigla/nome do cliente e `localidade`.
- **Filtro de Cliente**: Permite isolar os pedidos de um cliente específico (`[SIGLA] - Nome`) ou ver `Todos os Clientes`.
- **Filtro de Estado de Processamento**:
  - `Todos os Estados`
  - `Não Processados` (`!p.processado`)
  - `Marcados para Processar` (`p.processar === true`)
  - `Processados` (`p.processado === true`)

---

## 4. Regras de Negócio Críticas: Documento Primavera, `Processar` e Handoff de Stock

> [!IMPORTANT]
> A página **Processar Pedidos** governa a regra central de transição (*handoff*) de stock entre os pedidos submetidos na plataforma e os movimentos importados do ERP Primavera / MS Access:

1. **Bloqueio Condicional do Campo `Processar` (`doc_primavera` obrigatório)**:
   - A checkbox **`Processar`** encontra-se **bloqueada (`disabled`)** enquanto o campo **`Doc. Primavera`** (`doc_primavera`) estiver vazio.
   - Esta regra é validada tanto na interface ([`handleToggleField`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/proc-pedidos-view.tsx#L237-L247)) como no servidor ([`atualizarProcessamentoPedidoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts#L49-L66) e [`editarPedidoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts#L145-L151)).
   - Se um utilizador apagar o `doc_primavera` de um pedido que já tinha `processar = true`, o sistema desmarca automaticamente `processar = false` e limpa `datetime_proc = null` ([`atualizarDocPrimaveraAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts#L382-L385)).

2. **Carimbo Temporal Automático (`D/H PROCESSAR`)**:
   - Sempre que `processar` passa para `true`, o sistema grava automaticamente a data e hora exatas (`datetime_proc = new Date().toISOString()`). Quando desmarcado, `datetime_proc` volta a `null`.

3. **Transição (*Handoff*) do Abate de Stock (`pedidos` $\rightarrow$ `movimentos`)**:
   - **Antes de `processar = true`**: Enquanto o pedido está pendente com `stock = true`, o seu abate no Armazém `01` (Venda) é assegurado diretamente pela reserva da tabela `public.pedidos` / `sincronizar_pedido_para_movimentos`.
   - **Após `processar = true` + `doc_primavera`**: Quando o movimento correspondente do ERP Primavera (cujo `documento_ref` coincide com `doc_primavera`) entra em `public.movimentos`, as *views* `vw_stock_atual`, `vw_stock_pedidos` e `vw_stock_zero` deixam de deduzir o pedido pela tabela `pedidos` e passam a contabilizá-lo exclusivamente pela tabela `movimentos`, evitando qualquer duplicação de abate.

4. **Controlo Dinâmico da Flag `Stock` (`stock = true / false`)**:
   - Desmarcar a checkbox **Stock** na grelha invoca [`sincronizar_pedido_para_movimentos`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts#L86-L89), removendo o abate e repondo imediatamente as existências disponíveis do lote. Voltar a marcar volta a abater o stock.

---

## 5. Os 4 Modais Operacionais

### 5.1 Modal Rápido — Documento Primavera (`docPrimaveraModalPedido`)
- Abre ao clicar diretamente na célula **Doc. Primavera** (`Por preencher` ou no código já atribuído, ex.: `ECL 2026/123`).
- Exibe a **Data de Entrega** em modo de leitura e permite gravar ou limpar o código `doc_primavera` num único clique via [`atualizarDocPrimaveraAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts#L356-L406), sincronizando de imediato `public.movimentos`.

### 5.2 Modal — Ver Detalhes do Pedido (`selectedPedido`)
- Apresenta o resumo completo do destinatário, morada, código postal, localidade, país, data do pedido, referência do documento, estado de contabilização em stock e a tabela detalhada de linhas (`Código`, `Descrição`, `Lote`, `Validade` e `Qtd`), com botão de atalho direto para **Editar Pedido**.

### 5.3 Modal — Editar Pedido Completo (`editingPedido`)
Permite alterar todos os elementos do cabeçalho e das linhas do pedido ([`editarPedidoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts#L131-L309)):
- **Cabeçalho e Flags**: Nome do destinatário, classificação do destino, morada, código postal, localidade, país, referência do documento, `Doc. Primavera`, `Tipo de Movimento` (por defeito `SS`), datas de pedido/entrega, `Estado` (`pendente`, `processado`, `concluido`, `cancelado`), observações e checkboxes `Processar`, `Processado` e `Contabilizar em Stock`.
- **Adição de Novas Linhas com Sugestão FEFO**:
  - Filtra os artigos e lotes disponíveis do cliente (`editingClientStock`), ordena os lotes por validade ascendente (**FEFO**) e preenche automaticamente o lote e validade ao selecionar o artigo.
  - Se o utilizador preencher os campos de nova linha e clicar diretamente em **Guardar Alterações** sem premir o botão intermédio `+ Adicionar`, [`handleSaveEdit`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/proc-pedidos-view.tsx#L397-L415) inclui essa linha automaticamente para evitar perda acidental de dados.
- **Edição e Remoção de Linhas Existentes**:
  - Permite alterar descrição, lote, validade e quantidade de qualquer linha ou remover linhas (exigindo que o pedido mantenha pelo menos 1 linha).
- **Cancelamento Automático de Movimento**:
  - Se o `status` do pedido for alterado para `cancelado`, [`editarPedidoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts#L274-L292) elimina automaticamente o movimento de saída associado em `public.movimentos`, repondo o stock.

### 5.4 Modal — Apagar Pedido (`deletingPedido`)
- Solicita confirmação explícita antes de executar [`apagarPedidoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/Proc_Pedidos/actions.ts#L311-L354).
- Remove o cabeçalho em `public.pedidos` (e respetivas `pedido_linhas`), elimina o movimento associado em `public.movimentos` para repor integralmente o stock reservado e revalida as caches de `/Proc_Pedidos`, `/historico-pedidos`, `/stocks` e `/dashboard`.
