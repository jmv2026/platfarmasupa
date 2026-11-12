import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/supabase/session';
import { fetchAllRowsFast } from '@/lib/supabase/pagination';
import AppHeader from '@/components/navigation/app-header';
import HistoricoPedidosView from './historico-pedidos-view';
import { Client, PedidoComLinhas, UserProfile } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export default async function HistoricoPedidosPage() {
  const { supabase, user, profile, isManagerOrAdmin, userClientId } = await getAuthContext();

  if (!user) {
    redirect('/login');
  }

  let clientsQuery = supabase.from('clientes').select('*').eq('ativo', true).order('name');
  let pedidosQuery = supabase
    .from('pedidos')
    .select('*, clientes(id, name, sigla), destinos(id, codigo, nome), pedido_linhas(*)')
    .order('created_at', { ascending: false });

  if (!isManagerOrAdmin && userClientId) {
    clientsQuery = clientsQuery.eq('id', userClientId);
    pedidosQuery = pedidosQuery.eq('cliente_id', userClientId);
  }

  // Buscar clientes, pedidos, artigos, status de expedição, movimentos e faturas tudo em paralelo simultâneo
  const [
    { data: clients },
    { data: pedidos },
    artigosList,
    torrestirStatus,
    cfMovimentos,
    faturasList,
  ] = await Promise.all([
    clientsQuery,
    pedidosQuery,
    fetchAllRowsFast<any>((from, to, countMode) => {
      return supabase
        .from('artigos')
        .select('artigo_id, artigo_cli, descricao', countMode ? { count: countMode } : undefined)
        .range(from, to);
    }, 2000),
    fetchAllRowsFast<any>((from, to, countMode) => {
      return supabase
        .from('VW_torrestir_last')
        .select('ref_ser, desc_estado_expedicao, url_comprovativo', countMode ? { count: countMode } : undefined)
        .range(from, to);
    }, 2000),
    fetchAllRowsFast<any>((from, to, countMode) => {
      let q = supabase
        .from('movimentos_linhas')
        .select(
          'documento_ref, ref_ser, data_movimento, created_at, artigo_id, artigo, artigo_cli, descricao, quantidade, tipo_movimento, armazem_loc, lote, validade, movimentos!inner(cliente_id, nome, morada, cod_postal, cod_postal_localidade, requisicao)',
          countMode ? { count: countMode } : undefined
        );
      if (!isManagerOrAdmin && userClientId) {
        q = q.eq('movimentos.cliente_id', userClientId);
      }
      return q.order('data_movimento', { ascending: false }).range(from, to);
    }, 2000),
    fetchAllRowsFast<any>((from, to, countMode) => {
      return supabase
        .from('faturas')
        .select(
          'documento_ref, data, entidade, tipo_doc, num_doc, documento, requisicao, num_contribuinte, total_iva, total_merc, total_outros, total_desc, nome, morada, localidade, cod_postal, cod_postal_localidade, pais, nome_entrega, morada_entrega, cod_postal_localidade_entrega, cod_postal_entrega, localidade_entrega, entidade_entrega, cli_primavera, sigla, cliente_ser',
          countMode ? { count: countMode } : undefined
        )
        .order('data', { ascending: false })
        .range(from, to);
    }, 2000),
  ]);

  const clientsMap = new Map<string, any>((clients || []).map((c: any) => [c.id, c]));

  // Indexar descrição e artigo_id por artigo_id e artigo_cli
  const artigoDescByIdMap = new Map<string, string>();
  const artigoDescByCliMap = new Map<string, string>();
  const artigoIdByCliMap = new Map<string, string>();
  if (artigosList) {
    for (const art of artigosList) {
      const desc = (art.descricao || '').toString().trim();
      const artIdStr = art.artigo_id !== null && art.artigo_id !== undefined ? String(art.artigo_id).trim() : '';
      const artCliKey = art.artigo_cli ? String(art.artigo_cli).trim().toLowerCase() : '';
      if (artIdStr && desc) {
        artigoDescByIdMap.set(artIdStr, desc);
      }
      if (artCliKey && desc) {
        artigoDescByCliMap.set(artCliKey, desc);
      }
      if (artCliKey && artIdStr) {
        artigoIdByCliMap.set(artCliKey, artIdStr);
      }
    }
  }

  const resolveArtigoId = (item: { artigo_id?: any; artigo?: any; artigo_cli?: any; artigo_codigo?: any }) => {
    const idKey = item.artigo_id !== null && item.artigo_id !== undefined
      ? String(item.artigo_id).trim()
      : (item.artigo !== null && item.artigo !== undefined ? String(item.artigo).trim() : '');
    if (idKey) return idKey;
    const cliKey = String(item.artigo_cli || item.artigo_codigo || '').trim().toLowerCase();
    if (cliKey && artigoIdByCliMap.has(cliKey)) {
      return artigoIdByCliMap.get(cliKey)!;
    }
    return item.artigo_cli || item.artigo_codigo || '';
  };

  const resolveArtigoDescricao = (item: { artigo_id?: any; artigo?: any; artigo_cli?: any; artigo_codigo?: any; descricao?: any }) => {
    const idKey = item.artigo_id !== null && item.artigo_id !== undefined
      ? String(item.artigo_id).trim()
      : (item.artigo !== null && item.artigo !== undefined ? String(item.artigo).trim() : '');
    if (idKey && artigoDescByIdMap.has(idKey)) {
      return artigoDescByIdMap.get(idKey)!;
    }
    const cliKey = String(item.artigo_cli || item.artigo_codigo || '').trim().toLowerCase();
    if (cliKey && artigoDescByCliMap.has(cliKey)) {
      return artigoDescByCliMap.get(cliKey)!;
    }
    const ownDesc = (item.descricao || '').toString().trim();
    if (ownDesc && ownDesc.toLowerCase() !== cliKey) {
      return ownDesc;
    }
    return ownDesc || item.artigo_cli || item.artigo_codigo || '';
  };

  // Indexar status da Torrestir por ref normalizada para lookup O(1)
  const statusMap = new Map<string, any>();
  if (torrestirStatus) {
    for (const st of torrestirStatus) {
      if (st.ref_ser) {
        const rawRef = st.ref_ser.toString().trim();
        const numRef = rawRef.replace(/^0+/, '');
        if (!statusMap.has(rawRef)) statusMap.set(rawRef, st);
        if (!statusMap.has(numRef)) statusMap.set(numRef, st);
      }
    }
  }

  // REGRA DE NEGÓCIO: Os pedidos cujo campo processado esteja selecionado não deverão ser apresentados no histórico de movimentos
  const processedOrderRefs = new Set<string>();
  (pedidos || []).forEach((p: any) => {
    if (p.processado) {
      if (p.id) processedOrderRefs.add(String(p.id).trim().toLowerCase());
      if (p.nr_pedido) processedOrderRefs.add(String(p.nr_pedido).trim().toLowerCase());
      if (p.sigla_pedido) processedOrderRefs.add(String(p.sigla_pedido).trim().toLowerCase());
      if (p.doc_primavera) processedOrderRefs.add(String(p.doc_primavera).trim().toLowerCase());
      const sigla = p.clientes?.sigla || clientsMap.get(p.cliente_id)?.sigla;
      if (sigla && p.nr_pedido) {
        processedOrderRefs.add(`${sigla}-${p.nr_pedido}`.trim().toLowerCase());
      }
    }
  });

  // Filtrar pedidos da tabela pedidos: excluir os que estão marcados como processados
  const pedidosNaoProcessados = (pedidos || [])
    .filter((p: any) => !p.processado)
    .map((p: any) => ({
      ...p,
      pedido_linhas: (p.pedido_linhas || []).map((linha: any) => ({
        ...linha,
        artigo_id: resolveArtigoId(linha),
        descricao: resolveArtigoDescricao(linha),
      })),
    }));

  // Agrupar linhas de movimentos em pedidos virtuais em O(N) com Map
  const pseudoPedidosList: any[] = [];
  if (cfMovimentos && cfMovimentos.length > 0) {
    const grouped = new Map<string, any>();

    for (let i = 0; i < cfMovimentos.length; i++) {
      const mov = cfMovimentos[i];
      const docRef = mov.documento_ref || `SEM_REF_${mov.created_at}`;
      const currentMovClientId = mov.movimentos?.cliente_id || mov.cliente_id;
      const movTipo = (mov.tipo_movimento || '').toUpperCase();
      const key = `${currentMovClientId}_${docRef}_${movTipo}`;

      let p = grouped.get(key);
      if (!p) {
        const clientObj = clientsMap.get(currentMovClientId);
        p = {
          id: key,
          nr_pedido: docRef,
          cliente_id: currentMovClientId,
          data_pedido: mov.data_movimento || mov.created_at,
          created_at: mov.created_at,
          status: movTipo === 'ES' ? 'rececionado' : 
                  (movTipo === 'ST' || movTipo === 'ET') ? 'transfer' : 'em_preparacao',
          tipo_movimento: movTipo,
          ref_ser: mov.ref_ser,
          clientes: clientObj,
          clients: clientObj,
          destinos: { nome: mov.movimentos?.nome || mov.nome },
          morada: mov.movimentos?.morada || mov.morada,
          codigo_postal: mov.movimentos?.cod_postal || mov.cod_postal,
          cod_postal: mov.movimentos?.cod_postal || mov.cod_postal,
          cod_postal_localidade: mov.movimentos?.cod_postal_localidade || mov.cod_postal_localidade,
          localidade: mov.movimentos?.cod_postal_localidade || mov.cod_postal_localidade || mov.localidade,
          requisicao: mov.movimentos?.requisicao || mov.requisicao,
          pedido_linhas: []
        };
        grouped.set(key, p);
      }

      p.pedido_linhas.push({
        id: `${key}_${mov.artigo_cli}_${p.pedido_linhas.length}`,
        artigo_id: resolveArtigoId(mov),
        artigo_cli: mov.artigo_cli,
        artigo_codigo: mov.artigo_cli,
        descricao: resolveArtigoDescricao(mov),
        quantidade: mov.quantidade || 0,
        lote: mov.lote || '',
        validade: mov.validade || null
      });
    }

    for (const p of grouped.values()) {
      const nrClean = (p.nr_pedido || '').toString().trim().toLowerCase();
      // Não incluir se o movimento corresponder a um pedido marcado como processado
      if (!processedOrderRefs.has(nrClean)) {
        pseudoPedidosList.push(p);
      }
    }
  }

  // Juntar pedidos reais (não processados) e pseudoPedidos (não processados)
  const allPedidos = [...pedidosNaoProcessados, ...pseudoPedidosList];

  // Aplicar status torrestir e padronização num único ciclo otimizado
  const finalPedidos = allPedidos.map((p: any) => {
    let refStr = (p.ref_ser || p.nr_pedido || p.requisicao || p.ref_documento || '').toString().trim();
    if (refStr.includes(' ')) {
      refStr = refStr.substring(refStr.indexOf(' ') + 1).trim();
    }
    refStr = refStr.replace(/^0+/, '');
    
    const matchedStatus = refStr ? statusMap.get(refStr) : undefined;
    let status = p.status;
    let url_comprovativo = p.url_comprovativo;

    if (matchedStatus) {
      status = matchedStatus.desc_estado_expedicao || status;
      url_comprovativo = matchedStatus.url_comprovativo;
    }

    const tm = (p.tipo_movimento || '').toUpperCase();
    if (tm === 'ES') {
      status = 'rececionado';
    } else if (tm === 'ST' || tm === 'ET') {
      status = 'transfer';
    }

    const clientObj = p.clientes || p.clients || clientsMap.get(p.cliente_id);

    return {
      ...p,
      status,
      url_comprovativo,
      clients: clientObj,
      clientes: clientObj,
      _sortTs: Date.parse(p.created_at || p.data_pedido) || 0,
    };
  });

  // Ordenar por data decrescente usando o timestamp pré-calculado em O(1)
  finalPedidos.sort((a: any, b: any) => b._sortTs - a._sortTs);

  // Mapear faturas com o respetivo cliente (apenas clientes CF)
  const clientsArray = (clients || []) as any[];
  const finalFaturas = (faturasList || [])
    .map((f: any) => {
      const fSigla = (f.sigla || '').toString().trim().toUpperCase();
      const fCliPrim = (f.cli_primavera || '').toString().trim();
      const fCliSer = (f.cliente_ser || '').toString().trim().toUpperCase();
      const docPrefix = f.documento_ref ? String(f.documento_ref).split('-')[0].trim().toUpperCase() : '';

      const matchedClient = clientsArray.find((c) => {
        const cSigla = (c.sigla || '').toString().trim().toUpperCase();
        const cCliPrim = (c.cli_primavera || '').toString().trim();
        const cName = (c.name || '').toString().trim().toUpperCase();
        return (
          (cCliPrim && fCliPrim && cCliPrim === fCliPrim) ||
          (cSigla && fSigla && cSigla === fSigla) ||
          (cSigla && fCliSer && cSigla === fCliSer) ||
          (cName && fCliSer && cName === fCliSer) ||
          (cSigla && docPrefix && cSigla === docPrefix)
        );
      });

      return {
        ...f,
        cliente_id: matchedClient?.id || null,
        cliente_sigla: matchedClient?.sigla || f.sigla || docPrefix || '',
        cliente_nome: matchedClient?.name || f.cliente_ser || '',
      };
    })
    .filter((f: any) => {
      if (!isManagerOrAdmin && userClientId) {
        return f.cliente_id === userClientId;
      }
      return true;
    });

  return (
    <div className="min-h-screen bg-background text-on-background pb-12">
      {/* Header com Navegação e Seletor de Idioma */}
      <AppHeader
        userProfile={profile}
        userEmail={user.email}
        activeTab="historico-pedidos"
      />

      {/* Main Content */}
      <HistoricoPedidosView
        pedidos={finalPedidos as PedidoComLinhas[]}
        faturas={finalFaturas}
        clients={(clients as Client[]) || []}
        currentUserProfile={(profile as UserProfile) || null}
      />
    </div>
  );
}

