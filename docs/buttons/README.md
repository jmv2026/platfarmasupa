# Botões da Aplicação

Esta secção enumera os botões de interface encontrados na aplicação, descrevendo a ação que executam e as permissões necessárias.

## Botões Principais

| Botão | Ação | Permissões | Onde encontrado |
|-------|------|------------|-----------------|
| **Submeter Pedido** | Cria um novo `pedido` e invoca a RPC `transferir_plat_movimentos_para_movimentos`. Atualiza o stock se o campo `stock` está `true`. | Gestor, Administrador | `src/app/pedidos/novo-pedido-form.tsx`
| **Processar** | Marca o pedido como processado e atualiza o stock. | Gestor, Administrador | `src/app/Proc_Pedidos/proc-pedidos-view.tsx`
| **Concluir** | Finaliza o pedido, mas **não** altera o stock (lógica modificada). | Gestor, Administrador | `src/app/pedidos/page.tsx`
| **Contabilizar em Stock** | Alterna o campo `stock` (boolean) do pedido. Visível apenas para gestores e administradores. | Gestor, Administrador | `src/app/pedidos/novo-pedido-form.tsx`
| **Sign Out** | Termina a sessão do utilizador. | Todos | `src/app/dashboard/sign-out-button.tsx`
| **Filtrar** | Aplicação de filtros em tabelas (ex.: histórico de pedidos). | Todos | `src/app/historico-pedidos/historico-pedidos-view.tsx`

> Observação: Cada botão possui um handler onClick que chama funções RPC ou atualiza o estado da UI. Detalhes de propriedades e parâmetros podem ser adicionados posteriormente.

