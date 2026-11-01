# Módulos da Aplicação

Esta secção contém a documentação dos módulos reutilizáveis e utilitários presentes em `src/app/**/components` ou `src/lib`.

## Componentes Principais

- **SignOutButton** – botão de logout usado no dashboard. Implementado em `src/app/dashboard/sign-out-button.tsx`.
- **GraficoPrevisaoStock** – componente que renderiza o gráfico de previsão de stock. Implementado em `src/app/dashboard/grafico-previsao-stock.tsx`.
- **GraficoFaturacaoMensal** – gráfico de faturação mensal (`src/app/dashboard/grafico-faturacao-mensal.tsx`).
- **GraficoPedidosMensal** – gráfico de pedidos mensais (`src/app/dashboard/grafico-pedidos-mensal.tsx`).
- **GraficoTopProdutos** – gráfico dos top produtos (`src/app/dashboard/grafico-top-produtos.tsx`).
- **Importacao*Card** – cartões de importação de diferentes tipos (artigos, faturas, stock, etc.) localizados em `src/app/configuracao/`.
- **PrevisaoStockView** – visualização da previsão de stock (`src/app/dashboard/previsao-stock/previsao-stock-view.tsx`).
- **HistoricoPedidosView** – visualização da lista de histórico de pedidos (`src/app/historico-pedidos/historico-pedidos-view.tsx`).
- **NovoPedidoForm** – formulário de criação de novo pedido (`src/app/pedidos/novo-pedido-form.tsx`).
- **StocksView** – visualização da lista de stocks (`src/app/stocks/stocks-view.tsx`).

## Utilitários

- **actions.ts** – arquivos de actions (RPCs) para diferentes domínios (`src/app/*/actions.ts`).
- **loading.tsx** – componentes de loading genéricos usados nas páginas.

> Cada módulo deve ser aprofundado com descrição de props, estado interno e exemplos de uso.

