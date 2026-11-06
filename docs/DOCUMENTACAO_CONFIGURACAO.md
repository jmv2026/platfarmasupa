# Documentação Funcional e Técnica — Página Configuração (`/configuracao`)

> [!IMPORTANT]
> **Módulo:** Consola Central de Administração, Dados Mestres e Integrações (`/configuracao`)  
> **Ficheiros Principais:** [`src/app/configuracao/page.tsx`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/configuracao/page.tsx), [`src/app/configuracao/configuracao-tabs.tsx`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/configuracao/configuracao-tabs.tsx), [`src/app/configuracao/actions.ts`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/configuracao/actions.ts)  
> **Acesso RBAC:** Exclusivo para o perfil **`admin`** (`profile.role === 'admin'` ou `user.email === 'admin@sermail.pt'`). Qualquer outro perfil é redirecionado no servidor para `/dashboard?error=unauthorized`.

---

## 1. Visão Geral e Objetivo do Módulo

A página **Configuração (`/configuracao`)** é o centro de comando administrativo e operacional da plataforma **PlatFarma**. Nela concentram-se todas as operações de gestão de identidades, parametrização de clientes e catálogos farmacêuticos, definição de SLAs de validade e *lead time*, importação em lote (*batch*) de dados operacionais (Stocks, Faturas/Movimentos, ERP Primavera, Transporte Torrestir e Comprovativos TIFF) e configuração dinâmica do servidor de notificações por email.

---

## 2. Arquitetura de Carregamento no Servidor (`page.tsx`)

