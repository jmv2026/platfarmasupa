# Página de Processamento de Pedidos

**Rota:** `/proc-pedidos`

Interface usada pelos gestores para processar pedidos pendentes.

- **Componente principal:** `src/app/Proc_Pedidos/page.tsx`
- **Componente de visualização:** `src/app/Proc_Pedidos/proc-pedidos-view.tsx`
- **Funcionalidade chave:**
  - Lista de pedidos com estado *pendente*.
  - Botão **Processar** atualiza o estado para *processado* e, se o campo `stock` está `true`, deduz o stock via a mesma RPC utilizada no formulário de novo pedido.
- **Permissões:** Gestor, Administrador.

> O componente utiliza a view `vw_stock_pedidos` para apresentar informações detalhadas do stock associado a cada pedido.

