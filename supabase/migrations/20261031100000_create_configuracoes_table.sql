-- =====================================================================================
-- MIGRAÇÃO: Criar tabela configuracoes para parâmetros gerais da plataforma
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.configuracoes (
    chave text PRIMARY KEY,
    valor text,
    descricao text,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "configuracoes_select_policy" ON public.configuracoes;
CREATE POLICY "configuracoes_select_policy" ON public.configuracoes
    FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "configuracoes_all_admin_gestor_policy" ON public.configuracoes;
CREATE POLICY "configuracoes_all_admin_gestor_policy" ON public.configuracoes
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
              AND (users.role IN ('admin', 'gestor') OR users.email = 'admin@sermail.pt')
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
              AND (users.role IN ('admin', 'gestor') OR users.email = 'admin@sermail.pt')
        )
    );

INSERT INTO public.configuracoes (chave, valor, descricao)
VALUES (
    'email_template_pedidos_destinatarios',
    'jccmmelo@gmail.com, joao.melo@sermail.pt',
    'Lista de endereços de email (separados por vírgula) para envio do ficheiro Excel gerado a partir do template de pedidos.'
)
ON CONFLICT (chave) DO NOTHING;

GRANT ALL ON public.configuracoes TO authenticated, service_role;
GRANT SELECT ON public.configuracoes TO anon;

