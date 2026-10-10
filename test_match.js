const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
});
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function check() {
  const { data: pedidos } = await supabase.from('pedidos').select('nr_pedido, requisicao, status');
  const { data: torrestir } = await supabase.from('VW_torrestir_last').select('ref_ser, url_comprovativo, desc_estado_expedicao');
  
  const statusMap = new Map();
  torrestir.forEach(st => statusMap.set(st.ref_ser, st));
  
  let matches = 0;
  pedidos.forEach(p => {
    let refStr = (p.nr_pedido || p.requisicao || '').trim();
    if (refStr.includes(' ')) {
      refStr = refStr.substring(refStr.indexOf(' ') + 1).trim();
    }
    const st = statusMap.get(refStr);
    if (st && st.url_comprovativo) {
      matches++;
      console.log(`Matched: ${refStr} -> ${st.url_comprovativo}`);
    } else if (st && !st.url_comprovativo && st.desc_estado_expedicao.toLowerCase().includes('entregue')) {
      console.log(`Found Entregue but NO URL: ${refStr}`);
    }
  });
  console.log('Total matches with URL: ' + matches);
}
check();
