const fs = require('fs');
const path = 'src/app/configuracao/importacao-movimentos-tab.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

let start = lines.findIndex(l => l.includes('{movimentosList.length > 0 && ('));
if (start !== -1) {
  lines.splice(start, 2);
}

fs.writeFileSync(path, lines.join('\n'));
console.log('Fixed empty block');
