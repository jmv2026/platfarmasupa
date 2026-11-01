# Página do Dashboard

**Rota:** `/dashboard`

Página principal após login, apresenta gráficos de faturação, pedidos, stock e topo de produtos.

- **Componente principal:** `src/app/dashboard/page.tsx`
- **Componentes filhos:**
  - `GraficoFaturacaoMensal` (`src/app/dashboard/grafico-faturacao-mensal.tsx`)
  - `GraficoPedidosMensal` (`src/app/dashboard/grafico-pedidos-mensal.tsx`)
  - `GraficoPrevisaoStock` (`src/app/dashboard/grafico-previsao-stock.tsx`)
  - `GraficoTopProdutos` (`src/app/dashboard/grafico-top-produtos.tsx`)
- **Funcionalidade chave:** Cada gráfico consome dados das views de stock e das tabelas de movimentos via RPCs/queries.
- **Permissões:** Gestor, Administrador.

> Cada gráfico inclui um botão de exportar CSV que chama a função RPC correspondente.
