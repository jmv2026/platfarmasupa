import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/supabase/session';
import { fetchAllRowsFast } from '@/lib/supabase/pagination';
import AppHeader from '@/components/navigation/app-header';
import DashboardView from './dashboard-view';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export default async function DashboardPage() {
  const { supabase, user, profile, isManagerOrAdmin, userClientId } = await getAuthContext();

  if (!user) {
    redirect('/login');
  }

  let clientsQuery = supabase.from('clientes').select('*').eq('ativo', true).order('name');
  let stockAtualQuery = supabase.from('vw_stock_atual').select('artigo_id, artigo_cli, descricao, validade, stock, cliente_id, tipo_artigo');
  let faturacaoQuery = supabase
    .from('vw_fact_mes')
    .select('sigla_cliente, cliente_id, data, total_docs, total_quantidade, total_merc, total_iva, total_desc, total_liquido');

  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
    stockAtualQuery = stockAtualQuery.eq('cliente_id', userClientId);
    faturacaoQuery = faturacaoQuery.eq('cliente_id', userClientId);
  }

  // Buscar todas as saídas de forma paralela (sem bloquear sequencialmente)
  const fetchSaidas = () =>
    fetchAllRowsFast<any>((from, to, countMode) => {
      let q = supabase
        .from('vw_movimentos_detalhe')
        .select(
          'id, cliente_id, sigla, artigo_cli, artigo_id, descricao, quantidade, valor_unitario, valor_adicional, valor_abater, tipo_doc, data, data_movimento, created_at, documento_ref',
          countMode ? { count: countMode } : undefined
        )
        .ilike('tipo_movimento', 'ss')
        .range(from, to);
      if (!isManagerOrAdmin && userClientId) {
        q = q.eq('cliente_id', userClientId);
      }
      return q;
    }, 2000);

  // Buscar pedidos de forma paralela
  const fetchPedidos = () =>
    fetchAllRowsFast<any>((from, to, countMode) => {
      let q = supabase
        .from('vw_pedidos')
        .select(
          'id, documento_ref, cliente_id, data_pedido, created_at, total_linhas, total_quantidade, sigla, nome, entidade, tipo_doc',
          countMode ? { count: countMode } : undefined
        )
        .range(from, to);
      if (!isManagerOrAdmin && userClientId) {
        q = q.eq('cliente_id', userClientId);
      }
      return q;
    }, 2000);

  // Buscar entradas de stock (ES) de forma paralela
  const fetchEntradasES = () =>
    fetchAllRowsFast<any>((from, to, countMode) => {
      let q = supabase
        .from('movimentos')
        .select(
          'documento_ref, cliente_id, sigla, cliente_ser, data_movimento, data, created_at, tipo_movimento, tipomovimento',
          countMode ? { count: countMode } : undefined
        )
        .or('tipo_movimento.ilike.ES,tipomovimento.ilike.ES')
        .range(from, to);
      if (!isManagerOrAdmin && userClientId) {
        q = q.eq('cliente_id', userClientId);
      }
      return q;
    }, 2000);

  // Buscar todos os dados em paralelo
  const [
    { data: clients },
    { data: stockAtual },
    pedidosRaw,
    { data: faturacao, error: faturacaoError },
    saidasRaw,
    entradasRaw,
  ] = await Promise.all([
    clientsQuery,
    stockAtualQuery,
    fetchPedidos(),
    faturacaoQuery,
    fetchSaidas(),
    fetchEntradasES(),
  ]);

  if (faturacaoError) {
    console.warn('Erro ao consultar vw_fact_mes no Dashboard:', faturacaoError.message);
  }

  let finalFaturacao = faturacao || [];

  // Se por alguma razão o filtro explícito por cliente_id retornar vazio para utilizador comum,
  // consulta diretamente vw_fact_mes (a RLS na base de dados já isola com segurança para o cliente autenticado)
  if (finalFaturacao.length === 0 && !isManagerOrAdmin) {
    const { data: directFact } = await supabase
      .from('vw_fact_mes')
      .select('sigla_cliente, cliente_id, data, total_docs, total_quantidade, total_merc, total_iva, total_desc, total_liquido');
    if (directFact && directFact.length > 0) {
      finalFaturacao = directFact;
    }
  }

  // Fallback resiliente caso vw_fact_mes retorne vazio ou falhe por permissões/filtro:
  // agrega diretamente da tabela faturas para os clientes CF ativos
  if (finalFaturacao.length === 0 && clients && clients.length > 0) {
    const cfClients = clients.filter((c: any) => c.tipo_cliente === 'CF');
    if (cfClients.length > 0) {
      const faturasRaw = await fetchAllRowsFast<any>((from, to, countMode) => {
        return supabase
          .from('faturas')
          .select(
            'data, tipo_doc, documento, documento_ref, sigla, cli_primavera, cliente_ser, total_merc, total_iva, total_desc',
            countMode ? { count: countMode } : undefined
          )
          .range(from, to);
      }, 2000);

      if (faturasRaw && faturasRaw.length > 0) {
        const monthlyMap = new Map<string, any>();
        const allowedTipos = new Set(['FA', 'NCE', 'ND', 'NC']);

        for (const f of faturasRaw) {
          const tipoDoc = String(f.tipo_doc || (f.documento ? String(f.documento).split(' ')[0] : '')).trim().toUpperCase();
          if (tipoDoc && !allowedTipos.has(tipoDoc)) continue;

          const fSigla = String(f.sigla || '').trim().toUpperCase();
          const fCliPrim = String(f.cli_primavera || '').trim();
          const fCliSer = String(f.cliente_ser || '').trim().toUpperCase();
          const docPrefix = f.documento_ref ? String(f.documento_ref).split('-')[0].trim().toUpperCase() : '';

          const matchedClient = cfClients.find((c: any) => {
            const cSigla = String(c.sigla || '').trim().toUpperCase();
            const cCliPrim = String(c.cli_primavera || '').trim();
            const cName = String(c.name || '').trim().toUpperCase();
            return (
              (cCliPrim && fCliPrim && cCliPrim === fCliPrim) ||
              (cSigla && fSigla && cSigla === fSigla) ||
              (cSigla && fCliSer && cSigla === fCliSer) ||
              (cName && fCliSer && cName === fCliSer) ||
              (cSigla && docPrefix && cSigla === docPrefix)
            );
          });

          if (!matchedClient) continue;

          const rawDate = f.data ? String(f.data).trim() : new Date().toISOString().split('T')[0];
          const monthKey = rawDate.slice(0, 7); // YYYY-MM
          if (!monthKey || monthKey.length < 7) continue;

          const groupKey = `${matchedClient.id}_${monthKey}`;
          const merc = Number(f.total_merc) || 0;
          const iva = Number(f.total_iva) || 0;
          const desc = Number(f.total_desc) || 0;
          const liq = merc - iva - desc;

          const existing = monthlyMap.get(groupKey);
          if (existing) {
            existing.total_docs += 1;
            existing.total_merc += merc;
            existing.total_iva += iva;
            existing.total_desc += desc;
            existing.total_liquido += liq;
          } else {
            monthlyMap.set(groupKey, {
              sigla_cliente: matchedClient.sigla || fSigla || docPrefix || '',
              cliente_id: matchedClient.id,
              data: `${monthKey}-01`,
              total_docs: 1,
              total_quantidade: 0,
              total_merc: merc,
              total_iva: iva,
              total_desc: desc,
              total_liquido: liq,
            });
          }
        }

        finalFaturacao = Array.from(monthlyMap.values());
      }
    }
  }

  const finalPedidos = pedidosRaw || [];
  const finalSaidas = saidasRaw || [];
  const finalEntradas = entradasRaw || [];

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      {/* Header com Navegação e Seletor de Idioma */}
      <AppHeader
        userProfile={profile}
        userEmail={user.email}
        activeTab="dashboard"
      />

      {/* Main View com Filtros Adaptativos */}
      <DashboardView
        clients={clients || []}
        stockAtual={stockAtual || []}
        pedidos={finalPedidos}
        saidas={finalSaidas}
        entradas={finalEntradas}
        faturacao={finalFaturacao}
        currentUserProfile={profile}
        isManagerOrAdmin={isManagerOrAdmin}
      />
    </div>
  );
}

