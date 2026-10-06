-- Adiciona o campo artigo_cli na tabela artigos
ALTER TABLE public.artigos ADD COLUMN IF NOT EXISTS artigo_cli TEXT UNIQUE;

-- Comentário para documentar o campo
COMMENT ON COLUMN public.artigos.artigo_cli IS 'Associa o artigo id importado à sigla do cliente (ex: CF-ART001)';