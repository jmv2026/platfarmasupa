'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/context';
import {
  UserProfile,
  Client,
  Artigo,
  Perfil,
  UserRole,
  TipoArtigo,
  TipoArmazenamento,
  TipoCliente,
  TIPO_CLIENTE_LABELS,
  ImpStk,
  Armazem,
  TIPO_ARTIGO_LABELS,
  TIPO_ARMAZENAMENTO_LABELS,
} from '@/lib/supabase/types';
import { MovimentoWithDetails } from './importacao-movimentos-tab';
import {
  criarUtilizadorAction,
  criarClienteAction,
  criarArtigoAction,
  limparArtigosAction,
  enviarEmailTesteConfigAction,
} from './actions';
import ImportacaoMovimentosTab from './importacao-movimentos-tab';
import ImportacaoArtigosCard from './importacao-artigos-card';

export interface ServerEmailConfig {
  fromEmail: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  notificationEmail: string;
  supervisaoEmail: string;
}

interface ConfiguracaoTabsProps {
  users: UserProfile[];
  clients: Client[];
  artigos: Artigo[];
  perfis: Perfil[];
  initialImpStk?: ImpStk[];
  initialMovimentos?: MovimentoWithDetails[];
  armazens?: Armazem[];
  serverEmailConfig?: ServerEmailConfig;
}

