# Página de Pedidos

**Rota:** `/pedidos`

Lista todos os pedidos em aberto ou em processamento.

- **Componente principal:** `src/app/pedidos/page.tsx`
- **Componentes filhos:**
  - `NovoPedidoForm` (`src/app/pedidos/novo-pedido-form.tsx`) – formulário para criar um novo pedido.
  - `TabelaPedidos` – tabela que exibe campos como `id`, `cliente_sigla`, `data_criacao`, `estado`, `stock`.
- **Funcionalidade chave:**
  - Botão **Submeter Pedido** aciona a RPC `transferir_plat_movimentos_para_movimentos` e, se o campo `stock` estiver `true`, contabiliza em stock.
  - Botão **Concluir** altera o estado para *concluído* sem tocar no stock.
- **Permissões:** Gestor, Administrador.

> O código inclui filtros por cliente e estado, e permite exportar a lista como CSV.

