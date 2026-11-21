# Documentação Funcional e Técnica — Módulo Criar Pedido

**Projeto:** PlatFarmaSupa (Sermail)  
**Rota abrangida:** `/pedidos`  
**Documento no repositório:** [DOCUMENTACAO_CRIAR_PEDIDO.md](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/docs/DOCUMENTACAO_CRIAR_PEDIDO.md)

---

## 1. Visão Geral

O módulo **Criar Pedido** (`/pedidos`) é o ponto central de emissão de ordens de expedição e encomendas logísticas na plataforma **PlatFarmaSupa**. Permite aos clientes proprietários (`user1`, `user2`) e à equipa interna (`admin`, `gestor`) registar pedidos de saída de armazém com seleção inteligente de lotes segundo a regra **FEFO** (*First Expired, First Out*), gestão integrada de destinos arquivados, reserva imediata de stock disponível no Armazém `01` (Venda) e disparo automático de notificações por e-mail com anexos Excel nativos (`.xlsx`).

### Arquitetura e Fluxo de Dados

![Mapa de Arquitetura e Fluxo de Dados — Página Criar Pedido](/C:/Users/joaom/.gemini/antigravity/brain/68759e4d-57ed-4be2-abe7-3e139dcca28d/mapa_criar_pedido.svg)

