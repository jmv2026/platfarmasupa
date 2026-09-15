'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserProfile,
  Client,
  Artigo,
  Perfil,
  UserRole,
  TipoArtigo,
  TipoArmazenamento,
  TIPO_ARTIGO_LABELS,
  TIPO_ARMAZENAMENTO_LABELS,
} from '@/lib/supabase/types';
import { criarUtilizadorAction, criarClienteAction, criarArtigoAction } from './actions';

interface ConfiguracaoTabsProps {
  users: UserProfile[];
  clients: Client[];
  artigos: Artigo[];
  perfis: Perfil[];
}

export default function ConfiguracaoTabs({ users, clients, artigos, perfis }: ConfiguracaoTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'utilizadores' | 'clientes' | 'artigos'>('utilizadores');
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

  // Estados Formulário Cliente
  const [clientName, setClientName] = useState('');
  const [clientSigla, setClientSigla] = useState('');
  const [clientNif, setClientNif] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientTelefone, setClientTelefone] = useState('');
  const [clientMorada, setClientMorada] = useState('');
  const [clientAtivo, setClientAtivo] = useState(true);

  // Estados Formulário Artigo
  const [artigoCodigo, setArtigoCodigo] = useState('');
  const [artigoDescricao, setArtigoDescricao] = useState('');
  const [artigoTipo, setArtigoTipo] = useState<TipoArtigo>('MH');
  const [artigoArmazenamento, setArtigoArmazenamento] = useState<TipoArmazenamento>('TA');
  const [artigoLote, setArtigoLote] = useState(true);
  const [artigoSerie, setArtigoSerie] = useState(false);
  const [artigoAtivo, setArtigoAtivo] = useState(true);

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
        setFeedback({ type: 'success', message: `Utilizador ${userEmail} criado com sucesso!` });
        setUserFullName('');
        setUserEmail('');
        setUserPassword('123456');
        setUserRole('user1');
        setUserEmpresa('');
        setUserClientId('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao criar utilizador.' });
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Erro inesperado' });
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
        nif: clientNif || undefined,
        email: clientEmail || undefined,
        telefone: clientTelefone || undefined,
        morada: clientMorada || undefined,
        ativo: clientAtivo,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: `Cliente [${res.client?.sigla}] ${res.client?.name} criado com sucesso!` });
        setClientName('');
        setClientSigla('');
        setClientNif('');
        setClientEmail('');
        setClientTelefone('');
        setClientMorada('');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao criar cliente.' });
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Erro inesperado' });
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
        ativo: artigoAtivo,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: `Artigo [${res.artigo?.artigo_id}] ${res.artigo?.descricao} criado com sucesso!` });
        setArtigoCodigo('');
        setArtigoDescricao('');
        setArtigoTipo('MH');
        setArtigoArmazenamento('TA');
        setArtigoLote(true);
        setArtigoSerie(false);
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao criar artigo.' });
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Erro inesperado' });
    } finally {
      setLoading(false);
    }
  };

  const isClientRole = userRole === 'user1' || userRole === 'user2' || userRole === 'user3';

  return (
    <div className="space-y-6">
      {/* Abas de Navegação */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-2 shadow-sm flex items-center gap-2">
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
          Gestão de Utilizadores ({users.length})
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
          Gestão de Clientes ({clients.length})
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
          Catálogo de Artigos ({artigos.length})
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
              Criar Novo Utilizador
            </h3>
            <p className="text-xs text-on-surface-variant mb-6">
              Registe credenciais de acesso e atribua perfis regulamentares (Admin, Gestor ou Utilizador de Cliente).
            </p>

            <form onSubmit={handleSubmitUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Nome Completo <span className="text-rose-600">*</span>
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
                    Email de Acesso <span className="text-rose-600">*</span>
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
                    Password Inicial <span className="text-rose-600">*</span>
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
                    Perfil / Função <span className="text-rose-600">*</span>
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
                    Empresa / Entidade
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
                    Cliente Vinculado {isClientRole && <span className="text-rose-600">*</span>}
                  </label>
                  <select
                    value={userClientId}
                    onChange={(e) => setUserClientId(e.target.value)}
                    disabled={!isClientRole}
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
                    required={isClientRole}
                  >
                    <option value="">-- Selecione o Cliente --</option>
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
                  <span>Utilizador Ativo</span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-secondary text-on-secondary hover:bg-secondary/90 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  {loading ? 'A criar utilizador...' : 'Criar Utilizador'}
                </button>
              </div>
            </form>
          </div>

          {/* Tabela de Utilizadores Existentes */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold font-headline text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">badge</span>
              Utilizadores Registados no Sistema ({users.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 rounded-l-lg">Nome</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Perfil / Função</th>
                    <th className="py-2.5 px-3">Empresa</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3 text-right rounded-r-lg">Data Criação</th>
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
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-on-surface-variant">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('pt-PT') : '-'}
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
              Criar Novo Cliente / Laboratório
            </h3>
            <p className="text-xs text-on-surface-variant mb-6">
              Registe um novo cliente proprietário de stock. A <strong>sigla regulamentar</strong> deve ter no máximo 4 carateres.
            </p>

            <form onSubmit={handleSubmitClient} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Nome / Razão Social do Cliente <span className="text-rose-600">*</span>
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
                    Sigla Regulamentar (≤ 4 carateres) <span className="text-rose-600">*</span>
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
                  <p className="text-[10px] text-on-surface-variant mt-0.5">Usada na composição dos armazéns (ex: BIAL-01).</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    NIF / Número Fiscal
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
                    Email de Contacto
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
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={clientTelefone}
                    onChange={(e) => setClientTelefone(e.target.value)}
                    placeholder="+351 229866100"
                    className="w-full bg-surface-container border border-outline-variant/40 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Morada Completa / Sede
                  </label>
                  <input
                    type="text"
                    value={clientMorada}
                    onChange={(e) => setClientMorada(e.target.value)}
                    placeholder="À Av. da Siderurgia Nacional, 4745-457 Coronado (S. Romão e S. Mamede)"
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
                  <span>Cliente Ativo</span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-secondary text-on-secondary hover:bg-secondary/90 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">add_business</span>
                  {loading ? 'A criar cliente...' : 'Criar Cliente'}
                </button>
              </div>
            </form>
          </div>

          {/* Tabela de Clientes Existentes */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold font-headline text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">corporate_fare</span>
              Clientes Farmacêuticos Cadastrados ({clients.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 rounded-l-lg">Sigla</th>
                    <th className="py-2.5 px-3">Nome / Razão Social</th>
                    <th className="py-2.5 px-3">NIF</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Telefone</th>
                    <th className="py-2.5 px-3">Morada</th>
                    <th className="py-2.5 px-3 text-right rounded-r-lg">Estado</th>
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
                      <td className="py-3 px-3 font-semibold">{c.name}</td>
                      <td className="py-3 px-3 font-mono text-on-surface-variant">{c.nif || '-'}</td>
                      <td className="py-3 px-3 text-on-surface-variant">{c.email || '-'}</td>
                      <td className="py-3 px-3 font-mono text-on-surface-variant">{c.telefone || '-'}</td>
                      <td className="py-3 px-3 text-on-surface-variant truncate max-w-[200px]" title={c.morada || ''}>
                        {c.morada || '-'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`inline-flex items-center gap-1 font-medium ${c.ativo ? 'text-emerald-700' : 'text-slate-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.ativo ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {c.ativo ? 'Ativo' : 'Inativo'}
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
              Cadastrar Novo Artigo / Medicamento
            </h3>
            <p className="text-xs text-on-surface-variant mb-6">
              Defina as características regulamentares do produto, tipo de conservação e requisitos de rastreabilidade (lote e série).
            </p>

            <form onSubmit={handleSubmitArtigo} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Código do Artigo <span className="text-rose-600">*</span>
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
                    Descrição Comercial / Substância <span className="text-rose-600">*</span>
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
                    Tipo Regulamentar de Artigo <span className="text-rose-600">*</span>
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

                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Condição de Armazenamento / Frio <span className="text-rose-600">*</span>
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs text-on-surface font-medium cursor-pointer p-3 bg-surface-container/40 rounded-lg border border-outline-variant/20">
                  <input
                    type="checkbox"
                    checked={artigoLote}
                    onChange={(e) => setArtigoLote(e.target.checked)}
                    className="rounded text-secondary focus:ring-secondary w-4 h-4"
                  />
                  <span>Controlo e Rastreabilidade de Lote</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-on-surface font-medium cursor-pointer p-3 bg-surface-container/40 rounded-lg border border-outline-variant/20">
                  <input
                    type="checkbox"
                    checked={artigoSerie}
                    onChange={(e) => setArtigoSerie(e.target.checked)}
                    className="rounded text-secondary focus:ring-secondary w-4 h-4"
                  />
                  <span>Controlo de Número de Série Unitário</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-on-surface font-medium cursor-pointer p-3 bg-surface-container/40 rounded-lg border border-outline-variant/20">
                  <input
                    type="checkbox"
                    checked={artigoAtivo}
                    onChange={(e) => setArtigoAtivo(e.target.checked)}
                    className="rounded text-secondary focus:ring-secondary w-4 h-4"
                  />
                  <span>Artigo Ativo no Catálogo</span>
                </label>
              </div>

              <div className="flex justify-end pt-3 border-t border-outline-variant/20">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-secondary text-on-secondary hover:bg-secondary/90 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  {loading ? 'A cadastrar artigo...' : 'Cadastrar Artigo'}
                </button>
              </div>
            </form>
          </div>

          {/* Tabela de Artigos Existentes */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold font-headline text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">medication</span>
              Catálogo de Artigos Farmacêuticos ({artigos.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container/60 text-on-surface-variant font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 rounded-l-lg">Código</th>
                    <th className="py-2.5 px-3">Descrição Comercial</th>
                    <th className="py-2.5 px-3">Tipo Artigo</th>
                    <th className="py-2.5 px-3">Conservação</th>
                    <th className="py-2.5 px-3 text-center">Lote</th>
                    <th className="py-2.5 px-3 text-center">Série</th>
                    <th className="py-2.5 px-3 text-right rounded-r-lg">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                  {artigos.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-container/30 transition-colors">
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
                          {a.ativo ? 'Ativo' : 'Inativo'}
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
    </div>
  );
}
