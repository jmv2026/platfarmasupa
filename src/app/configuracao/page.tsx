import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/app-header';
import ConfiguracaoTabs from './configuracao-tabs';
import { UserProfile, Client, Artigo, Perfil, ImpStk, Armazem, Tempo } from '@/lib/supabase/types';
import { MovimentoWithDetails } from './importacao-movimentos-tab';

export default async function ConfiguracaoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Obter perfil do utilizador para controlo de acesso
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  // CONTROLO DE ACESSO RBAC: Apenas perfil 'admin' ou conta admin@sermail.pt pode aceder à página de configuração
  if (profile?.role !== 'admin' && user.email !== 'admin@sermail.pt') {
    redirect('/dashboard?error=unauthorized');
  }

  // Carregar dados de Utilizadores, Clientes, Artigos, Perfis, Movimentos, Armazéns, Importações, Tempos e Tracking em paralelo
  const [
    { data: usersList },
    { data: clientsList },
    { data: artigosList },
    { data: perfisList },
    { data: impStkList },
    { data: movimentosList },
    { data: armazensList },
    { data: temposList },
    { data: trackingListRaw },
  ] = await Promise.all([
    supabase.from('users').select('*').order('created_at', { ascending: false }),
    supabase.from('clientes').select('*').order('name'),
    supabase.from('artigos').select('*').order('artigo_id'),
    supabase.from('perfis').select('*').order('codigo'),
    supabase.from('imp_stk').select('*').order('created_at', { ascending: false }).limit(200),
    supabase
      .from('vw_movimentos_detalhe')
      .select('*')
      .order('data_movimento', { ascending: false })
      .limit(10000),
    supabase.from('armazens').select('*').order('tipo_armazem'),
    supabase.from('tempos').select('*').order('sigla'),
    supabase
      .from('VW_torrestir_last')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  const trackingList = trackingListRaw || [];

  const formattedMovimentos: MovimentoWithDetails[] = (movimentosList || []).map((m: any) => ({
    ...m,
    id: m.id || m.doc_linha,
    cliente_nome: m.cliente_nome || m.sigla,
    cliente_sigla: m.sigla || m.cliente_sigla,
    artigo_descricao: m.artigo_descricao || m.artigo_cli,
  }));

  // Dados de Parametrização do Servidor de Email (.env.local)
  const resendApiKey = process.env.RESEND_API_KEY;
  const isKeyConfigured = !!(resendApiKey && !resendApiKey.startsWith('re_123456789') && resendApiKey !== 'YOUR_RESEND_API_KEY');
  const serverEmailConfig = {
    fromEmail: process.env.RESEND_FROM_EMAIL || 'Plataforma Farma <noreplay@platfarma.sermaildev.cloud>',
    apiKeyConfigured: isKeyConfigured,
    apiKeyMasked: isKeyConfigured
      ? `${resendApiKey!.substring(0, 8)}...${resendApiKey!.slice(-4)}`
      : 'Não configurada (Simulação)',
    notificationEmail: process.env.RESEND_NOTIFICATION_EMAIL || 'jccmmelo@gmail.com',
    supervisaoEmail: 'joao.melo@sermail.pt',
  };

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      {/* Header com Navegação e Seletor de Idioma */}
      <AppHeader
        userProfile={profile}
        userEmail={user.email}
        activeTab="configuracao"
      />

      {/* Abas e Conteúdo de Configuração */}
      <ConfiguracaoTabs
        users={(usersList as UserProfile[]) || []}
        clients={(clientsList as Client[]) || []}
        artigos={(artigosList as Artigo[]) || []}
        perfis={(perfisList as Perfil[]) || []}
        initialImpStk={(impStkList as ImpStk[]) || []}
        initialMovimentos={formattedMovimentos}
        armazens={(armazensList as Armazem[]) || []}
        tempos={(temposList as Tempo[]) || []}
        trackingData={(trackingList as any[]) || []}
        serverEmailConfig={serverEmailConfig}
      />
    </div>
  );
}

