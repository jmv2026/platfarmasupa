# Página de Stocks

**Rota:** `/stocks`

Apresenta a lista de todo o stock atual por artigo e cliente.

- **Componente principal:** `src/app/stocks/page.tsx`
- **Componente de visualização:** `src/app/stocks/stocks-view.tsx`
- **Funcionalidade chave:** Consulta a view `vw_stock_atual` (agora unificada) e exibe colunas como `artigo_id`, `cliente_sigla`, `quantidade`, `valido_ate`.
- **Filtros:** Por cliente, artigo, validade e localização de armazém.
- **Permissões:** Gestor, Administrador.

> Cada linha tem ação de exportar CSV e botão de detalhe que abre `src/app/stocks/stocks-view.tsx`.

