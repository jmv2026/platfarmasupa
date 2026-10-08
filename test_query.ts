
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envFile.split('\n').map(l => l.split('=')));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('movimentos')
  .select('documento_ref, client_id, data_movimento, created_at, artigo_cli, quantidade, tipo_movimento, artigos(artigo_id, pva, descricao, tipos_artigo(tipo_desc))')
  .in('tipo_movimento', ['ss', 'st', 'SS', 'ST'])
  .limit(1)
  .then(({data, error}) => console.log(JSON.stringify({data, error})));

