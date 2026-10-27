import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
const f = path.resolve('../tmp_verif/Suivi_BK1_Octobre_2026.xlsx');
const wb = XLSX.read(fs.readFileSync(f), { type: 'buffer' });
console.log('feuilles:', wb.SheetNames.join(' | '));
for (const nom of wb.SheetNames) {
  const ws = wb.Sheets[nom];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  let nombres = 0, textes = 0;
  rows.forEach(r => r.forEach(c => { if (typeof c === 'number') nombres++; else if (typeof c === 'string' && c.trim()) textes++; }));
  console.log(`${nom.padEnd(22)} lignes=${String(rows.length).padStart(4)} nombres=${String(nombres).padStart(5)} textes=${String(textes).padStart(5)}`);
}
const inv = XLSX.utils.sheet_to_json(wb.Sheets['Inventaire initial '] || wb.Sheets['Inventaire Initial'], { header: 1, defval: null });
console.log('\nInventaire — 3 premières lignes de données:');
console.log(JSON.stringify(inv[5]).slice(0, 300));
console.log(JSON.stringify(inv[6]).slice(0, 300));
console.log(JSON.stringify(inv[7]).slice(0, 300));
const p = XLSX.utils.sheet_to_json(wb.Sheets['Pertes'], { header: 1, defval: null });
console.log('\nPertes — lignes 4 à 6:');
[3,4,5].forEach(i => console.log(JSON.stringify((p[i]||[]).slice(0,12)).slice(0,300)));
