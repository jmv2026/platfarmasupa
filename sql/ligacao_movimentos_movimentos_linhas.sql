-- =========================================================================================
-- Script SQL: Ligação 1 para Muitos (1:N) entre movimentos (Cabeçalho) e movimentos_linhas (Linhas)
-- Campo de ligação: documento_ref
-- =========================================================================================
--
-- NOTA TÉCNICA (PostgreSQL):
-- Para estabelecer uma Foreign Key de movimentos_linhas para movimentos através de documento_ref,
-- a coluna documento_ref na tabela 'movimentos' TEM OBRIGATORIAMENTE de ter uma restrição UNIQUE.
--
-- Como a tabela 'movimentos' atualmente tem 1.836 registos para 321 documentos distintos (duplicados
-- porque cada linha de artigo foi guardada em 'movimentos'), este script está estruturado em 4 passos:
--
-- PASSO 1: Diagnóstico e Validação prévia dos dados
-- PASSO 2: (Opcional se ainda não tiver linhas) Migrar as linhas atuais para movimentos_linhas
-- PASSO 3: Consolidar movimentos como cabeçalho único (1 registo por documento_ref)
-- PASSO 4: Criar a restrição UNIQUE e a Foreign Key 1:N com índice de performance
-- =========================================================================================

--------------------------------------------------------------------------------------------
-- PASSO 1: DIAGNÓSTICO (Executar para verificar o estado atual)
--------------------------------------------------------------------------------------------
-- 1.1 Contagem geral em movimentos
SELECT 
    COUNT(*) AS total_registos_movimentos,
    COUNT(DISTINCT documento_ref) AS documentos_unicos,
    COUNT(*) - COUNT(DISTINCT documento_ref) AS linhas_duplicadas
FROM public.movimentos;

-- 1.2 Exemplo de documentos com múltiplas linhas
SELECT 
    documento_ref, 
    COUNT(*) AS qtd_linhas, 
    STRING_AGG(artigo_cli, ', ' ORDER BY num_linha) AS artigos_amostra
FROM public.movimentos
GROUP BY documento_ref
HAVING COUNT(*) > 1
ORDER BY qtd_linhas DESC
LIMIT 10;

-- 1.3 Verificar se existem valores nulos em documento_ref
SELECT COUNT(*) AS total_sem_documento_ref
FROM public.movimentos
WHERE documento_ref IS NULL OR TRIM(documento_ref) = '';


--------------------------------------------------------------------------------------------
-- PASSO 2: COPIAR LINHAS EXISTENTES PARA 'movimentos_linhas' (Se pretender preservar o detalhe)
--------------------------------------------------------------------------------------------
-- Este bloco copia todos os 1.836 registos de movimentos para movimentos_linhas caso esta esteja vazia.
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM public.movimentos_linhas) = 0 THEN
        INSERT INTO public.movimentos_linhas (
            id,
            cliente_id,
            artigo_cli,
            sigla,
            tipo_movimento,
            quantidade,
            tipo_armazem,
            armazem_loc,
            posicao,
            lote,
            nr_serie,
            validade,
            data_fabrico,
            data_movimento,
            documento_ref,
            doc_linha,
            ref_ser,
            observacoes,
            created_by,
            created_at,
            updated_at,
            valor_unitario,
            valor_adicional,
            valor_abater,
            estado_stock,
            familia,
            sub_familia,
            tipo_artigo,
            num_linha,
            artigo_id
        )
        SELECT 
            m.id,
            m.cliente_id,
            m.artigo_cli,
            m.sigla,
            m.tipo_movimento,
            m.quantidade,
            m.tipo_armazem,
            m.armazem_loc,
            m.posicao,
            m.lote,
            m.nr_serie,
            m.validade,
            m.data_fabrico,
            m.data_movimento,
            m.documento_ref,
            m.doc_linha,
            m.ref_ser,
            m.observacoes,
            m.created_by,
            m.created_at,
            m.updated_at,
            COALESCE(m.valor_unitario, 0),
            COALESCE(m.valor_adicional, 0),
            COALESCE(m.valor_abater, 0),
            m.estado_stock,
            m.familia,
            m.sub_familia,
            m.tipo_artigo,
            m.num_linha,
            COALESCE(m.artigo_cli, 'DESCONHECIDO') AS artigo_id
        FROM public.movimentos m;
        
        RAISE NOTICE 'Linhas migradas com sucesso para movimentos_linhas!';
    ELSE
        RAISE NOTICE 'movimentos_linhas já contém registos. Nenhuma cópia foi realizada.';
    END IF;
END $$;


--------------------------------------------------------------------------------------------
-- PASSO 3: CONSOLIDAR A TABELA 'movimentos' COMO CABEÇALHO ÚNICO
--------------------------------------------------------------------------------------------
-- ATENÇÃO: Executar apenas após assegurar que os detalhes das linhas estão em 'movimentos_linhas'.
-- Remove os registos duplicados de 'movimentos', mantendo apenas 1 registo (cabeçalho) por documento_ref.
--
-- BEGIN;
-- DELETE FROM public.movimentos
-- WHERE id NOT IN (
--     SELECT DISTINCT ON (documento_ref) id
--     FROM public.movimentos
--     ORDER BY documento_ref, created_at ASC, id ASC
-- );
-- COMMIT;


--------------------------------------------------------------------------------------------
-- PASSO 4: CRIAR RESTRIÇÃO UNIQUE, FOREIGN KEY (1:N) E ÍNDICE DE PERFORMANCE
--------------------------------------------------------------------------------------------
-- 4.1 Adicionar restrição UNIQUE a documento_ref em 'movimentos'
-- (Necessário para que o Postgres permita ser referenciado por Foreign Key)
ALTER TABLE public.movimentos 
    ADD CONSTRAINT movimentos_documento_ref_key UNIQUE (documento_ref);

-- 4.2 Criar a Foreign Key em 'movimentos_linhas' apontando para 'movimentos'
-- Regra ON DELETE CASCADE: se um cabeçalho for apagado, as respetivas linhas são removidas.
-- (Pode mudar para RESTRICT se preferir bloquear a remoção de cabeçalhos que tenham linhas).
ALTER TABLE public.movimentos_linhas
    DROP CONSTRAINT IF EXISTS fk_movimentos_linhas_documento_ref;

ALTER TABLE public.movimentos_linhas
    ADD CONSTRAINT fk_movimentos_linhas_documento_ref 
    FOREIGN KEY (documento_ref) 
    REFERENCES public.movimentos (documento_ref)
    ON UPDATE CASCADE
    ON DELETE CASCADE;

-- 4.3 Criar índice na coluna documento_ref de movimentos_linhas
-- (Boa prática Supabase/PostgreSQL: índices em FK evitam Sequential Scans em JOINs e DELETEs)
CREATE INDEX IF NOT EXISTS idx_movimentos_linhas_documento_ref 
    ON public.movimentos_linhas USING btree (documento_ref);


--------------------------------------------------------------------------------------------
-- PASSO 5: VERIFICAÇÃO DA LIGAÇÃO CRIADA
--------------------------------------------------------------------------------------------
SELECT 
    tc.table_name AS tabela_filha,
    kcu.column_name AS coluna_filha,
    ccu.table_name AS tabela_pai,
    ccu.column_name AS coluna_pai,
    tc.constraint_name AS nome_restricao,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'movimentos_linhas'
  AND kcu.column_name = 'documento_ref';
