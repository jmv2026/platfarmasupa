# Página de Previsão de Stock

**Rota:** `/dashboard/previsao-stock`

Sub‑página do Dashboard que exibe a previsão de stock baseada em movimentos futuros e tendências.

- **Componente principal:** `src/app/dashboard/previsao-stock/page.tsx`
- **Componente de visualização:** `src/app/dashboard/previsao-stock/previsao-stock-view.tsx`
- **Funcionalidade chave:**
  - Consulta a view `vw_stock_atual` e combina com dados de movimentos futuros para gerar uma projeção.
  - Renderiza o gráfico `GraficoPrevisaoStock` (arquivo `grafico-previsao-stock.tsx`).
  - Permite selecionar o horizonte de previsão (7, 14, 30 dias) via dropdown.
- **Permissões:** Gestor, Administrador.

> O cálculo de previsão utiliza a função SQL `fn_previsao_stock` definida na migração `20261011153000_create_table_movimentos_sf.sql` (ou similar).

