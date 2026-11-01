# Página de Configuração

**Rota:** `/configuracao`

Página onde o utilizador pode gerir importações de artigos, faturas, stock, etc.

- **Componente principal:** `src/app/configuracao/page.tsx`
- **Componentes filhos:** cartões de importação (`ImportacaoArtigosCard`, `ImportacaoFaturasCard`, `ImportacaoStockCard`, etc.)
- **Funcionalidade chave:** Cada cartão abre um separador (`importacao‑artigos-tab`, `importacao‑faturas‑tab`, …) que permite upload de ficheiros CSV e invoca RPCs de importação.
- **Permissões:** Gestor, Administrador.

> O código contém chamadas a `supabase.from('...').insert` e `rpc` para processar os dados importados.
