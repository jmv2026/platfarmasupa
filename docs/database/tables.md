# Catálogo de Tabelas — Base de Dados Supabase (`public`)

Este documento descreve todas as tabelas do esquema `public` da aplicação **PlatFarmaSupa**, incluindo colunas principais, tipos de dados, chaves primárias/estrangeiras e propósito funcional.

---

## 1. `public.users`
Perfis e permissões RBAC dos utilizadores sincronizados com `auth.users`.

| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY`, FK `auth.users(id)` | Identificador único do utilizador |
| `email` | `text` | `NOT NULL`, `UNIQUE` | Endereço de email |
| `name` | `text` | | Nome de apresentação do utilizador |
| `role` | `text` | `CHECK (admin, gestor, user1, user2)` | Perfil de acesso RBAC |
| `cliente_id` | `uuid` | FK `public.clientes(id)` | Cliente associado (obrigatório para `user1`/`user2`) |
| `ativo` | `boolean` | `DEFAULT true` | Estado da conta |
| `idioma` | `varchar(5)` | `DEFAULT 'pt'` | Idioma preferido (`pt`, `en`, `es`) |
| `created_at` | `timestamptz` | `DEFAULT now()` | Data de criação |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Data de última atualização |

---

## 2. `public.clientes`
Entidades/Laboratórios clientes da plataforma logística.

| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Identificador único do cliente |
| `sigla` | `varchar(4)` | `NOT NULL`, `UNIQUE` | Sigla identificadora (ex.: `CRD`, `BAYR`, `DDD`) |
| `name` | `text` | `NOT NULL` | Nome completo do laboratório/cliente |
| `nif` | `text` | | Número de Identificação Fiscal |
| `tipo_cliente` | `text` | `CHECK ('CF', 'SF')` | Com Faturação (`CF`) ou Sem Faturação (`SF`) |
| `ativo` | `boolean` | `DEFAULT true` | Indica se o cliente está ativo |
| `created_at` | `timestamptz` | `DEFAULT now()` | Data de registo |

---

## 3. `public.artigos`
Catálogo mestre de artigos farmacêuticos e logísticos por cliente.

| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `artigo_id` | `text` | `NOT NULL` | Código do artigo no cliente |
| `artigo_cli` | `text` | `PRIMARY KEY` / `UNIQUE` | Chave composta normalizada (`SIGLA-ARTIGO_ID`) |
| `cli_primavera` | `text` | | Código equivalente no ERP Primavera |
| `cliente_id` | `uuid` | `NOT NULL`, FK `public.clientes(id)` | Cliente proprietário do artigo |
| `descricao` | `text` | `NOT NULL` | Designação comercial do artigo |
| `tipo_artigo` | `integer` | FK `public.tipos_artigo(id)` | Tipo de artigo (`1`=MH, `2`=MV, `3`=DM, `4`=COSM, `5`=SUP, `6`=OUT, `7`=PM) |
| `tipo_armazenamento` | `text` | | Condição térmica (`ambiente`, `frio`, `congelado`, etc.) |
| `ativo` | `boolean` | `DEFAULT true` | Estado do artigo |

---

## 4. `public.stock`
Snapshot de stock importado do sistema externo/Access (utilizado como linha de base quando não existem movimentos diretos para o artigo).

| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Identificador do registo |
| `entidade_id` | `uuid` | FK `public.clientes(id)` | Cliente proprietário |
| `entidade_sigla` | `varchar` | | Sigla do cliente |
| `artigo_id` | `text` | `NOT NULL` | Código do artigo |
| `artigo_cli` | `text` | `NOT NULL` | Código composto cliente-artigo |
| `descricao` | `text` | | Descrição do artigo |
| `lote` | `text` | | Lote farmacêutico |
| `validade` | `date` | | Data de expiração do lote |
| `localizacao` | `text` | | Localização de armazém |
| `quantidade` | `numeric` | `NOT NULL DEFAULT 0` | Quantidade disponível |
| `updated_at` | `timestamptz` | `DEFAULT now()` | Data de sincronização |

---

## 5. `public.movimentos` & `public.movimentos_linhas`
Cabeçalhos e linhas de movimentos logísticos de entrada (`ES`), saída (`SS`) e transferência (`ET`, `ST`).

### `public.movimentos` (Cabeçalho)
| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `documento_ref` | `text` | `PRIMARY KEY` | Referência única do documento |
| `cliente_id` | `uuid` | `NOT NULL`, FK `public.clientes(id)` | Cliente associado |
| `sigla` | `varchar` | | Sigla do cliente |
| `tipo_doc` | `text` | | Tipo de documento |
| `requisicao` | `text` | | Referência/requisição externa |
| `entidade` | `text` | | Código de entidade destinatária |
| `nome` | `text` | | Nome do destinatário |
| `morada`, `cod_postal`, `cod_postal_localidade` | `text` | | Dados postais de entrega |
| `data_movimento` | `timestamptz` | `DEFAULT now()` | Data do documento |

### `public.movimentos_linhas` (Detalhe por Lote/Artigo)
| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `documento_ref` | `text` | `PRIMARY KEY (composta)`, FK `public.movimentos` | Referência do documento pai |
| `doc_linha` | `text` | `PRIMARY KEY (composta)` | Número da linha no documento |
| `artigo_cli` | `text` | `NOT NULL`, FK `public.artigos(artigo_cli)` | Código do artigo |
| `tipo_movimento` | `text` | `CHECK ('es', 'ss', 'et', 'st')` | Tipo de movimento |
| `quantidade` | `numeric` | `CHECK (quantidade <> 0)` | Quantidade movimentada |
| `lote` | `text` | | Lote movimentado |
| `validade` | `date` | | Validade do lote |
| `armazem_loc` | `text` | | Localização de armazém |
| `ref_ser` | `text` | | Referência interna Sermail / Tracking |

---

## 6. `public.pedidos` & `public.pedido_linhas`
Pedidos de expedição submetidos na plataforma.

### `public.pedidos`
| Coluna | Tipo | Restrições / Default | Descrição |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Identificador único do pedido |
| `nr_pedido` | `text` | `NOT NULL`, `UNIQUE` | Número sequencial do pedido |
| `sigla_pedido` | `text` | | Código composto (`SIGLA-NR_PEDIDO`) gerado por trigger |
| `cliente_id` | `uuid` | `NOT NULL`, FK `public.clientes(id)` | Cliente proprietário |
| `destino_id` | `uuid` | FK `public.destinos(id)` | Destino selecionado |
| `classifica_destino` | `text` | `DEFAULT 'Farmácia'` | Classificação do destinatário |
| `nome_destinatario`, `morada`, `codigo_postal`, `localidade`, `pais` | `text` | | Morada completa de entrega |
| `status` | `text` | `DEFAULT 'pendente'` | Estado (`pendente`, `em_preparacao`, `concluido`, `cancelado`, etc.) |
| `stock` | `boolean` | `DEFAULT true NOT NULL` | Define se o pedido é contabilizado/abatido em stock |
| `processar` | `boolean` | `DEFAULT false` | Marcado para processamento em lote |
| `processado` | `boolean` | `DEFAULT false` | Indica se já foi exportado/processado (oculta do histórico de movimentos) |
| `datetime_proc` | `timestamptz` | | Data/hora de processamento |
| `data_pedido` | `date` | `DEFAULT CURRENT_DATE` | Data do pedido |
| `data_entrega` | `date` | | Data prevista de entrega |

### `public.pedido_linhas`
| Coluna | Tipo | Restrições | Descrição |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Identificador da linha |
| `pedido_id` | `uuid` | `NOT NULL`, FK `public.pedidos(id) ON DELETE CASCADE` | Pedido pai |
| `artigo_id` | `text` | `NOT NULL` | Código do artigo |
| `artigo_cli` | `text` | FK `public.artigos(artigo_cli)` | Código composto (`SIGLA-ARTIGO_ID`) |
| `descricao` | `text` | | Descrição do artigo |
| `lote` | `text` | | Lote reservado |
| `validade` | `date` | | Data de validade do lote |
| `quantidade` | `numeric` | `NOT NULL CHECK (quantidade > 0)` | Quantidade pedida |

---

## 7. Outras Tabelas de Suporte
- **`public.destinos`**: Diretório de moradas de entrega habituais por cliente (`codigo`, `nome`, `classifica_destino`, `morada`, `codigo_postal`, `localidade`, `pais`, `ativo`).
- **`public.faturas`**: Registos de faturação e notas de crédito importados do ERP para alimentar o gráfico de Faturação Mensal (`vw_fact_mes`).
- **`public.plat_movimentos`**: Tabela de *staging* para importação de movimentos CSV/ERP antes da transferência para `movimentos` e `movimentos_linhas`.
- **`public.torrestir_status`**: Registos de tracking de transporte importados da Torrestir (`ref_ser`, `ref_comprovativo`, `desc_estado_expedicao`, `url_comprovativo`).
- **`public.tempos`**: Parametrização de tempos de aviso/bloqueio de validades por cliente (`id_cliente`, `sigla`, `aviso`, `bloqueio`).
- **`public.armazens`**: Catálogo de tipos de armazém (`tipo_armazem`, `descricao`).
- **`public.configuracoes`**: Parâmetros globais da aplicação (`chave`, `valor`, `descricao`), como destinatários de email do template de pedidos.
- **`public.log`**: Registo de auditoria de acessos (`LOGIN`, `LOGOUT`) e operações críticas.

