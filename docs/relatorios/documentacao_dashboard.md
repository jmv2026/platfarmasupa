# Documentação Funcional e Técnica — Dashboard e Previsão de Stock

> [!NOTE]
> Esta documentação descreve a arquitetura, fontes de dados, regras de negócio dos indicadores (KPIs), gráficos analíticos e o modelo matemático de **Previsão de Stock** do módulo **Dashboard** da aplicação **PlatFarmaSupa (Sermail)**. O documento encontra-se também guardado no repositório em [DOCUMENTACAO_DASHBOARD.md](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/docs/DOCUMENTACAO_DASHBOARD.md).

---

## 1. Arquitetura e Fluxo de Dados

![Mapa de Arquitetura e Fluxo de Dados — Dashboard](/C:/Users/joaom/.gemini/antigravity/brain/68759e4d-57ed-4be2-abe7-3e139dcca28d/mapa_dashboard.svg)

### Ficheiros do Módulo
- **[page.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/dashboard/page.tsx)**: *Server Component* da rota `/dashboard`. Valida a sessão com [`getAuthContext`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/lib/supabase/session.ts), aplica o isolamento por cliente (`userClientId`) para utilizadores não-administradores e executa o carregamento paralelo (`Promise.all`) das *views* da base de dados.
- **[dashboard-view.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/dashboard/dashboard-view.tsx)**: *Client Component* principal do Dashboard. Gere o seletor de clientes (para perfis `admin` e `gestor`), calcula os 6 KPIs superiores e alterna instantaneamente entre os separadores de gráficos.
- **[grafico-pedidos-mensal.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/dashboard/grafico-pedidos-mensal.tsx)**: Gráfico SVG interativo da evolução mensal de pedidos.
- **[grafico-top-produtos.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/dashboard/grafico-top-produtos.tsx)**: Ranking visual e tabela detalhada dos produtos com maior volume de expedição (`vw_saidas`), com navegação direta para a previsão de stock do produto clicado.
- **[grafico-faturacao-mensal.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/dashboard/grafico-faturacao-mensal.tsx)**: Análise mensal financeira (Mercadoria, IVA, Descontos e Valor Líquido) e de unidades faturadas (`vw_fact_mes`).
- **[previsao-stock/page.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/dashboard/previsao-stock/page.tsx)** & **[previsao-stock-view.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/dashboard/previsao-stock/previsao-stock-view.tsx)**: Página dedicada (`/dashboard/previsao-stock`) para simulação e análise preditiva de rotura de stock.
- **[grafico-previsao-stock.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/dashboard/grafico-previsao-stock.tsx)**: Motor de cálculo de *Run-Rate*, abate de validades futuras, projeção de stock e interseção geométrica do **Ponto de Encomenda**.

---

## 2. Controlo de Acessos por Perfil de Utilizador

| Perfil (`role`) | Visibilidade no Dashboard | Seletor de Cliente |
| :--- | :--- | :--- |
| **`admin` / `gestor`** | Acesso global a todos os clientes ativos, podendo agregar dados de toda a operação Sermail ou isolar um cliente específico. | Visível (`Todos os Clientes` ou `[SIGLA] Nome`). |
| **`user1` / `user2`** | Acesso estritamente isolado ao seu `cliente_id` (filtrado na query do servidor e garantido por *Row-Level Security* na base de dados). | Oculto (dados pré-filtrados pela entidade do utilizador). |

---

## 3. Os 6 Indicadores Superiores (Cartões KPI)

