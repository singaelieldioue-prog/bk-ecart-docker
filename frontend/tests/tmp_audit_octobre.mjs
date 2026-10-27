import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
const wb = XLSX.read(fs.readFileSync(path.resolve('../tmp_verif/Suivi_BK1_Octobre_2026.xlsx')), { type: 'buffer' });
const n = (v) => Number(v) || 0;
const rowsOf = (s) => XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, defval: null });

// Format du modèle : A cat, B fournisseur, C article, D colisage, E inner, F carton, G inner,
// H unités, I Nombre, J unité, K prix carton, L valeur, N code, O qté.
const ini = rowsOf('Inventaire Initial').slice(6).filter(r => r[2] && String(r[2]).trim());
const pertes = rowsOf('Pertes').slice(4).filter(r => r[1] && String(r[1]).trim());
console.log('Inventaire Initial :', ini.length, 'lignes');
const sansPrix = ini.filter(r => !(n(r[10]) > 0));
const sansCdt = ini.filter(r => !(n(r[3]) > 0));
const cdtUn = ini.filter(r => n(r[3]) === 1);
const cdtAbsurde = ini.filter(r => n(r[3]) > 1000);
console.log('C-11 sans Prix carton (K) :', sansPrix.length, '→', sansPrix.slice(0, 8).map(r => r[2]).join(' | '));
console.log('C-14 colisage (D) vide/0 :', sansCdt.length, '→', sansCdt.slice(0, 6).map(r => r[2]).join(' | '));
console.log('   colisage = 1 :', cdtUn.length, '| colisage > 1000 :', cdtAbsurde.length);

const pSansPrix = pertes.filter(r => !(n(r[3]) > 0));
console.log('\nPertes :', pertes.length, '| sans Prix carton :', pSansPrix.length);
console.log('   exemples :', pSansPrix.map(r => r[1]).slice(0, 10).join(' | '));
const prixIni = new Map();
ini.forEach(r => { const k = String(r[2]).trim().toUpperCase(); if (!prixIni.has(k)) prixIni.set(k, n(r[10])); });
const ecarts = pertes.filter(r => { const p = prixIni.get(String(r[1]).trim().toUpperCase()); return n(r[3]) > 0 && p > 0 && Math.abs(n(r[3]) - p) > 0.01; });
const absentes = pertes.filter(r => !prixIni.has(String(r[1]).trim().toUpperCase()));
console.log('   prix Pertes ≠ prix Inventaire :', ecarts.length);
console.log('   désignations de Pertes absentes de l\'Inventaire :', absentes.length, '→', absentes.slice(0, 8).map(r => r[1]).join(' | '));

const pm = rowsOf('Référentiel PMIX').slice(1).filter(r => r[0] != null && String(r[0]).trim());
const coutNul = pm.filter(r => !(n(r[2]) > 0));
console.log('\nRéférentiel PMIX :', pm.length, 'PLU | coût 0/absent :', coutNul.length, '→', coutNul.slice(0, 6).map(r => r[0] + ' ' + r[1]).join(' | '));
console.log('   premiers coûts :', pm.slice(0, 3).map(r => r[0] + '=' + Math.round(n(r[2]))).join(' | '));
