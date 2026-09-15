import { PedidoComLinhas, STATUS_PEDIDO_LABELS, StatusPedido } from '@/lib/supabase/types';

interface PedidosListaProps {
  pedidos: PedidoComLinhas[];
}

export default function PedidosLista({ pedidos }: PedidosListaProps) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-outline-variant/20 gap-2">
        <div>
          <h2 className="text-xl font-bold font-headline text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">receipt_long</span>
            Histórico de Pedidos de Entrega
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Consulta de ordens de entrega geradas, dados de destino e lotes debitados.
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-secondary-container text-on-secondary-container">
          {pedidos.length} {pedidos.length === 1 ? 'Pedido Registado' : 'Pedidos Registados'}
        </span>
      </div>

      {pedidos.length > 0 ? (
        <div className="space-y-4">
          {pedidos.map((ped) => {
            const totalQtd = ped.pedido_linhas?.reduce((acc, l) => acc + Number(l.quantidade || 0), 0) || 0;
            return (
              <div
                key={ped.id}
                className="border border-outline-variant/30 rounded-xl p-5 bg-surface hover:bg-surface-container/20 transition-all space-y-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="inline-block px-2.5 py-1 bg-secondary text-on-secondary rounded-lg font-mono font-bold text-xs shadow-sm">
                      {ped.nr_pedido}
                    </span>
                    <span className="font-semibold text-sm text-on-surface">
                      {ped.nome_destinatario}
                    </span>
                    {ped.clients?.sigla && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary-container text-on-secondary-container">
                        {ped.clients.sigla}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      {STATUS_PEDIDO_LABELS[ped.status as StatusPedido] || ped.status}
                    </span>
                    <span className="text-xs text-on-surface-variant font-mono">
                      {new Date(ped.data_pedido).toLocaleDateString('pt-PT')}
                    </span>
                  </div>
                </div>

                {/* Destino & Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-surface-container/40 p-3.5 rounded-lg border border-outline-variant/20">
                  <div>
                    <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">Morada de Entrega</span>
                    <span className="text-on-surface font-medium">{ped.morada}, {ped.codigo_postal} {ped.localidade} ({ped.pais})</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">Ref. Documento</span>
                    <span className="text-on-surface font-mono font-medium">{ped.ref_documento || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block text-[10px] uppercase font-semibold">Data Prevista Entrega</span>
                    <span className="text-on-surface font-mono font-medium">
                      {ped.data_entrega ? new Date(ped.data_entrega).toLocaleDateString('pt-PT') : 'Imediata'}
                    </span>
                  </div>
                </div>

                {/* Linhas do Pedido */}
                {ped.pedido_linhas && ped.pedido_linhas.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold bg-surface-container/60">
                        <tr>
                          <th className="py-2 px-3 rounded-l-md">Código Artigo</th>
                          <th className="py-2 px-3">Descrição</th>
                          <th className="py-2 px-3">Lote</th>
                          <th className="py-2 px-3">Validade</th>
                          <th className="py-2 px-3 text-right rounded-r-md">Qtd Debitada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                        {ped.pedido_linhas.map((linha, lIdx) => (
                          <tr key={lIdx} className="hover:bg-surface-container/20">
                            <td className="py-2 px-3 font-mono font-medium">{linha.artigo_codigo}</td>
                            <td className="py-2 px-3 font-medium">{linha.descricao}</td>
                            <td className="py-2 px-3 font-mono font-semibold text-secondary">{linha.lote}</td>
                            <td className="py-2 px-3 font-mono text-on-surface-variant">
                              {linha.validade ? new Date(linha.validade).toLocaleDateString('pt-PT') : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">
                              -{Number(linha.quantidade).toLocaleString('pt-PT')} <span className="text-[10px] font-normal text-on-surface-variant">un</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-on-surface-variant pt-2 border-t border-outline-variant/10">
                  <span>{ped.observacoes ? `Nota: ${ped.observacoes}` : 'Sem observações adicionais'}</span>
                  <span className="font-semibold text-on-surface">
                    Total do Pedido: <strong className="text-secondary font-mono text-sm">{totalQtd.toLocaleString('pt-PT')} un</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-on-surface-variant border border-dashed border-outline-variant/40 rounded-xl">
          <span className="material-symbols-outlined text-4xl text-outline mb-2">shopping_bag</span>
          <p className="text-sm font-medium">Ainda não existem pedidos de entrega registados.</p>
          <p className="text-xs text-on-surface-variant/70 mt-1">
            Preencha o formulário acima para criar o seu primeiro pedido e debitar stock via FEFO.
          </p>
        </div>
      )}
    </div>
  );
}