Calculados em tempo real em [`DashboardView`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/dashboard/dashboard-view.tsx#L189-L260) a partir do stock e histórico de pedidos filtrados:

1. **Artigos em Risco *(Medicamentos de Uso Humano — MH)***:
   - Conta referências distintas (`artigo_id`) em `vw_stock_atual` com validade entre **61 e 179 dias** (`60 < dias < 180`) cujo `tipo_artigo` seja Medicamento de Uso Humano (`MH`).
2. **Artigos Bloqueados**:
   - Conta referências distintas (`artigo_id`) em `vw_stock_atual` com lotes a expirar num prazo crítico de **1 a 60 dias** (`0 < dias <= 60`), para qualquer tipologia de artigo.
3. **Pedidos do Mês em Curso**:
   - Total de pedidos em `vw_pedidos` realizados no mês e ano correntes.
4. **Pedidos do Ano Corrente**:
   - Total acumulado de pedidos realizados desde 1 de janeiro do ano civil atual.
5. **Total Histórico de Pedidos**:
   - Volume global de pedidos registados na plataforma para o âmbito selecionado.
6. **Artigos com Stock**:
   - Total de referências distintas (`artigo_id`) com stock físico positivo no armazém (`vw_stock_atual`).

---

## 4. Painéis Gráficos do Dashboard (`/dashboard`)

### 4.1 Evolução Mensal de Pedidos ([`GraficoPedidosMensal`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/dashboard/grafico-pedidos-mensal.tsx#L44-L120))
- **Fonte**: `public.vw_pedidos` (`data_pedido` / `created_at`).
- **Filtros Temporais**: `Mês Atual`, `3M`, `6M`, `12M`, `Ano Atual` e `Todos`.
- **Modos de Gráfico**: `Combinado` (Barras + Linha de tendência suave), `Barras` e `Área`.
- **Indicadores**: Total de pedidos no período, média mensal, mês de pico máximo e taxa de variação mensal ($\text{MoM \%}$).

### 4.2 Top Produtos Mais Expedidos ([`GraficoTopProdutos`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/dashboard/grafico-top-produtos.tsx#L58-L120))
- **Fonte**: `public.vw_saidas` (`quantidade`, `data_movimento`, `documento_ref`).
- **Opções de Ranking**: `Top 5`, `Top 10` ou `Top 25` artigos com maior quantidade expedida no período (`Mês Atual`, `3M`, `6M`, `12M`, `Ano Atual`, `Todos`).
- **Ação Interativa**: Clicar em qualquer barra ou linha da tabela abre a **Previsão de Stock** já posicionada nesse artigo (`/dashboard/previsao-stock?codigo=...`).

### 4.3 Faturação Mensal ([`GraficoFaturacaoMensal`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/dashboard/grafico-faturacao-mensal.tsx#L73-L120))
- **Fonte**: `public.vw_fact_mes`.
- **Regra de Exibição**: Apresentado apenas para clientes com `tipo_cliente = 'CF'` (Cliente com Faturação).
- **Métricas Comutáveis**:
  - **Faturação (€)**: Evolução mensal do Valor Líquido ($\text{Total Mercadoria} - \text{Total IVA} - \text{Total Descontos}$), com detalhe por mês inspecionado.
  - **Unidades**: Quantidade total de unidades faturadas/movimentadas em cada mês.

---

## 5. Previsão de Stock e Ponto de Encomenda (`/dashboard/previsao-stock`)

O componente [`GraficoPrevisaoStock`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/dashboard/grafico-previsao-stock.tsx#L77-L528) combina o stock atual por lote/validade (`vw_stock_atual`) com o histórico de consumo (`vw_pedidos`) para projetar a evolução futura do stock de cada artigo.

### Fórmulas de Cálculo

1. **Consumo Médio Mensal (*Run-Rate* de $N \in \{3, 6, 12\}$ meses)**:
   $$\text{Consumo Médio Mensal} = \text{round}\left(\frac{\sum \text{Qtd. Pedida nos últimos } N \text{ meses}}{N}\right)$$

2. **Projeção Mensal de Stock ($m = 1 \dots H$, com horizonte $H \in \{3, 6, 12\}$ meses)**:
   Em cada mês futuro $m$, o modelo deduz quer o consumo médio estimado quer os lotes cuja data de validade expira nesse mês ($\text{Stock Expirado}_m$):
   $$\text{Stock Projetado}_m = \max\left(0,\; \text{Stock Projetado}_{m-1} - \text{Consumo Médio Mensal} - \text{Stock Expirado}_m\right)$$

3. **Autonomia e Nível de Segurança**:
   $$\text{Autonomia (Meses)} = \frac{\text{Stock Atual}}{\text{Consumo Médio Mensal}}, \qquad \text{Nível de Segurança} = \text{Consumo Médio Mensal} \times \text{Meses de Reposição}$$

4. **Cálculo Geométrico do Ponto de Encomenda**:
   O gráfico determina a interseção exata entre a reta de decaimento do stock e o patamar horizontal do **Nível de Segurança**, adaptando dinamicamente a escala horizontal do SVG em 3 cenários:
   - **À Esquerda (Alerta Vermelho — Já Ultrapassado)**: Quando o stock atual já é inferior ao Nível de Segurança, prolonga a linha a tracejado para a esquerda indicando há quantos meses o ponto de encomenda foi ultrapassado.
   - **Dentro do Horizonte (Alerta Âmbar)**: Assinala o ponto exato de cruzamento dentro da janela de $3$, $6$ ou $12$ meses e indica o mês recomendado para encomendar.
   - **À Direita (Estável — Fora do Horizonte)**: Quando o stock no final do período ainda supera o Nível de Segurança, prolonga a reta para a direita indicando em que mês futuro será atingido o ponto de encomenda.
