const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
});
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function check() {
  const { data, error } = await supabase.storage.from('comprovativos_ttir').list();
  if (data) {
    console.log(data.map(f => f.name).slice(0, 50));
    console.log("Total files: " + data.length);
  } else {
    console.log(error);
  }
}
check();
