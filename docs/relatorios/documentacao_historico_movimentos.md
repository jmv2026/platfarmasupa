# Documentação Funcional e Técnica — Módulo Histórico de Movimentos

**Projeto:** PlatFarmaSupa (Sermail)  
**Rota abrangida:** `/historico-pedidos` (Menu: **Histórico Movimentos**)  
**Documento no repositório:** [DOCUMENTACAO_HISTORICO_MOVIMENTOS.md](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/docs/DOCUMENTACAO_HISTORICO_MOVIMENTOS.md)

---

## 1. Visão Geral

O módulo **Histórico de Movimentos** (`/historico-pedidos`) disponibiliza a consulta unificada de todas as operações logísticas de armazém e expedição na plataforma **PlatFarmaSupa**. Combina num único painel os pedidos submetidos na plataforma (`public.pedidos`) e os movimentos físicos de entrada, transferência e saída importados do ERP/MS Access (`public.movimentos` e `public.movimentos_linhas`), enriquecidos automaticamente com o estado de entrega da transportadora **Torrestir** (`public.VW_torrestir_last`) e com visualização integrada de **Comprovativos de Entrega (POD)** digitalizados em formato TIFF.

### Arquitetura e Fluxo de Dados

![Mapa de Arquitetura e Fluxo de Dados — Histórico de Movimentos](/C:/Users/joaom/.gemini/antigravity/brain/68759e4d-57ed-4be2-abe7-3e139dcca28d/mapa_historico_movimentos.svg)

### Arquitetura de Ficheiros
| Ficheiro | Função Principal |
| :--- | :--- |
| [src/app/historico-pedidos/page.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/historico-pedidos/page.tsx) | *Server Component* da rota `/historico-pedidos`; valida a sessão via [`getAuthContext`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/lib/supabase/session.ts), aplica o isolamento por cliente (`userClientId`), carrega em paralelo (`Promise.all` + [`fetchAllRowsFast`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/lib/supabase/pagination.ts)) `clientes`, `pedidos`, `VW_torrestir_last` e `movimentos_linhas`, agrupa movimentos em documentos virtuais e cruza o estado de expedição em $O(1)$. |
| [src/app/historico-pedidos/historico-pedidos-view.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/historico-pedidos/historico-pedidos-view.tsx) | *Client Component* interativo: gere a pesquisa global e os 5 filtros dropdown, comuta entre a **Vista Tabela Compacta** e a **Vista Detalhada em Cartões**, exporta para CSV (`UTF-8 com BOM`) e descodifica comprovativos `.tiff` para `.png` em `<canvas>` via biblioteca `utif`. |
| [src/lib/supabase/pagination.ts](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/lib/supabase/pagination.ts) | Utilitário `fetchAllRowsFast` que contorna o limite de 1000 linhas do PostgREST carregando páginas de 2000 registos em paralelo. |

---

## 2. Motor de Unificação de Dados no Servidor (`page.tsx`)

