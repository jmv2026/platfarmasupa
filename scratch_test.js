const fs = require('fs');
const text = `ativa;Data;Documento;NumLinha;Chave1;Chave2;TipoMovimento;ValorUnitario;ValorAdicional;ValorAbater;Artigo;Descricao;TipoArtigo;Armazem;Localizacao;Lote;EstadoStock;Quantidade;Stock_Actual;Stock_Anterior
VERDADEIRO;01/10/2026;SSF 26MAX/212;2;SSF;26MAX;S;11,6;0;0;6268128;HERPIX GRAN. P/ SOL. ORAL 8 SAQ.;84;MAX01;MAX01.22A21;Z703;DISP;25;2705;2730`;

function normalizeHeader(key) {
  if (!key) return '';
  return key
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '');
}

function parseNum(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') {
    return isNaN(v) ? null : v;
  }
  const s = String(v).trim().replace(',', '.');
  if (s === '' || s.toLowerCase() === 'null') return null;
  const num = Number(s);
  return isNaN(num) ? null : num;
}

const delimiter = ';';
const lines = text.split('\n');
const header = lines[0].split(delimiter).map(normalizeHeader);

const rows = [];
const cols = lines[1].split(delimiter);
const r = {};
header.forEach((h, idx) => {
  r[h] = cols[idx] !== undefined ? cols[idx].trim() : '';
});

console.log(r);

rows.push({
  num_linha: parseNum(r['numlinha'] || r['num_linha']),
  valor_unitario: parseNum(r['valorunitario'] || r['valor_unitario']),
  stock_actual: parseNum(r['stockactual'] || r['stock_actual'] || r['stockatual'] || r['stock_atual']),
  stock_anterior: parseNum(r['stockanterior'] || r['stock_anterior']),
});

console.log(rows);
