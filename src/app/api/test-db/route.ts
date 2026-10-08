import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, pedido_linhas(id, artigo_id, artigo_codigo, descricao, artigos(descricao, tipos_artigo(tipo_desc)))')
    .limit(5);

  const { data: mData, error: mError } = await supabase
    .from('movimentos')
    .select('artigo_cli, artigos(artigo_id, descricao, tipos_artigo(tipo_desc))')
    .limit(5);

  return NextResponse.json({
    pedidos: { data, error },
    movimentos: { data: mData, error: mError }
  });
}
