# Página de Histórico de Pedidos

**Rota:** `/historico-pedidos`

Exibe a lista de pedidos já concluídos ou processados.

- **Componente principal:** `src/app/historico-pedidos/page.tsx`
- **Componente de visualização:** `src/app/historico-pedidos/historico-pedidos-view.tsx`
- **Funcionalidade chave:** Consulta a view `vw_stock_pedidos` (ou a tabela `pedido_linhas`) para apresentar histórico, com filtros por data, cliente e estado.
- **Permissões:** Gestor, Administrador.

> O componente inclui botões de exportação CSV e filtros avançados.

