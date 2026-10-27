import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { parseRatios } from '../src/utils/parsers.js';

const file = path.resolve('../sample_data/RATIOS  Q2 2026.xlsx');
const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
const r = parseRatios(wb);
const byPlu = r.byPlu || {};
const plu = Object.keys(byPlu);
const avecCout = plu.filter((k) => Number(byPlu[k].coutTheo) > 0);
console.log('byPlu:', plu.length, '| avec coût > 0 :', avecCout.length);
console.log('byNom:', Object.keys(r.byNom || {}).length);
console.log('nbProduits:', Object.keys(r.allProducts || {}).length);
console.log('exemple:', plu[0], JSON.stringify(byPlu[plu[0]] && { nom: byPlu[plu[0]].nom, coutTheo: byPlu[plu[0]].coutTheo, nbIng: (byPlu[plu[0]].coutParIng || []).length }));
