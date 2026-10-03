const fs = require('fs');
const path = 'src/app/configuracao/importacao-movimentos-tab.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');
// We need to add ')}' after line 595 (so splice at 596)
lines.splice(596, 0, '      )}');

// We need to remove from '{/* Modal de Limpeza de imp_stk */}' (which will now be around line 598) until the end, and then add '    </div>\n  );\n}\n'
let modalIdx = lines.findIndex(l => l.includes('{/* Modal de Limpeza de imp_stk */}'));
if (modalIdx !== -1) {
  lines = lines.slice(0, modalIdx);
  lines.push('    </div>');
  lines.push('  );');
  lines.push('}');
}
fs.writeFileSync(path, lines.join('\n'));
console.log('Fixed end of file');