O Server Component [`ConfiguracaoPage`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/configuracao/page.tsx#L12-L87) é executado em modo dinâmico (`export const dynamic = 'force-dynamic'`) e realiza três etapas antes de hidratar o cliente:

1. **Validação Estrita de Segurança (RBAC Server-Side):**
   - Invoca [`getAuthenticatedUserWithProfile()`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/utils/supabase/CachedAuth.ts).
   - Se não existir sessão ativa, redireciona para `/login`.
   - Se o utilizador não tiver `role === 'admin'` (nem o email de salvaguarda `admin@sermail.pt`), interrompe a renderização e redireciona para `/dashboard?error=unauthorized`.

2. **Carregamento Paralelo de 7 Fontes de Dados (`Promise.all`):**
   - `public.users`: Lista de utilizadores ordenada por `created_at DESC`.
   - `public.clientes`: Lista de clientes ordenada alfabeticamente por `nome_cliente`.
   - `public.artigos`: Catálogo mestre de artigos ordenado por `codigo_artigo`.
   - `public.armazens`: Lista de armazéns registados ordenada por `Designacao`.
   - `public.tempos`: Matriz completa de limiares de validade (`VAL_*`, `EXP_*`) e tempos de entrega por cliente.
   - `public.VW_torrestir_last`: Últimos `1000` registos consolidados de expedição Torrestir (`data_expedicao DESC`).
   - `public.configuracoes`: Leitura da chave `email_template_pedidos_destinatarios` via `.maybeSingle()`.

3. **Inspeção das Variáveis de Ambiente de Email (`.env.local`):**
   - Verifica no servidor a presença de `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e `RESEND_NOTIFICATION_EMAIL`, construindo o objeto `emailEnvStatus` (sem expor a chave secreta ao browser).

---

## 3. Orquestração de Interface e *Lazy Mounting* (`configuracao-tabs.tsx`)

O Client Component [`ConfiguracaoTabs`](file:///c:/1-Projetos_IA/Projetos_Antigravity/PlatFarmaSupa/src/app/configuracao/configuracao-tabs.tsx#L140-L240) gere **11 separadores** independentes através do estado `activeTab` e de um conjunto de separadores já visitados (`visitedTabs: Set<TabType>`):

- **Code-Splitting com `next/dynamic` (`ssr: false`):** Os 6 motores pesados de importação (`ImportacaoArtigosCard`, `ImportacaoStockTab`, `ImportacaoMovimentosTab`, `ImportacaoErpTab`, `ImportacaoTransporteTab` e `ImportacaoComprovativosTab`) só são transferidos e montados quando o administrador clica pela primeira vez no respetivo separador.
- **Preservação de Estado em Memória:** Uma vez visitado (`visitedTabs.has(tab)`), o componente permanece montado (alternando visibilidade CSS `hidden` / `block`), permitindo consultar outro separador sem perder o progresso de uma importação em curso.

---

## 4. Detalhe Funcional dos 11 Separadores

| # | Separador (`TabType`) | Funcionalidade Principal | Tabelas / Recursos Afetados |
| :--- | :--- | :--- | :--- |
| **1** | **Utilizadores** (`utilizadores`) | Criação de contas (`supabase.auth.signUp`), atribuição de perfil (`admin`, `gestor`, `user1`, `user2`), associação a `cliente_id`, idioma padrão (`PT`, `ES`, `EN`) e ativação/desativação (`ativo`). | `auth.users`, `public.users`, Cache LRU de Perfis |
| **2** | **Clientes** (`clientes`) | Registo e edição de clientes depositantes: `sigla` (máx. 4 caracteres, maiúsculas), `tipo_cliente` (`SF` Sem Faturação / `CF` Com Faturação), `cli_primavera`, NIF, morada e criação automática de SLAs padrão em `public.tempos`. | `public.clientes`, `public.tempos` |
| **3** | **Artigos** (`artigos`) | Gestão do catálogo mestre de SKUs: criação manual de artigo, limpeza global do catálogo e importação *batch* (`.xlsx`, `.csv`, `.txt`) com mapeamento de `tipo_produto` e condições de conservação. | `public.artigos` |
| **4** | **Validades** (`validades`) | Parametrização por cliente e por classe farmacêutica (**MH**, **MV**, **DM**, **DC**, **SA**) dos dias de **Aviso (`VAL_*`)** e dias de **Bloqueio/Expiração (`EXP_*`)** que governam os alertas e bloqueios FEFO em `/stocks` e `/pedidos/criar`. | `public.tempos` |
| **5** | **Lead Time** (`tempo_entrega`) | Configuração e consulta dos tempos médios de preparação e entrega (*lead time* logístico) acordados com cada cliente depositante. | `public.tempos` |
| **6** | **Movimentos** (`movimentos`) | Importação assistida de movimentos de armazém e faturas (`.xlsx`/`.csv`), populando cabeçalhos, linhas detalhadas e registos de faturação. | `public.movimentos`, `public.movimentos_linhas`, `public.faturas` |
| **7** | **ERP** (`erp`) | Integração de ficheiros exportados do ERP Primavera (`parse-erp-file.ts`) para reconciliação documental e logística. | `public.movimentos`, `public.faturas` |
| **8** | **Stocks** (`stocks`) | Motor de sincronização de fotografia de stock (`ImportacaoStockTab`): parsing local de `.xlsx`/`.csv`, validação de colunas e inserção em lotes de 500 registos. | `public.stock` |
| **9** | **Transporte** (`transporte`) | Importação de ficheiros de *tracking* do transportador Torrestir, atualizando estados de expedição, guias/portes, volumes e incidências. | `public.torrestir`, `public.VW_torrestir_last` |
| **10** | **Servidor de Email** (`email`) | Diagnóstico de `RESEND_API_KEY` e `RESEND_FROM_EMAIL`, gravação dinâmica da lista `email_template_pedidos_destinatarios` na tabela Key-Value `public.configuracoes` e disparo de emails de teste (simples e template HTML de pedido). | `public.configuracoes`, API Externa **Resend** |
| **11** | **Comprovativos** (`comprovativos`) | Upload em lote e indexação de comprovativos de entrega digitalizados (`.tif`/`.tiff`) diretamente para o bucket de Storage `comprovativos_ttir`. | Bucket Supabase Storage `comprovativos_ttir` |

---

## 5. Catálogo de Server Actions (`src/app/configuracao/actions.ts`)

- **`criarUtilizadorAction(formData)`**: Regista a credencial no Supabase Auth (`auth.signUp`), faz `upsert` do perfil em `public.users` com `role`, `cliente_id`, `idioma` e `ativo`, e limpa a cache com `invalidateUserProfileCache(authData.user.id)`.
- **`criarClienteAction(formData)`**: Valida a sigla (`<= 4` caracteres), insere o cliente em `public.clientes` e inicializa automaticamente o registo homólogo em `public.tempos` com valores por defeito (`VAL_* = 180` dias, `EXP_* = 60` dias).
- **`atualizarTemposClienteAction(formData)`**: Atualiza os 10 parâmetros de validade (`VAL_MH`, `EXP_MH`, `VAL_MV`, `EXP_MV`, `VAL_DM`, `EXP_DM`, `VAL_DC`, `EXP_DC`, `VAL_SA`, `EXP_SA`) em `public.tempos`.
- **`criarArtigoAction` / `importarArtigosAction` / `limparArtigosAction`**: Operações CRUD e importação massiva sobre `public.artigos`.
- **`importarStockAction` / `limparStockAction`**: Substituição e carregamento faseado de lotes na tabela `public.stock`, seguido de `revalidatePath('/stocks')` e `revalidatePath('/dashboard')`.
- **`importarFaturasAction`**: Processa faturas e movimentos logísticos com validação prévia de administrador.
- **`guardarConfiguracaoAction(chave, valor)`**: Executa `upsert({ chave, valor, updated_at }, { onConflict: 'chave' })` em `public.configuracoes`.
- **`enviarEmailTesteConfigAction` / `enviarEmailTesteTemplateAction`**: Testa o envio de emails transacionais e do template de pedidos através da API **Resend**.

