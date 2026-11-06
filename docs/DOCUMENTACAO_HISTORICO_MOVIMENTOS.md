# Documentação Funcional e Técnica — Módulo Histórico de Movimentos

**Projeto:** PlatFarmaSupa (Sermail)  
**Rota abrangida:** `/historico-pedidos` (Menu: **Histórico Movimentos**)

---

## 1. Visão Geral

O módulo **Histórico de Movimentos** (`/historico-pedidos`) disponibiliza a consulta unificada de todas as operações logísticas de armazém e expedição na plataforma **PlatFarmaSupa**. Combina num único painel os pedidos submetidos na plataforma (`public.pedidos`) e os movimentos físicos de entrada, transferência e saída importados do ERP/MS Access (`public.movimentos` e `public.movimentos_linhas`), enriquecidos automaticamente com o estado de entrega da transportadora **Torrestir** (`public.VW_torrestir_last`) e com visualização integrada de **Comprovativos de Entrega (POD)** digitalizados em formato TIFF.

### Arquitetura de Ficheiros
| Ficheiro | Função Principal |
| :--- | :--- |
| [src/app/historico-pedidos/page.tsx](../src/app/historico-pedidos/page.tsx) | *Server Component* da rota `/historico-pedidos`; valida a sessão via `getAuthContext()`, aplica o isolamento por cliente (`userClientId`), carrega em paralelo (`Promise.all` + `fetchAllRowsFast`) `clientes`, `pedidos`, `VW_torrestir_last` e `movimentos_linhas`, agrupa movimentos em documentos virtuais e cruza o estado de expedição em $O(1)$. |
| [src/app/historico-pedidos/historico-pedidos-view.tsx](../src/app/historico-pedidos/historico-pedidos-view.tsx) | *Client Component* interativo: gere a pesquisa global e os 5 filtros dropdown, comuta entre a **Vista Tabela Compacta** e a **Vista Detalhada em Cartões**, exporta para CSV (`UTF-8 com BOM`) e descodifica comprovativos `.tiff` para `.png` em `<canvas>` via biblioteca `utif`. |
| [src/lib/supabase/pagination.ts](../src/lib/supabase/pagination.ts) | Utilitário `fetchAllRowsFast` que contorna o limite de 1000 linhas do PostgREST carregando páginas de 2000 registos em paralelo. |

---

## 2. Motor de Unificação de Dados no Servidor (`page.tsx`)

1. **Isolamento Multi-Tenant (RBAC)**:
   - Utilizadores `admin` e `gestor` consultam movimentos de todos os clientes ativos.
   - Utilizadores `user1` e `user2` têm as queries de `pedidos` e `movimentos_linhas` estritamente filtradas pelo seu `userClientId`.
2. **Regra de Exclusão de Pedidos Processados (`processedOrderRefs`)**:
   - Os pedidos cujo campo `processado = true` na tabela `public.pedidos` (bem como movimentos cujo `documento_ref` coincida com o `nr_pedido`, `sigla_pedido` ou `doc_primavera` desses pedidos) são filtrados e ocultados.
3. **Agrupamento de Linhas de Movimento em Documentos (`pseudoPedidosList`)**:
   - As linhas de `public.movimentos_linhas` são agrupadas em $O(N)$ pela chave `${cliente_id}_${documento_ref}_${tipo_movimento}`, recebendo automaticamente o estado `Rececionado` (`ES`), `Transfer` (`ET`/`ST`) ou `Em Preparação` (`SS`).
4. **Cruzamento Automático com Tracking Torrestir (`VW_torrestir_last`)**:
   - A referência `ref_ser` normalizada é cruzada em $O(1)$ com `statusMap`, atualizando o `status` com `desc_estado_expedicao` e associando o caminho `url_comprovativo`.

---

## 3. Sistema de Pesquisa, Vistas, Comprovativos TIFF e Exportação

- **Pesquisa Textual Global e 5 Filtros Dropdown**: Pesquisa no cabeçalho e nas linhas de artigos/lotes, combinável com filtros de Cliente, Tipo de Movimento (`ES`, `ET`, `SS`, `ST`), Estado, Artigo e Período (`Hoje`, `7 dias`, `30 dias`, `Este mês`, `Todos`).
- **Duplo Modo de Visualização (`viewMode`)**: Comutação entre **Vista Tabela Compacta** (12 colunas + Modal de Detalhe) e **Vista Detalhada em Cartões**.
- **Visualizador de Comprovativos TIFF -> PNG (`handleViewComprovativo`)**: Gera um *Signed URL* (60s) no bucket `comprovativos_ttir` do Supabase Storage, descodifica o ficheiro `.tiff` no browser com `utif` para `<canvas>` HTML5, guarda em cache e permite descarregar como `.png`.
- **Exportação CSV (`UTF-8 com BOM`)**: Exporta todos os movimentos filtrados ao nível da linha de lote (18 colunas).

