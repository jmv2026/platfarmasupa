# Documentação Funcional e Técnica — Módulo de Gestão de Stocks

**Projeto:** PlatFarmaSupa (Sermail)  
**Rota abrangida:** `/stocks`  
**Documento no repositório:** [DOCUMENTACAO_STOCKS.md](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/docs/DOCUMENTACAO_STOCKS.md)

---

## 1. Visão Geral

O módulo de **Stocks** (`/stocks`) centraliza o controlo físico, comercial e regulamentar do inventário farmacêutico e logístico na plataforma **PlatFarmaSupa**. Permite consultar em tempo real o stock disponível para venda (Armazém `01`), o stock consolidado em todos os estados de armazém (Quarentena, Devoluções, Expirados, Danificados, etc.), o resumo agregado por artigo, o controlo FEFO (*First Expired, First Out*) de validades parametrizado por cliente e a monitorização de referências com rotura total (**Stock 0**).

### Arquitetura e Fluxo de Dados

![Mapa de Arquitetura e Fluxo de Dados — Página Stocks](/C:/Users/joaom/.gemini/antigravity/brain/68759e4d-57ed-4be2-abe7-3e139dcca28d/mapa_stocks.svg)

### Arquitetura de Ficheiros
| Ficheiro | Função Principal |
| :--- | :--- |
| [src/app/stocks/page.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/stocks/page.tsx) | *Server Component* da rota `/stocks`; autentica o utilizador via `getAuthContext()`, aplica o isolamento por cliente (`userClientId`) e carrega em paralelo (`Promise.all`) as *views* `vw_stock_atual` (com ordenação composta determinística `artigo_id`, `cliente_id`, `tipo_armazem`, `lote`), `vw_stock_zero`, `clientes` e `tempos`, derivando `stockPedidos` a partir dos registos do Armazém `01` com `stock > 0`. |
| [src/app/stocks/stocks-view.tsx](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/stocks/stocks-view.tsx) | *Client Component* principal de visualização, filtragem multi-critério (com comutação automática para a aba **Stock Consolidado** ao selecionar armazéns `<> 01`), conversão uniforme de `tipo_artigo` via `ID_TIPO_ARTIGO_MAP` / `TIPO_ARTIGO_LABELS`, ordenação dinâmica por colunas (`Intl.Collator`), cálculo dos 4 KPIs de topo e exportação para CSV / Excel (`.xlsx`). |
| [src/app/stocks/actions.ts](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/stocks/actions.ts) | *Server Actions* restritas ao perfil `admin` ([`editarLinhaStockAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/stocks/actions.ts#L6-L31) e [`apagarLinhaStockAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/stocks/actions.ts#L33-L45)) para manutenção direta de registos na tabela `public.stock`, com invalidação automática de cache (`revalidatePath`). |
| [20261109201500_remove_movimentos_posteriores_from_stock_views.sql](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/supabase/migrations/20261109201500_remove_movimentos_posteriores_from_stock_views.sql) | Definição SQL atualizada das *views* de cálculo de stock (`vw_stock_atual`, `vw_stock_pedidos` e `vw_stock_zero`), apurando o stock exclusivamente a partir de `public.stock` menos os pedidos pendentes de faturação no ERP (`pedidos_pendentes_erp`). |

---

## 2. Motor de Contabilização de Stock (Regras de Negócio SQL)

> [!IMPORTANT]
> As *views* `public.vw_stock_atual`, `public.vw_stock_pedidos` e `public.vw_stock_zero` calculam o saldo de cada cliente, armazém (`tipo_armazem`), artigo e lote combinando duas fontes de dados sem duplicação de movimentos históricos:

$$\text{Stock Lote} = \text{Stock Base}_{\text{stock}} - \sum_{\text{doc\_primavera} \notin \text{movimentos}} \text{Pedidos Ativos}_{\text{pedidos}}$$

1. **Base Primária Consolidada de Stock (`public.stock` — CTE `stock_resolvido`)**:
   - Constitui a referência direta do saldo físico por cliente, armazém (`tipo_armazem`), artigo e lote sincronizado a partir do ERP Primavera / MS Access (`sync_stock_from_access` ou importação manual).
   - O campo `data_stock` é do tipo `timestamp with time zone` (data e hora da linha de stock no ERP).
   - A associação ao cliente resolve-se por prioridade: `sigla`/`cliente_ser`, `entidade` (`cli_primavera`) ou prefixo de 3 caracteres do código de `armazem`.
   - **Prevenção de Dupla Contabilização**: Como o snapshot da tabela `public.stock` já reflete todas as entradas (`ES`, `ET`) e saídas (`SS`, `ST`) registadas no ERP, as *views* não voltam a somar linhas de `public.movimentos_linhas`, eliminando duplicações causadas por timestamps de reimportação (`updated_at > data_stock`).

2. **Pedidos Efetuados Pendentes de ERP (`public.pedidos` + `public.pedido_linhas` — CTE `pedidos_pendentes_erp`)**:
   - Contabiliza todos os pedidos efetuados na plataforma (`COALESCE(p.stock, true) = true` e `status <> 'cancelado'`), abatendo `-quantidade` ao **Armazém `01` (Venda)** do respetivo cliente, artigo e lote.
   - **Exclusão Automática por `doc_primavera` (`documento_ref`)**: São excluídos do abate via `pedidos` todos os pedidos cujo campo `doc_primavera` coincida com algum `documento_ref` na tabela `public.movimentos`:
     ```sql
     AND NOT (
         NULLIF(TRIM(BOTH FROM p.doc_primavera), ''::text) IS NOT NULL
         AND EXISTS (
             SELECT 1
             FROM public.movimentos m
             WHERE lower(TRIM(BOTH FROM m.documento_ref)) = lower(TRIM(BOTH FROM p.doc_primavera))
         )
     )
     ```
   - Assim que o pedido é faturado/integrado no ERP (`public.movimentos`), deixa de ser abatido em duplicado via `pedidos_pendentes_erp`.

---

## 3. Indicadores Superiores (4 Cartões de KPI)

No topo da página `/stocks` são calculados 4 indicadores operacionais numa única passagem $O(N)$ sobre `vw_stock_atual` (com mapeamento de `tipo_artigo` via `ID_TIPO_ARTIGO_MAP`):

| # | Indicador (KPI) | Regra de Negócio / Critério | Significado Operacional |
| :-: | :--- | :--- | :--- |
| **1** | **Stock Outros Armazéns** | $\sum \text{stock}$ onde `tipo_armazem <> '01'` | Total de unidades fora do circuito comercial (Quarentena `05`, Devoluções `04`, Expirados `02`, Danificados `03`, Destruição `06`, Farmacoteca `07`, Validade `09`, MIA `10`). |
| **2** | **Alertas Validade DM** *(Dispositivos Médicos)* | Contagem de `artigo_id` distintos do tipo `DM` (`82`) com $\text{dias até validade} \le 0$. | Dispositivos médicos com lote já expirado em armazém. |
| **3** | **Alertas Validade DC e SA** *(Dermocosméticos e Suplementos)* | Contagem de `artigo_id` distintos dos tipos `DC` (`83`) ou `SA` (`84`) com $\text{dias até validade} \le 0$. | Dermocosméticos e suplementos alimentares expirados em armazém. |
| **4** | **Alertas Validade MH** *(Medicamentos de Uso Humano)* | Contagem de `artigo_id` distintos do tipo `MH` (`80`) com $\text{dias até validade} < 180\text{ dias}$. | Medicamentos humanos em janela regulamentar de risco de caducidade (inferior a 6 meses). |

---

## 4. Sistema de Pesquisa e Filtros Multi-Critério

O painel de filtragem atua transversalmente sobre as abas de stock:

1. **Pesquisa Textual Rápida**: Filtra em simultâneo por código do artigo (`artigo_id`), código cliente (`artigo_cli`), descrição (`descricao`), número de lote (`lote`), código de localização (`armazem_loc`) e sigla/nome do cliente.
2. **Filtro de Cliente**: Visível para `admin` e `gestor` (`Todos os Clientes` ou cliente específico); fixado na empresa do utilizador para perfis `user1` e `user2`.
3. **Filtro de Conservação (`tipo_armazenamento`)**:
   - `TF` — Temperatura Frio ($2\text{–}8\text{ ºC}$)
   - `TC` — Temperatura Controlada ($15\text{–}25\text{ ºC}$)
   - `TA` — Temperatura Ambiente
4. **Filtro de Tipo de Artigo (`tipo_artigo`)**:
   - Compatível tanto com siglas (`MH`, `MV`, `DM`, `DC`, `SC`, `SA`) como com os códigos numéricos do catálogo (`80` a `85`) através de `ID_TIPO_ARTIGO_MAP`.
5. **Filtro de Tipo de Armazém (`tipo_armazem`)**:
   - `01` (Venda), `02` (Expirados), `03` (Danificados), `04` (Devoluções), `05` (Quarentena), `06` (Destruição), `07` (Farmacoteca), `09` (Validade), `10` (MIA).
   - **Comutação Inteligente de Aba**: Caso o utilizador esteja posicionado na aba **Stock de Venda** (`pedidos`) ou **Artigos com Stock 0** (`stock_zero`) e selecione no filtro um armazém diferente de `01` (ex.: `05 - Quarentena`), a vista muda automaticamente para a aba **Stock Consolidado** (`consolidado`), apresentando de imediato as existências desse armazém.

---

## 5. As 5 Abas de Consulta de Stock

A navegação entre abas preserva no DOM as abas já visitadas (`visitedTabs`) para comutação instantânea e permite ordenação crescente/decrescente clicando nos cabeçalhos **Artigo** e **Descrição do Artigo**:

### 5.1 Aba 1 — Stock de Venda (`vw_stock_pedidos`)
- Apresenta exclusivamente os lotes alojados no **Armazém `01` (Venda Livre)** com saldo positivo (`stock > 0`), já líquidos de pedidos pendentes de faturação no ERP, disponíveis para alocação imediata na criação de pedidos.
- **Coluna Tipo de Artigo**: Exibe a designação completa do tipo de artigo (`TIPO_ARTIGO_LABELS[ID_TIPO_ARTIGO_MAP[item.tipo_artigo]]`) num badge azul uniforme, idêntico ao da aba **Artigos com Stock 0**.
- **Destaque de Limiar Parametrizado (`tempos`)**: Cruza cada linha com os limiares definidos para o cliente na tabela `public.tempos` (`VAL_MH`, `VAL_MV`, `VAL_DM`, `VAL_DC`, `VAL_SA`). Se os dias restantes até à validade forem iguais ou inferiores ao limiar do cliente ($\text{dias} \le \text{VAL\_TIPO}$), a linha é destacada a âmbar.

### 5.2 Aba 2 — Stock Consolidado (`vw_stock_atual`)
- Mostra todos os lotes com saldo positivo distribuídos por **todos os armazéns** (`01` a `10`), identificando `armazem_loc`, `tipo_armazem`, a descrição do armazém, `data_stock` e `ultimo_movimento`.
- **Modo Administrador (`isAdmin`)**: Nos perfis de administração, cada linha disponibiliza botões para **Editar** ([`editarLinhaStockAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/stocks/actions.ts#L6-L31)) ou **Apagar** ([`apagarLinhaStockAction`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/stocks/actions.ts#L33-L45)) o registo de stock correspondente.

### 5.3 Aba 3 — Agrupado por Artigo (`resumoArtigos`)
- Agrega todos os lotes de cada referência (`cliente_id + artigo_id`) numa linha única, discriminando:
  - **Tipo de Artigo**: Apresentado com o mesmo badge azul e tradução via `ID_TIPO_ARTIGO_MAP` / `TIPO_ARTIGO_LABELS`;
  - **Stock Venda (`01`)**: Unidades disponíveis para expedição comercial;
  - **Stock Outros (`<> 01`)**: Unidades retidas noutros armazéns;
  - **Stock Total**: Soma global ($\text{Stock Venda} + \text{Stock Outros}$);
  - **N.º de Lotes Distintos** e **Primeira Validade (FEFO)**.

### 5.4 Aba 4 — Controlo de Validades (`lotesValidade`)
- Lista todos os lotes com data de validade atribuída, ordenados por defeito segundo a regra **FEFO** (*First Expired, First Out* — validade mais próxima no topo).
- Calcula os **Dias Restantes** ($\lceil(\text{Validade} - \text{Hoje}) / 86\,400\,000\rceil$) e classifica o estado de cada lote consoante os tempos parametrizados por cliente e tipologia de artigo (**Expirado**, **Bloqueado / Alerta** ou **Conforme**).

### 5.5 Aba 5 — Artigos com Stock 0 (`vw_stock_zero`)
- Identifica todas as referências do catálogo do cliente (`public.artigos`) ou com histórico de stock/pedidos cujo saldo total atual em armazém é **zero** ($\sum \text{stock} \le 0$).
- **Regra de Exclusão ao Nível do Artigo**: O lote é ignorado — se um artigo tiver stock positivo em qualquer lote ou armazém (`positive_articles`), nunca é listado como Stock 0. Mostra também o badge de **Tipo de Artigo**, a data do **Último Movimento** (`ultimo_movimento`) e o **Total de Registos** (`total_movimentos`).

---

## 6. Exportação de Dados (CSV e Excel `.xlsx`)

Os botões de exportação no topo da página exportam exatamente a vista e os filtros ativos na aba selecionada:
- **Exportação CSV**: Gera um ficheiro `.csv` codificado em `UTF-8 com BOM (\uFEFF)` para abertura direta no Microsoft Excel com acentuação portuguesa preservada.
- **Exportação Excel (`.xlsx`)**: Carrega dinamicamente a biblioteca `ExcelJS` (`await import('exceljs')`) e gera uma folha de cálculo nativa formatada com cabeçalho institucional verde-floresta Sermail (`#1B4332`), designação traduzida do **Tipo de Artigo**, larguras de coluna ajustadas e formatação numérica/datas localizada (`pt-PT`).
