const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
});
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function check() {
  const { data, error } = await supabase.from('torrestir_status').select('ref_ser, ref_comprovativo, url_comprovativo').not('url_comprovativo', 'is', null);
  console.log('DB Rows with url:', data?.length);
  if(data && data.length > 0) console.log(data[0]);
  if(error) console.error(error);
}
check();
