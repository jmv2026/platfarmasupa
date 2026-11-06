# Documentação Funcional e Técnica — Módulo Processar Pedidos

**Projeto:** PlatFarmaSupa (Sermail)  
**Rota abrangida:** `/Proc_Pedidos`

---

## 1. Visão Geral

O módulo **Processar Pedidos** (`/Proc_Pedidos`) é o painel operacional exclusivo das equipas de **Gestão** e **Administração** (`gestor` e `admin`) para controlo logístico, faturação/integração com o ERP **Primavera**, edição integral de encomendas e gestão do ciclo de abate e transição (*handoff*) de stock entre a tabela `public.pedidos` e a tabela `public.movimentos`.

### Arquitetura de Ficheiros
| Ficheiro | Função Principal |
| :--- | :--- |
| [src/app/Proc_Pedidos/page.tsx](../src/app/Proc_Pedidos/page.tsx) | *Server Component* da rota `/Proc_Pedidos`; valida o acesso restrito (`isManagerOrAdmin`) via `getAuthContext()` e carrega em paralelo (`Promise.all`) `clientes`, `pedidos` (com `pedido_linhas`, `clientes` e `destinos`), `vw_stock_pedidos` e `artigos`. |
| [src/app/Proc_Pedidos/proc-pedidos-view.tsx](../src/app/Proc_Pedidos/proc-pedidos-view.tsx) | *Client Component* principal: apresenta os 4 KPIs de processamento, filtros multi-critério, grelha interativa com *checkboxes* de atualização otimista e 4 modais operacionais (**Documento Primavera**, **Ver Detalhes**, **Editar Pedido** e **Apagar Pedido**). |
| [src/app/Proc_Pedidos/actions.ts](../src/app/Proc_Pedidos/actions.ts) | *Server Actions* `atualizarProcessamentoPedidoAction`, `atualizarDocPrimaveraAction`, `editarPedidoAction` e `apagarPedidoAction`, com sincronização automática de stock via RPC. |

---

## 2. Controlo de Acesso (RBAC)

A página `/Proc_Pedidos` e todas as suas *Server Actions* (`checkGestorOrAdmin`) aplicam validação dupla (no carregamento SSR e em cada mutação):

| Perfil | Permissão em `/Proc_Pedidos` | Comportamento |
| :--- | :--- | :--- |
| **`admin` / `gestor`** | **Acesso Total** | Visualização de todos os clientes, associação de Documento Primavera, marcação `Processar` / `Processado` / `Stock`, edição completa de cabeçalho e linhas e eliminação de pedidos. |
| **`user1` / `user2`** | **Sem Acesso** | Redirecionamento automático para `/dashboard?error=unauthorized` (os clientes consultam os seus pedidos através de `/historico-pedidos`). |

---

## 3. Indicadores de Topo (4 KPIs) e Filtros Operacionais

| # | Indicador (KPI) | Critério de Cálculo | Significado Operacional |
| :-: | :--- | :--- | :--- |
| **1** | **Total Pedidos** | `pedidosList.length` | Volume total de pedidos registados na plataforma. |
| **2** | **Por Processar** | `!p.processado` | Pedidos que ainda aguardam conclusão logística. |
| **3** | **A Processar** | `!p.processado && p.processar` | Pedidos já com Documento Primavera atribuído e sinalizados como em preparação/integração ativa. |
| **4** | **Processados** | `p.processado === true` | Pedidos cujo processamento operacional foi dado como concluído. |

---

## 4. Regras de Negócio Críticas: Documento Primavera, `Processar` e Handoff de Stock

1. **Bloqueio Condicional do Campo `Processar` (`doc_primavera` obrigatório)**:
   - A checkbox **`Processar`** encontra-se **bloqueada (`disabled`)** enquanto o campo **`Doc. Primavera`** (`doc_primavera`) estiver vazio.
   - Se um utilizador apagar o `doc_primavera` de um pedido que já tinha `processar = true`, o sistema desmarca automaticamente `processar = false` e limpa `datetime_proc = null`.
2. **Carimbo Temporal Automático (`D/H PROCESSAR`)**:
   - Sempre que `processar` passa para `true`, o sistema grava automaticamente a data e hora exatas (`datetime_proc = new Date().toISOString()`). Quando desmarcado, `datetime_proc` volta a `null`.
3. **Transição (*Handoff*) do Abate de Stock (`pedidos` -> `movimentos`)**:
   - Enquanto o pedido está pendente com `stock = true`, o seu abate no Armazém `01` (Venda) é assegurado pela reserva do pedido.
   - Quando `processar = true` e o movimento correspondente do ERP Primavera (`documento_ref = doc_primavera`) entra em `public.movimentos`, as *views* `vw_stock_atual`, `vw_stock_pedidos` e `vw_stock_zero` deixam de deduzir o pedido pela tabela `pedidos` e passam a contabilizá-lo exclusivamente pela tabela `movimentos`, evitando dupla dedução.
4. **Controlo Dinâmico da Flag `Stock` (`stock = true / false`)**:
   - Desmarcar a checkbox **Stock** na grelha invoca `sincronizar_pedido_para_movimentos`, removendo o abate e repondo imediatamente as existências disponíveis do lote.

---

## 5. Os 4 Modais Operacionais

- **Modal 1 — Documento Primavera Rápido (`docPrimaveraModalPedido`)**: Abre ao clicar na célula **Doc. Primavera**; exibe a Data de Entrega em modo de leitura e grava/limpa o código `doc_primavera` via `atualizarDocPrimaveraAction`.
- **Modal 2 — Ver Detalhes do Pedido (`selectedPedido`)**: Apresenta o cabeçalho completo, morada, estado de contabilização em stock e linhas do pedido.
- **Modal 3 — Editar Pedido Completo (`editingPedido`)**: Permite editar cabeçalho, morada, `Doc. Primavera`, `Tipo de Movimento`, `Estado`, alterar/remover linhas e acrescentar novas linhas com sugestão automática de lote **FEFO**. Se o estado mudar para `cancelado`, remove o movimento de saída para repor o stock.
- **Modal 4 — Apagar Pedido (`deletingPedido`)**: Remove o pedido e respetivas linhas e elimina o movimento associado em `public.movimentos`, repondo integralmente o stock.