### Arquitetura de Ficheiros
| Ficheiro | Função Principal |
| :--- | :--- |
| [src/app/pedidos/page.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/page.tsx) | *Server Component* da rota `/pedidos`; valida a sessão via `getAuthContext()`, aplica o isolamento multi-tenant (`userClientId`) e carrega em paralelo (`Promise.all`) os clientes ativos (`clientes`), o stock disponível para venda (`vw_stock_pedidos` com `stock > 0`) e o catálogo de destinos (`destinos`). |
| [src/app/pedidos/novo-pedido-form.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/novo-pedido-form.tsx) | *Client Component* interativo do formulário de criação de pedidos: gere os dados do cabeçalho, pesquisa rápida de destinos por código, modal de criação de destino, motor de sugestão FEFO em $O(1)$ e validação de quantidades por lote. |
| [src/app/pedidos/actions.ts](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/actions.ts) | *Server Actions* [`criarDestinoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/actions.ts#L8-L83) e [`criarPedidoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/actions.ts#L85-L371); executam a validação RBAC no servidor, geram a numeração do pedido (`nr_pedido` e `sigla_pedido`), gravam em `pedidos` e `pedido_linhas`, invocam a RPC de stock e disparam os e-mails transacionais. |
| [src/lib/email.ts](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/lib/email.ts) | Geração em memória dos ficheiros Excel (`Pedido_<nr_pedido>.xlsx` e `Template-Pedidos_<nr_pedido>.xlsx`) e envio assíncrono via API **Resend**. |

---

## 2. Controlo de Acesso (RBAC) e Isolamento por Cliente

O comportamento da página adapta-se automaticamente ao perfil do utilizador autenticado:

| Perfil | Seleção de Cliente Proprietário | Opção "Contabilizar em Stock" | Visibilidade de Stock e Destinos |
| :--- | :--- | :--- | :--- |
| **`admin` / `gestor`** | Seletor *dropdown* livre com todos os clientes ativos (`[SIGLA] Nome`). | Checkbox visível (ativa por defeito; permite criar pedidos que não abatem stock quando desmarcada). | Acesso ao stock de venda (`vw_stock_pedidos`) e destinos do cliente selecionado no formulário. |
| **`user1` / `user2`** | Campo bloqueado (*read-only*) fixado na empresa associada ao perfil (`profile.cliente_id`). | Sempre ativo (`stock = true` forçado no servidor em [`criarPedidoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/actions.ts#L178-L180)). | Filtrado ao nível da query SQL (`eq('cliente_id', userClientId)`) apenas para a sua empresa. |

---

## 3. Estrutura Funcional do Formulário (5 Secções)

### 3.1 Secção 1 — Dados do Pedido (Painel Superior Esquerdo)
- **Cliente Proprietário (`*`)**: Identifica o laboratório/proprietário dos artigos. A mudança de cliente ([`handleClientChange`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/novo-pedido-form.tsx#L184-L198)) limpa automaticamente o destinatário e as linhas em edição para evitar cruzamento de referências entre clientes.
- **Referência do Documento (`ref_documento`)**: Campo livre opcional para indicar o número da encomenda interna ou ordem de compra do cliente.
- **Data de Entrega Pretendida (`data_entrega`)**: Seletor de data opcional (a data do pedido `data_pedido` assume automaticamente a data atual `YYYY-MM-DD`).

### 3.2 Secção 2 — Destino / Destinatário (Painel Superior Direito)
Oferece três métodos complementares para preencher os dados de expedição:
1. **Pesquisa Rápida por Código ([`buscarDestinoPorCodigo`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/novo-pedido-form.tsx#L228-L265))**:
   - Aceita o código completo (ex.: `CRD-0001`), sigla sem hífen (`CRD0001`) ou apenas o número sequencial (`1`, `01`, `0001`), compondo automaticamente o prefixo `[SIGLA]-0001` e preenchendo todos os campos de morada.
2. **Seleção por Lista Pull-Down**:
   - Lista todos os destinos ativos do cliente (`[CODIGO] Nome (Classificação) - Localidade (Código Postal)`).
3. **Criação de Novo Destino**:
   - **Via Modal Dedicado (`+ Novo Destino`)**: Invoca [`criarDestinoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/actions.ts#L8-L83), gravando imediatamente na tabela `public.destinos` (onde um *trigger* PostgreSQL atribui automaticamente o código sequencial `[SIGLA]-0001`) e selecionando-o no formulário.
   - **Via Checkbox Inline**: Se o utilizador preencher manualmente um destinatário novo e assinalar *"Guardar estes dados e classificação como novo destino arquivado"*, [`criarPedidoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/actions.ts#L146-L168) cria o registo em `public.destinos` no momento da submissão do pedido.
- **Campos Obrigatórios do Destinatário**: Nome do Destinatário (`*`), Classificação do Destino (`*` — ex.: `Farmácia`, `Hospital`, `Grossista`, `Outros`, etc.), Morada (`*`), Código Postal (`*`), Localidade (`*`) e País (por defeito `Portugal`).

### 3.3 Secção 3 — Adição de Linhas com Motor FEFO Inteligente
- **Agrupamento e Ordenação FEFO em Memória ([`lotesPorArtigoMap`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/novo-pedido-form.tsx#L151-L169))**:
  - Os registos de `vw_stock_pedidos` do cliente selecionado são indexados num `Map<artigo_id, StockPedido[]>` e ordenados por data de validade ascendente ($\text{Validade mais próxima primeiro}$):
    $$\text{Ordem dos Lotes} = \text{sort}\big(\text{Date.parse}(\text{validade}_A) - \text{Date.parse}(\text{validade}_B)\big)$$
- **Sugestão Automática ([`handleSelectArtigo`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/novo-pedido-form.tsx#L334-L345))**:
  - Ao escolher um artigo no primeiro *dropdown*, o segundo *dropdown* seleciona automaticamente o primeiro lote da fila FEFO (assinalado com `⭐ [FEFO]`), exibindo número do lote, data de validade e saldo disponível (`un`).
- **Validação de Quantidade**:
  - O campo numérico limita o máximo ao stock disponível no lote selecionado (`max = currentLoteObj.stock`).

### 3.4 Secção 4 — Tabela de Linhas do Pedido e Acumulação Validada
- Lista todas as linhas adicionadas com número de ordem (`#`), código do artigo, descrição, lote, validade, quantidade formatada e botão de remoção individual.
- **Regra de Acumulação por Lote ([`handleAddLinha`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/novo-pedido-form.tsx#L348-L407))**:
  - Se o utilizador adicionar novamente o mesmo par `(artigo_id, lote)`, a quantidade é somada à linha já existente, validando que a soma acumulada não ultrapassa o saldo disponível do lote:
    $$\text{Qtd}_{\text{acumulada}} = \text{Qtd}_{\text{existente}} + \text{Qtd}_{\text{nova}} \le \text{Stock Disponível}_{\text{lote}}$$

### 3.5 Secção 5 — Observações, Flag de Stock e Submissão
- **Observações (`observacoes`)**: Notas logísticas ou instruções de entrega.
- **Checkbox `Contabilizar em Stock`** (exclusivo `admin`/`gestor`): Define o booleano `pedidos.stock` (`true` por defeito).
- **Botão Submeter**: Apresenta o total de unidades do pedido e bloqueia cliques duplicados durante o processamento (`loading`).

---

## 4. Fluxo Transacional no Servidor (`criarPedidoAction`)

> [!IMPORTANT]
> Ao submeter o formulário, a *Server Action* [`criarPedidoAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/pedidos/actions.ts#L85-L371) executa sequencialmente 6 etapas:

1. **Validação RBAC e Integridade**: Confirma a sessão no Supabase Auth, força `targetClientId = profile.cliente_id` caso o utilizador não seja `admin`/`gestor` e valida a presença dos campos obrigatórios e de pelo menos uma linha com `quantidade > 0`.
2. **Geração de Identificadores do Pedido**:
   - `nr_pedido`: Formato `PED-<ANO>-<4 DÍGITOS>` (ex.: `PED-2026-4821`).
   - `sigla_pedido`: Formato `<SIGLA_CLIENTE>-<nr_pedido>` (ex.: `AOP-PED-2026-4821`).
3. **Inserção do Cabeçalho (`public.pedidos`)**:
   - Regista o pedido com `status = 'pendente'`, `tipo_movimento = 'SS'`, `doc_primavera = null` e `stock = finalStock`.
4. **Inserção das Linhas (`public.pedido_linhas`)**:
   - Grava todas as linhas associadas ao `pedido.id` com `artigo_id`, `artigo_cli`, `descricao`, `lote`, `validade` e `quantidade`.
5. **Contabilização em Stock (`stock = true`)**:
   - Quando `pedido.stock === true`:
     - As *views* `vw_stock_atual` e `vw_stock_pedidos` deduzem imediatamente as quantidades reservadas no **Armazém 01 (Venda)** enquanto o pedido não transitar para movimento processado (`processar = true`).
     - É invocada a RPC `sincronizar_pedido_para_movimentos(p_pedido_id)` para sincronização logística.
6. **Envio Paralelo de E-mails (`Promise.allSettled`) e Invalidação de Cache**:
   - Dispara dois fluxos de e-mail via **Resend** ([`src/lib/email.ts`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/lib/email.ts)):
     - `enviarEmailConfirmacaoPedido`: Envia confirmação HTML + anexo Excel `Pedido_<nr_pedido>.xlsx` para o utilizador criador e destinatários configurados.
     - `enviarEmailTemplatePedidoAdmin`: Envia o ficheiro técnico de integração `Template-Pedidos_<nr_pedido>.xlsx` (com armazém, tipo de artigo, família e subfamília) para os destinatários de administração/operação.
   - Executa `revalidatePath` nas rotas `/pedidos`, `/dashboard`, `/historico-pedidos`, `/stocks` e `/Proc_Pedidos`.