export default function ConfiguracaoTabs({
  users,
  clients,
  artigos,
  perfis,
  initialImpStk = [],
  initialMovimentos = [],
  armazens = [],
  serverEmailConfig,
}: ConfiguracaoTabsProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'utilizadores' | 'clientes' | 'artigos' | 'movimentos' | 'email'>('utilizadores');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados Formulário Utilizador
  const [userFullName, setUserFullName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('123456');
  const [userRole, setUserRole] = useState<UserRole>('user1');
  const [userEmpresa, setUserEmpresa] = useState('');
  const [userClientId, setUserClientId] = useState<string>('');
  const [userAtivo, setUserAtivo] = useState(true);

  // Estados Aba Email & Teste
  const [testEmailTarget, setTestEmailTarget] = useState('jccmmelo@gmail.com, joao.melo@sermail.pt');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    recipients?: string[];
    delivered?: string[];
    details?: string;
  } | null>(null);

  // Estados Formulário Cliente
  const [clientName, setClientName] = useState('');
  const [clientSigla, setClientSigla] = useState('');
  const [clientTipoCliente, setClientTipoCliente] = useState<TipoCliente>('SF');
  const [clientPrimavera, setClientPrimavera] = useState('');
  const [clientNif, setClientNif] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientTelefone, setClientTelefone] = useState('');
  const [clientMorada, setClientMorada] = useState('');
  const [clientCodPostal, setClientCodPostal] = useState('');
  const [clientLocalidade, setClientLocalidade] = useState('');
  const [clientAtivo, setClientAtivo] = useState(true);

  // Estados Formulário Artigo
  const [artigosList, setArtigosList] = useState<Artigo[]>(artigos);
  const [artigoCodigo, setArtigoCodigo] = useState('');
  const [artigoDescricao, setArtigoDescricao] = useState('');
  const [artigoTipo, setArtigoTipo] = useState<TipoArtigo>('MH');
  const [artigoArmazenamento, setArtigoArmazenamento] = useState<TipoArmazenamento>('TA');
  const [artigoPva, setArtigoPva] = useState('');
  const [artigoLote, setArtigoLote] = useState(true);
  const [artigoSerie, setArtigoSerie] = useState(false);
  const [artigoAtivo, setArtigoAtivo] = useState(true);
  const [confirmClearArtigosModal, setConfirmClearArtigosModal] = useState(false);
  const [clearingArtigosLoading, setClearingArtigosLoading] = useState(false);

  useEffect(() => {
    setArtigosList(artigos);
  }, [artigos]);

  // Handler: Submeter Novo Utilizador
  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await criarUtilizadorAction({
        email: userEmail,
        password: userPassword,
        full_name: userFullName,
        role: userRole,
        empresa: userEmpresa || (userRole === 'admin' || userRole === 'gestor' ? 'Sermail, Logística Integrada Lda' : 'Cliente Farma'),
        client_id: userRole.startsWith('user') ? userClientId || null : null,
        ativo: userAtivo,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `${language === 'pt' ? 'Utilizador' : language === 'es' ? 'Usuario' : 'User'} ${userEmail} ${language === 'pt' ? 'criado com sucesso!' : language === 'es' ? 'creado con éxito!' : 'created successfully!'}`,
        });
        setUserFullName('');
        setUserEmail('');
        setUserPassword('123456');
        setUserRole('user1');
        setUserEmpresa('');
        setUserClientId('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || t.common.error });
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : t.common.error });
    } finally {
      setLoading(false);
    }
  };

  // Handler: Submeter Novo Cliente
  const handleSubmitClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await criarClienteAction({
        name: clientName,
        sigla: clientSigla,
        tipo_cliente: clientTipoCliente,
        cli_primavera: clientPrimavera || undefined,
        nif: clientNif || undefined,
        email: clientEmail || undefined,
        telefone: clientTelefone || undefined,
        morada: clientMorada || undefined,
        cod_postal: clientCodPostal || undefined,
        localidade: clientLocalidade || undefined,
        ativo: clientAtivo,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `${t.common.client} [${res.client?.sigla}] ${res.client?.name} ${language === 'pt' ? 'criado com sucesso!' : language === 'es' ? 'creado con éxito!' : 'created successfully!'}`,
        });
        setClientName('');
        setClientSigla('');
        setClientTipoCliente('SF');
        setClientPrimavera('');
        setClientNif('');
        setClientEmail('');
        setClientTelefone('');
        setClientMorada('');
        setClientCodPostal('');
        setClientLocalidade('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || t.common.error });
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : t.common.error });
    } finally {
      setLoading(false);
    }
  };

  // Handler: Submeter Novo Artigo
  const handleSubmitArtigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await criarArtigoAction({
        artigo_id: artigoCodigo,
        descricao: artigoDescricao,
        tipo_artigo: artigoTipo,
        tipo_armazenamento: artigoArmazenamento,
        tratamento_lote: artigoLote,
        tratamento_serie: artigoSerie,
        pva: artigoPva ? parseFloat(artigoPva) : 0.00,
        ativo: artigoAtivo,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `${language === 'pt' ? 'Artigo' : language === 'es' ? 'Artículo' : 'Article'} [${res.artigo?.artigo_id}] ${res.artigo?.descricao} ${language === 'pt' ? 'criado com sucesso!' : language === 'es' ? 'creado con éxito!' : 'created successfully!'}`,
        });
        if (res.artigo) {
          setArtigosList((prev) => [res.artigo as Artigo, ...prev.filter((a) => a.artigo_id !== res.artigo!.artigo_id)]);
        }
        setArtigoCodigo('');
        setArtigoDescricao('');
        setArtigoTipo('MH');
        setArtigoArmazenamento('TA');
        setArtigoPva('');
        setArtigoLote(true);
        setArtigoSerie(false);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || t.common.error });
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : t.common.error });
    } finally {
      setLoading(false);
    }
  };

  // Handler: Limpar Catálogo de Artigos
  const handleClearArtigos = async () => {
    setClearingArtigosLoading(true);
    setFeedback(null);
    try {
      const res = await limparArtigosAction();
      if (res.success) {
        setArtigosList([]);
        setFeedback({
          type: 'success',
          message: language === 'pt' ? 'Catálogo de artigos limpo com sucesso.' : language === 'es' ? 'Catálogo de artículos vaciado con éxito.' : 'Article catalog cleared successfully.',
        });
        setConfirmClearArtigosModal(false);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || t.common.error });
        setConfirmClearArtigosModal(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      setFeedback({ type: 'error', message: msg });
      setConfirmClearArtigosModal(false);
    } finally {
      setClearingArtigosLoading(false);
    }
  };

  // Handler: Emitir Email de Teste para o Administrador
  const handleSendTestEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTestEmailLoading(true);
    setTestEmailFeedback(null);

    try {
      const res = await enviarEmailTesteConfigAction(testEmailTarget);
      if (res.success) {
        const dests = res.delivered && res.delivered.length > 0 ? res.delivered.join(', ') : testEmailTarget;
        setTestEmailFeedback({
          type: res.failed && res.failed.length > 0 ? 'warning' : 'success',
          message: `${language === 'pt' ? 'Email de teste processado via Resend! Entregue com sucesso a:' : language === 'es' ? '¡Email de prueba procesado via Resend! Entregado a:' : 'Test email processed via Resend! Successfully delivered to:'} ${dests}`,
          recipients: res.recipients || [testEmailTarget],
          delivered: res.delivered,
          details: res.details,
        });
      } else {
        setTestEmailFeedback({
          type: 'error',
          message: res.error || (language === 'pt' ? 'Aviso durante o envio do email de teste.' : language === 'es' ? 'Aviso durante el envío del email de prueba.' : 'Notice during test email dispatch.'),
          recipients: res.recipients,
          details: res.details || 'Verifique se a chave RESEND_API_KEY está configurada no ficheiro .env.local.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.error;
      setTestEmailFeedback({
        type: 'error',
        message: msg,
      });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const isClientRole = userRole === 'user1' || userRole === 'user2' || userRole === 'user3';

  return (
    <main className="w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Banner Topo */}
      <div className="h-[50px] bg-primary-container text-on-primary rounded-xl px-5 flex items-center shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-[50px] w-full min-w-0">
          <h1 className="text-base sm:text-lg font-bold font-headline leading-none whitespace-nowrap text-white shrink-0">
            {t.configuracao.bannerTitle}
          </h1>
          <p className="text-xs sm:text-sm text-lime-300 font-medium truncate hidden sm:block">
            {t.configuracao.bannerSubtitle}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Abas de Navegação */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-2 shadow-sm flex flex-wrap sm:flex-nowrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('utilizadores');
              setFeedback(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'utilizadores'
                ? 'bg-secondary text-on-secondary shadow-md'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
            }`}
          >
            <span className="material-symbols-outlined text-base">group</span>
            {t.configuracao.tabUsers} ({users.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('clientes');
              setFeedback(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'clientes'
                ? 'bg-secondary text-on-secondary shadow-md'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
            }`}
          >
            <span className="material-symbols-outlined text-base">corporate_fare</span>
            {t.configuracao.tabClients} ({clients.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('artigos');
              setFeedback(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'artigos'
                ? 'bg-secondary text-on-secondary shadow-md'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
            }`}
          >
            <span className="material-symbols-outlined text-base">medication</span>
            {t.configuracao.tabArticles} ({artigos.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('movimentos');
              setFeedback(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'movimentos'
                ? 'bg-secondary text-on-secondary shadow-md'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
            }`}
          >
            <span className="material-symbols-outlined text-base">sync_alt</span>
            {t.configuracao.tabMovements} ({initialMovimentos.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('email');
              setFeedback(null);
              setTestEmailFeedback(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'email'
                ? 'bg-secondary text-on-secondary shadow-md'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
            }`}
          >
            <span className="material-symbols-outlined text-base">mail</span>
            {t.configuracao.tabEmail}
          </button>
        </div>

        {/* Feedback Toast */}
        {feedback && (
          <div
            className={`p-4 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {feedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 1: UTILIZADORES */}
        {/* ========================================================================= */}
        {activeTab === 'utilizadores' && (
          <div className="space-y-8">
            {/* Formulário Novo Utilizador */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm">
              <h3 className="text-base font-bold font-headline text-on-surface mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">person_add</span>
                {t.configuracao.addUser}
              </h3>
              <p className="text-xs text-on-surface-variant mb-6">
                {language === 'pt' ? 'Registe credenciais de acesso e atribua perfis regulamentares (Admin, Gestor ou Utilizador de Cliente).' : language === 'es' ? 'Registre credenciales de acceso y asigne perfiles (Admin, Gestor o Usuario de Cliente).' : 'Register access credentials and assign roles (Admin, Manager, or Client User).'}
              </p>

              <form onSubmit={handleSubmitUser} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.userFullName} <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={userFullName}
                      onChange={(e) => setUserFullName(e.target.value)}
                      placeholder="Ex: Dr. António Silva"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.userEmail} <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="exemplo@sermail.pt"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.userPassword} <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="Mínimo 6 carateres"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.userRole} <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value as UserRole)}
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-medium"
                      required
                    >
                      <option value="admin">Administrador (Acesso Total)</option>
                      <option value="gestor">Gestor Sermail (Operações Transversais)</option>
                      <option value="user1">Utilizador Cliente Nível 1 (Gestão Avançada)</option>
                      <option value="user2">Utilizador Cliente Nível 2 (Operacional)</option>
                      <option value="user3">Utilizador Cliente Nível 3 (Apenas Leitura)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.userCompany}
                    </label>
                    <input
                      type="text"
                      value={userEmpresa}
                      onChange={(e) => setUserEmpresa(e.target.value)}
                      placeholder="Ex: Sermail, Logística Integrada Lda"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.userClientAssoc} {isClientRole && <span className="text-rose-600">*</span>}
                    </label>
                    <select
                      value={userClientId}
                      onChange={(e) => setUserClientId(e.target.value)}
                      disabled={!isClientRole}
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
                      required={isClientRole}
                    >
                      <option value="">-- {t.stocks.filterClient} --</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.sigla}] {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20">
                  <label className="flex items-center gap-2 text-xs text-on-surface font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userAtivo}
                      onChange={(e) => setUserAtivo(e.target.checked)}
                      className="rounded text-secondary focus:ring-secondary w-4 h-4"
                    />
                    <span>{t.configuracao.userActive}</span>
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-secondary text-on-secondary hover:bg-secondary/90 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    {loading ? t.common.loading : t.configuracao.addUser}
                  </button>
                </div>
              </form>
            </div>

            {/* Tabela de Utilizadores Existentes */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold font-headline text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">badge</span>
                {t.configuracao.tabUsers} ({users.length})
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">{t.configuracao.userFullName}</th>
                      <th className="py-2.5 px-3">{t.configuracao.userEmail}</th>
                      <th className="py-2.5 px-3">{t.configuracao.userRole}</th>
                      <th className="py-2.5 px-3">{t.configuracao.userCompany}</th>
                      <th className="py-2.5 px-3">{t.common.status}</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">{t.common.date}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="py-3 px-3 font-semibold">{u.full_name || 'Utilizador Farma'}</td>
                        <td className="py-3 px-3 font-mono text-on-surface-variant">{u.email}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              u.role === 'admin'
                                ? 'bg-rose-100 text-rose-800'
                                : u.role === 'gestor'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-on-surface-variant">{u.empresa || 'Sermail'}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 font-medium ${u.ativo ? 'text-emerald-700' : 'text-slate-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.ativo ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                            {u.ativo ? t.common.active : t.common.inactive}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-on-surface-variant">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString(language === 'en' ? 'en-GB' : 'pt-PT') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: CLIENTES */}
        {/* ========================================================================= */}
        {activeTab === 'clientes' && (
          <div className="space-y-8">
            {/* Formulário Novo Cliente */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm">
              <h3 className="text-base font-bold font-headline text-on-surface mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">add_business</span>
                {t.configuracao.addClient}
              </h3>
              <p className="text-xs text-on-surface-variant mb-6">
                {language === 'pt' ? 'Registe um novo cliente proprietário de stock. A sigla regulamentar deve ter no máximo 4 carateres.' : language === 'es' ? 'Registre un nuevo cliente propietario de stock. La sigla debe tener un máximo de 4 caracteres.' : 'Register a new stock-owning client. The acronym must have a maximum of 4 characters.'}
              </p>

              <form onSubmit={handleSubmitClient} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.clientName} <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Ex: Laboratórios BIAL SA"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.clientSigla} <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={clientSigla}
                      onChange={(e) => setClientSigla(e.target.value.toUpperCase())}
                      placeholder="BIAL"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-mono font-bold uppercase tracking-wider"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.clientTipoCliente} <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={clientTipoCliente}
                      onChange={(e) => setClientTipoCliente(e.target.value as TipoCliente)}
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-medium"
                    >
                      <option value="SF">{t.configuracao.tipoClienteSf}</option>
                      <option value="CF">{t.configuracao.tipoClienteCf}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.clientPrimaveraCode}
                    </label>
                    <input
                      type="text"
                      value={clientPrimavera}
                      onChange={(e) => setClientPrimavera(e.target.value)}
                      placeholder="Ex: C0001 / BIAL"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.clientNif}
                    </label>
                    <input
                      type="text"
                      value={clientNif}
                      onChange={(e) => setClientNif(e.target.value)}
                      placeholder="501234567"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.clientEmail}
                    </label>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="contacto@bial.com"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.clientPhone}
                    </label>
                    <input
                      type="text"
                      value={clientTelefone}
                      onChange={(e) => setClientTelefone(e.target.value)}
                      placeholder="+351 229866100"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.clientAddress}
                    </label>
                    <input
                      type="text"
                      value={clientMorada}
                      onChange={(e) => setClientMorada(e.target.value)}
                      placeholder="À Av. da Siderurgia Nacional"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.clientPostalCode}
                    </label>
                    <input
                      type="text"
                      value={clientCodPostal}
                      onChange={(e) => setClientCodPostal(e.target.value)}
                      placeholder="4745-457"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.clientCity}
                    </label>
                    <input
                      type="text"
                      value={clientLocalidade}
                      onChange={(e) => setClientLocalidade(e.target.value)}
                      placeholder="Coronado (S. Romão)"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20">
                  <label className="flex items-center gap-2 text-xs text-on-surface font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clientAtivo}
                      onChange={(e) => setClientAtivo(e.target.checked)}
                      className="rounded text-secondary focus:ring-secondary w-4 h-4"
                    />
                    <span>{t.configuracao.clientActive}</span>
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-secondary text-on-secondary hover:bg-secondary/90 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add_business</span>
                    {loading ? t.common.loading : t.configuracao.addClient}
                  </button>
                </div>
              </form>
            </div>

            {/* Tabela de Clientes Existentes */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold font-headline text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">corporate_fare</span>
                {t.configuracao.tabClients} ({clients.length})
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">{t.configuracao.clientSigla}</th>
                      <th className="py-2.5 px-3">{t.configuracao.clientTipoCliente}</th>
                      <th className="py-2.5 px-3">{t.configuracao.clientPrimaveraCode}</th>
                      <th className="py-2.5 px-3">{t.configuracao.clientName}</th>
                      <th className="py-2.5 px-3">{t.configuracao.clientNif}</th>
                      <th className="py-2.5 px-3">{t.configuracao.clientEmail}</th>
                      <th className="py-2.5 px-3">{t.configuracao.clientPhone}</th>
                      <th className="py-2.5 px-3">{t.configuracao.clientAddress}</th>
                      <th className="py-2.5 px-3">{t.configuracao.clientPostalCode}</th>
                      <th className="py-2.5 px-3">{t.configuracao.clientCity}</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">{t.common.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {clients.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="py-3 px-3">
                          <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                            {c.sigla}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                              c.tipo_cliente === 'CF'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-300'
                            }`}
                            title={c.tipo_cliente === 'CF' ? 'Com Faturação (CF)' : 'Sem Faturação (SF)'}
                          >
                            {c.tipo_cliente || 'SF'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-secondary">
                          {c.cli_primavera || '-'}
                        </td>
                        <td className="py-3 px-3 font-semibold">{c.name}</td>
                        <td className="py-3 px-3 font-mono text-on-surface-variant">{c.nif || '-'}</td>
                        <td className="py-3 px-3 text-on-surface-variant">{c.email || '-'}</td>
                        <td className="py-3 px-3 font-mono text-on-surface-variant">{c.telefone || '-'}</td>
                        <td className="py-3 px-3 text-on-surface-variant truncate max-w-[180px]" title={c.morada || ''}>
                          {c.morada || '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-on-surface-variant">{c.cod_postal || '-'}</td>
                        <td className="py-3 px-3 text-on-surface-variant">{c.localidade || '-'}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`inline-flex items-center gap-1 font-medium ${c.ativo ? 'text-emerald-700' : 'text-slate-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.ativo ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                            {c.ativo ? t.common.active : t.common.inactive}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 3: ARTIGOS */}
        {/* ========================================================================= */}
        {activeTab === 'artigos' && (
          <div className="space-y-8">
            {/* Formulário Novo Artigo */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm">
              <h3 className="text-base font-bold font-headline text-on-surface mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">add_circle</span>
                {t.configuracao.addArticle}
              </h3>
              <p className="text-xs text-on-surface-variant mb-6">
                {language === 'pt' ? 'Defina as características regulamentares do produto, tipo de conservação e requisitos de rastreabilidade (lote e série).' : language === 'es' ? 'Defina las características del producto, tipo de conservación y trazabilidad (lote y serie).' : 'Define product regulatory characteristics, storage condition, and traceability (batch and serial).'}
              </p>

              <form onSubmit={handleSubmitArtigo} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.articleCode} <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={artigoCodigo}
                      onChange={(e) => setArtigoCodigo(e.target.value.toUpperCase())}
                      placeholder="Ex: BL-001"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-mono font-bold uppercase"
                      required
                    />
                  </div>

                  <div className="lg:col-span-3">
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.articleDesc} <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={artigoDescricao}
                      onChange={(e) => setArtigoDescricao(e.target.value)}
                      placeholder="Ex: Zebinix 800mg Comprimidos Revestidos"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
                      required
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.articleType} <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={artigoTipo}
                      onChange={(e) => setArtigoTipo(e.target.value as TipoArtigo)}
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-medium"
                      required
                    >
                      <option value="MH">[MH] Medicamento de uso humano</option>
                      <option value="MV">[MV] Medicamento de uso veterinário</option>
                      <option value="DM">[DM] Dispositivo médico</option>
                      <option value="DC">[DC] Dermo-Cosmético</option>
                      <option value="SC">[SC] Substância controlada</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.articleStorage} <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={artigoArmazenamento}
                      onChange={(e) => setArtigoArmazenamento(e.target.value as TipoArmazenamento)}
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-medium"
                      required
                    >
                      <option value="TA">[TA] Temperatura Ambiente</option>
                      <option value="TC">[TC] Temperatura controlada (15-25 ºC)</option>
                      <option value="TF">[TF] Temperatura controlada frio (2-8 ºC)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      {t.configuracao.articlePva}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={artigoPva}
                      onChange={(e) => setArtigoPva(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs text-on-surface font-medium cursor-pointer p-3 bg-surface-container/40 rounded-lg border border-outline-variant/20">
                    <input
                      type="checkbox"
                      checked={artigoLote}
                      onChange={(e) => setArtigoLote(e.target.checked)}
                      className="rounded text-secondary focus:ring-secondary w-4 h-4"
                    />
                    <span>{t.stocks.colBatch} ({t.stocks.detailsTitle})</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-on-surface font-medium cursor-pointer p-3 bg-surface-container/40 rounded-lg border border-outline-variant/20">
                    <input
                      type="checkbox"
                      checked={artigoSerie}
                      onChange={(e) => setArtigoSerie(e.target.checked)}
                      className="rounded text-secondary focus:ring-secondary w-4 h-4"
                    />
                    <span>Série</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-on-surface font-medium cursor-pointer p-3 bg-surface-container/40 rounded-lg border border-outline-variant/20">
                    <input
                      type="checkbox"
                      checked={artigoAtivo}
                      onChange={(e) => setArtigoAtivo(e.target.checked)}
                      className="rounded text-secondary focus:ring-secondary w-4 h-4"
                    />
                    <span>{t.configuracao.articleActive}</span>
                  </label>
                </div>

                <div className="flex justify-end pt-3 border-t border-outline-variant/20">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-secondary text-on-secondary hover:bg-secondary/90 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    {loading ? t.common.loading : t.configuracao.addArticle}
                  </button>
                </div>
              </form>
            </div>

            {/* Janela de Importação em Lote de Artigos (TXT / XLSX) */}
            <ImportacaoArtigosCard
              onSuccess={(importedArtigos) => {
                if (importedArtigos && importedArtigos.length > 0) {
                  setArtigosList((prev) => {
                    const map = new Map<string, Artigo>();
                    prev.forEach((a) => map.set(a.artigo_id, a));
                    importedArtigos.forEach((a: Artigo) => map.set(a.artigo_id, a));
                    return Array.from(map.values()).sort((a, b) => a.artigo_id.localeCompare(b.artigo_id));
                  });
                }
                router.refresh();
              }}
            />

            {/* Tabela de Artigos Existentes */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h3 className="text-base font-bold font-headline text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">medication</span>
                  {t.configuracao.tabArticles} ({artigosList.length})
                </h3>
                {artigosList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearArtigosModal(true)}
                    disabled={clearingArtigosLoading}
                    className="shrink-0 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Limpar todos os artigos"
                  >
                    <span className="material-symbols-outlined text-sm">delete_sweep</span>
                    {t.common.delete}
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">{t.configuracao.articleCode}</th>
                      <th className="py-2.5 px-3">{t.configuracao.articleDesc}</th>
                      <th className="py-2.5 px-3">{t.configuracao.articleType}</th>
                      <th className="py-2.5 px-3">{t.configuracao.articleStorage}</th>
                      <th className="py-2.5 px-3 text-right">{t.configuracao.articlePva}</th>
                      <th className="py-2.5 px-3 text-center">{t.stocks.colBatch}</th>
                      <th className="py-2.5 px-3 text-center">Série</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">{t.common.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                    {artigosList.length > 0 ? (
                      artigosList.map((a) => (
                        <tr key={a.artigo_id} className="hover:bg-surface-container/30 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-secondary">{a.artigo_id}</td>
                          <td className="py-3 px-3 font-medium">{a.descricao}</td>
                          <td className="py-3 px-3">
                            <span className="text-[11px] text-on-surface-variant">
                              {TIPO_ARTIGO_LABELS[a.tipo_artigo] || a.tipo_artigo}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                a.tipo_armazenamento === 'TF'
                                  ? 'bg-cyan-100 text-cyan-800'
                                  : a.tipo_armazenamento === 'TC'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">
                                {a.tipo_armazenamento === 'TF' ? 'ac_unit' : 'thermostat'}
                              </span>
                              {TIPO_ARMAZENAMENTO_LABELS[a.tipo_armazenamento] || a.tipo_armazenamento}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-on-surface">
                            {typeof a.pva === 'number' && a.pva > 0
                              ? `${a.pva.toFixed(2)} €`
                              : <span className="text-on-surface-variant/50">-</span>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`material-symbols-outlined text-sm ${a.tratamento_lote ? 'text-emerald-600' : 'text-slate-300'}`}>
                              {a.tratamento_lote ? 'check_circle' : 'cancel'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`material-symbols-outlined text-sm ${a.tratamento_serie ? 'text-emerald-600' : 'text-slate-300'}`}>
                              {a.tratamento_serie ? 'check_circle' : 'cancel'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className={`inline-flex items-center gap-1 font-medium ${a.ativo ? 'text-emerald-700' : 'text-slate-500'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${a.ativo ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                              {a.ativo ? t.common.active : t.common.inactive}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-4xl text-outline-variant mb-2 block">
                            medication
                          </span>
                          <p className="text-xs font-semibold">{t.common.noRecords}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal de Confirmação para Limpar Artigos */}
            {confirmClearArtigosModal && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">warning</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-on-surface">{t.common.delete} {t.configuracao.tabArticles}?</h4>
                      <p className="text-xs text-on-surface-variant mt-0.5">{language === 'pt' ? 'Esta ação não pode ser revertida.' : language === 'es' ? 'Esta acción no se puede revertir.' : 'This action cannot be undone.'}</p>
                    </div>
                  </div>

                  <p className="text-xs text-on-surface leading-relaxed">
                    {language === 'pt' ? 'Tem a certeza de que deseja eliminar permanentemente todos os artigos do catálogo?' : language === 'es' ? '¿Está seguro de que desea eliminar permanentemente todos los artículos?' : 'Are you sure you want to permanently delete all articles from catalog?'}
                  </p>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setConfirmClearArtigosModal(false)}
                      className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60 rounded-xl transition-all cursor-pointer"
                    >
                      {t.common.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearArtigos}
                      disabled={clearingArtigosLoading}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">delete_forever</span>
                      {clearingArtigosLoading ? t.common.loading : t.common.confirm}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 4: MOVIMENTOS (IMPORTAÇÃO E GESTÃO) */}
        {/* ========================================================================= */}
        {activeTab === 'movimentos' && (
          <ImportacaoMovimentosTab
            initialImpStk={initialImpStk}
            initialMovimentos={initialMovimentos}
            clients={clients}
            artigos={artigos}
            armazens={armazens}
            onRefresh={() => router.refresh()}
          />
        )}

        {/* ========================================================================= */}
        {/* ABA 5: EMAIL & RESEND */}
        {/* ========================================================================= */}
        {activeTab === 'email' && (
          <div className="space-y-8">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/20 pb-6">
                <div>
                  <h3 className="text-base font-bold font-headline text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">mark_email_read</span>
                    {t.configuracao.serverEmail}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {language === 'pt' ? 'Valide a ligação com o motor Resend e emita emails de teste com a estrutura oficial da Plataforma Farma.' : language === 'es' ? 'Valide la conexión con el motor Resend y emita emails de prueba.' : 'Validate the Resend connection and send test emails with official Plataforma Farma layout.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Motor Resend Ativo • platfarma.sermaildev.cloud
                  </span>
                </div>
              </div>

              {/* Secção de Disparo de Teste */}
              <div className="bg-gradient-to-br from-secondary/5 via-primary/5 to-surface-container/50 border border-secondary/20 rounded-2xl p-6 sm:p-7 space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/10 border border-secondary/30 flex items-center justify-center text-secondary flex-shrink-0">
                    <span className="material-symbols-outlined text-2xl">send</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-on-surface">
                      {t.configuracao.testEmail}
                    </h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {language === 'pt' ? 'O teste envia um email com template regulamentar de diagnóstico a partir de noreplay@platfarma.sermaildev.cloud.' : language === 'es' ? 'La prueba envía un email de diagnóstico a partir de noreplay@platfarma.sermaildev.cloud.' : 'The test sends a diagnostic email template from noreplay@platfarma.sermaildev.cloud.'}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSendTestEmail} className="space-y-4 pt-2">
                  <div className="max-w-md">
                    <label className="block text-xs font-semibold text-on-surface mb-1.5">
                      {t.configuracao.testEmail}:
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-base">
                        alternate_email
                      </span>
                      <input
                        type="text"
                        value={testEmailTarget}
                        onChange={(e) => setTestEmailTarget(e.target.value)}
                        placeholder="jccmmelo@gmail.com, joao.melo@sermail.pt"
                        required
                        className="w-full pl-9 pr-3 py-2 text-xs bg-surface-container-lowest border border-outline-variant/50 rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/40 font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={testEmailLoading}
                      className="flex items-center gap-2 px-6 py-2.5 bg-secondary text-on-secondary rounded-xl text-xs font-bold shadow-md hover:bg-secondary/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testEmailLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-on-secondary border-t-transparent rounded-full animate-spin"></span>
                          {t.configuracao.testEmailSending}
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">forward_to_inbox</span>
                          {t.configuracao.testEmailSend}
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Feedback do Teste */}
                {testEmailFeedback && (
                  <div
                    className={`p-4 rounded-xl text-xs font-medium space-y-1.5 transition-all ${
                      testEmailFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : testEmailFeedback.type === 'warning'
                        ? 'bg-amber-50 text-amber-900 border border-amber-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">
                        {testEmailFeedback.type === 'success'
                          ? 'verified'
                          : testEmailFeedback.type === 'warning'
                          ? 'warning'
                          : 'error'}
                      </span>
                      <strong className="text-xs">{testEmailFeedback.message}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Parâmetros em vigor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-surface-container/40 border border-outline-variant/30 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-on-surface uppercase tracking-wider">
                    <span className="material-symbols-outlined text-secondary text-sm">settings_suggest</span>
                    Regras de Notificação de Pedidos
                  </div>
                  <ul className="text-xs text-on-surface-variant space-y-2 list-disc list-inside">
                    <li>
                      Disparo automático após criação com sucesso do cabeçalho, linhas e débito <strong>SS</strong>.
                    </li>
                    <li>
                      Envio simultâneo para o <strong>utilizador requerente</strong>, notificação de sistema (<strong>{serverEmailConfig?.notificationEmail || 'jccmmelo@gmail.com'}</strong>) e supervisão (<strong>{serverEmailConfig?.supervisaoEmail || 'joao.melo@sermail.pt'}</strong>).
                    </li>
                    <li>
                      Remetente oficial: <strong>{serverEmailConfig?.fromEmail || 'Plataforma Farma <noreplay@platfarma.sermaildev.cloud>'}</strong>.
                    </li>
                  </ul>
                </div>

                <div className="bg-surface-container/40 border border-outline-variant/30 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-on-surface uppercase tracking-wider">
                      <span className="material-symbols-outlined text-secondary text-sm">tune</span>
                      Parametrização do Servidor (.env.local)
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Ativo & Conectado
                    </span>
                  </div>
                  <div className="text-[11px] font-mono bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-3 text-on-surface space-y-1.5">
                    <div className="flex justify-between items-center py-0.5 border-b border-outline-variant/20">
                      <span className="text-on-surface-variant">API_KEY:</span>
                      <span className="text-emerald-700 font-semibold">{serverEmailConfig?.apiKeyMasked || 're_QtC9ht7m...uHxZ'}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 border-b border-outline-variant/20">
                      <span className="text-on-surface-variant">FROM_EMAIL:</span>
                      <span className="text-secondary font-semibold">{serverEmailConfig?.fromEmail || 'Plataforma Farma <noreplay@platfarma.sermaildev.cloud>'}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 border-b border-outline-variant/20">
                      <span className="text-on-surface-variant">NOTIFICATION:</span>
                      <span className="text-on-surface font-semibold">{serverEmailConfig?.notificationEmail || 'jccmmelo@gmail.com'}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 border-b border-outline-variant/20">
                      <span className="text-on-surface-variant">SUPERVISÃO:</span>
                      <span className="text-on-surface font-semibold">{serverEmailConfig?.supervisaoEmail || 'joao.melo@sermail.pt'}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-on-surface-variant">DOMÍNIO:</span>
                      <span className="text-emerald-600 font-bold">platfarma.sermaildev.cloud</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