> [!IMPORTANT]
> O *Server Component* [`HistoricoPedidosPage`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/historico-pedidos/page.tsx#L11-L209) constrói a lista consolidada de movimentos (`finalPedidos`) através de 4 regras de negócio sequenciais:

1. **Isolamento Multi-Tenant (RBAC)**:
   - Utilizadores `admin` e `gestor` consultam movimentos de todos os clientes ativos.
   - Utilizadores `user1` e `user2` têm as queries de `pedidos` e `movimentos_linhas` estritamente filtradas pelo seu `userClientId`.
2. **Regra de Exclusão de Pedidos Processados (`processedOrderRefs`)**:
   - Os pedidos cujo campo `processado = true` na tabela `public.pedidos` não são apresentados no Histórico de Movimentos.
   - Adicionalmente, o servidor constrói um conjunto (`Set<string>`) com todas as referências (`id`, `nr_pedido`, `sigla_pedido`, `doc_primavera` e `<SIGLA>-<nr_pedido>`) dos pedidos processados para excluir também os movimentos homónimos de `movimentos_linhas`.
3. **Agrupamento de Linhas de Movimento em Documentos (`pseudoPedidosList`)**:
   - As linhas de `public.movimentos_linhas` (com `INNER JOIN` a `public.movimentos`) são agrupadas em $O(N)$ pela chave composta:
     $$\text{Chave Documento} = \text{cliente\_id} \;\Vert\; \text{documento\_ref} \;\Vert\; \text{tipo\_movimento}$$
   - O estado inicial é atribuído automaticamente segundo a natureza do movimento:
     - `ES` (*Entrada de Stock*) $\rightarrow$ `rececionado` (**Rececionado**)
     - `ET` / `ST` (*Entrada / Saída por Transferência*) $\rightarrow$ `transfer` (**Transfer**)
     - `SS` (*Saída de Stock*) $\rightarrow$ `em_preparacao` (ou atualizado pelo tracking Torrestir)
4. **Cruzamento Automático com Tracking Torrestir (`VW_torrestir_last`)**:
   - A vista `VW_torrestir_last` é indexada num `Map` (`statusMap`) pela referência `ref_ser` normalizada (com e sem zeros à esquerda).
   - Para cada pedido/movimento de saída, o servidor extrai a referência (`ref_ser`, `nr_pedido`, `requisicao` ou `ref_documento`), procura correspondência em $O(1)$ no `statusMap` e, caso exista, atualiza o `status` com `desc_estado_expedicao` (ex.: `Entregue`, `Entregue PDA`) e anexa o caminho `url_comprovativo`.

---

## 3. Sistema de Pesquisa e 5 Filtros Combináveis

O painel de filtragem em [`HistoricoPedidosView`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/historico-pedidos/historico-pedidos-view.tsx#L177-L271) recalcula em tempo real o número de movimentos e o **Total de Unidades Filtradas**:

1. **Pesquisa Textual Global**: Pesquisa simultaneamente no cabeçalho (`nr_pedido`, destinatário, morada, localidade, código postal, `requisicao`/`ref_documento`, observações, sigla/nome do cliente) **e no interior das linhas** (`artigo_cli`, `descricao` e `lote`).
2. **Filtro de Cliente**: Seletor com todos os clientes ativos para `admin`/`gestor`; etiqueta fixa na empresa do utilizador para perfis de cliente.
3. **Filtro de Tipo de Movimento**:
   - `ES` — Entrada Stock
   - `ET` — Entrada Transferência
   - `SS` — Saída Stock
   - `ST` — Saída Transferência
4. **Filtro de Estado**: Lista dinâmica de todos os estados presentes nos documentos carregados (`Pendente`, `Em Preparação`, `Rececionado`, `Transfer`, `Entregue`, `Entregue PDA`, etc.).
5. **Filtro de Artigo**: Lista dinâmica (`availableArtigos`) com todos os artigos distintos existentes nos movimentos do cliente selecionado (`Código - Descrição`), permitindo isolar todo o rasto de lotes expedidos ou rececionados de um SKU específico.
6. **Filtro de Período Temporal**: `Todos os períodos`, `Hoje`, `Últimos 7 dias`, `Últimos 30 dias` e `Este mês`.

---

## 4. Modos de Visualização, Comprovativos TIFF e Exportação

### 4.1 Duplo Modo de Visualização (`viewMode`)
- **Vista Tabela Compacta (`tabela` — Predefinida)**: Apresenta uma grelha densa com 12 colunas (`Nº Documento`, `Movimento`, `Data`, `Destinatário + Classificação`, `Morada`, `Cod_Postal`, `Localidade`, `Requisição`, `Linhas`, `Qtd Total`, `Estado` e `Comprovativo`). Clicar no número do documento abre o **Modal de Detalhe do Documento**.
- **Vista Detalhada em Cartões (`detalhado`)**: Expande cada movimento num cartão individual contendo o bloco de morada/requisição/data de entrega e a tabela completa de linhas (`Artigo`, `Descrição`, `Lote`, `Validade` e `Quantidade`).

### 4.2 Visualizador de Comprovativos de Entrega TIFF $\rightarrow$ PNG ([`handleViewComprovativo`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/historico-pedidos/historico-pedidos-view.tsx#L91-L146))
Quando o estado do movimento é **`Entregue`** ou **`Entregue PDA`** e existe `url_comprovativo`:
1. Verifica primeiro se a imagem já foi convertida na sessão atual (`comprovativoCacheRef` em memória) para abertura instantânea.
2. Caso contrário, solicita ao **Supabase Storage** um URL assinado temporário (`createSignedUrl` válido por 60 segundos) no bucket privado **`comprovativos_ttir`**.
3. Descarrega o ficheiro binário (`.tif`/`.tiff`) como `ArrayBuffer` e carrega sob demanda (`await import('utif')`) o descodificador **UTIF**.
4. Descodifica o primeiro *Image File Directory* (`ifds[0]`) para matriz `RGBA8`, desenha num elemento `<canvas>` HTML5 e gera um DataURL `image/png`, apresentando o modal de visualização com botão **Transferir PNG**.

### 4.3 Exportação CSV ao Nível da Linha ([`handleExportCSV`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/historico-pedidos/historico-pedidos-view.tsx#L283-L368))
- Exporta todos os movimentos filtrados desdobrados ao nível de cada linha de lote (18 colunas: dados completos do cabeçalho + `Codigo Artigo`, `Descricao Artigo`, `Lote`, `Validade` e `Quantidade`), precedido de `BOM UTF-8 (\uFEFF)` para compatibilidade direta com o Microsoft Excel.
