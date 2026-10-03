const fs = require('fs');
const actionsPath = 'src/app/configuracao/actions.ts';
let actions = fs.readFileSync(actionsPath, 'utf8');
actions = actions.replace(/cliente_id:/g, 'client_id:');
actions = actions.replace(/sigla_cliente:/g, 'sigla:');
fs.writeFileSync(actionsPath, actions);

const erpTabPath = 'src/app/configuracao/importacao-erp-tab.tsx';
let erpTab = fs.readFileSync(erpTabPath, 'utf8');
erpTab = erpTab.replace(/cliente_id/g, 'client_id');
erpTab = erpTab.replace(/sigla_cliente/g, 'sigla');
fs.writeFileSync(erpTabPath, erpTab);
console.log('Fixed actions.ts and importacao-erp-tab.tsx');
