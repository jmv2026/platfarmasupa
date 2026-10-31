import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppHeader from '@/components/navigation/app-header';
import ConfiguracaoTabs from './configuracao-tabs';
import { UserProfile, Client, Artigo, Armazem, Tempo } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

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

  // Carregar dados de Utilizadores, Clientes, Artigos, Armazéns, Tempos, Tracking e Configurações em paralelo
  const [
    { data: usersList },
    { data: clientsList },
    { data: artigosList },
    { data: armazensList },
    { data: temposList },
    { data: trackingListRaw },
    { data: configuracoesList },
  ] = await Promise.all([
    supabase.from('users').select('*').order('created_at', { ascending: false }),
    supabase.from('clientes').select('*').order('name'),
    supabase.from('artigos').select('*').order('artigo_id'),
    supabase.from('armazens').select('*').order('tipo_armazem'),
    supabase.from('tempos').select('*').order('sigla'),
    supabase
      .from('VW_torrestir_last')
      .select('id, ref_ser, ref_comprovativo, data_estado, hora_estado, ref_trans, cod_estado, cod_incide, data_reg_incide, hora_reg_incide, desc_estado_expedicao, obs_expedicao, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase.from('configuracoes').select('*'),
  ]);

  const trackingList = trackingListRaw || [];

  const templateConfigRow = configuracoesList?.find(
    (c: any) => c.chave === 'email_template_pedidos_destinatarios'
  );
  const templateEmailRecipients = templateConfigRow?.valor || 'jccmmelo@gmail.com, joao.melo@sermail.pt';

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
        armazens={(armazensList as Armazem[]) || []}
        tempos={(temposList as Tempo[]) || []}
        trackingData={(trackingList as any[]) || []}
        serverEmailConfig={serverEmailConfig}
        templateEmailRecipients={templateEmailRecipients}
      />
    </div>
  );
}

