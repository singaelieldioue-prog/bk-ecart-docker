// Simulation lecture seule : que donnerait le rapport d'août avec le parseur Ratio actuel ?
import fs from 'fs';
import path from 'path';
import Database from '../../backend/node_modules/better-sqlite3/lib/index.js';
import * as XLSX from 'xlsx';
import { parseRatios } from '../src/utils/parsers.js';
import { calculer } from '../src/utils/calculators.js';

const db = new Database(path.resolve('../backend/data.db'), { readonly: true, fileMustExist: true });
const row = db.prepare('SELECT * FROM reports WHERE id=?').get('b6fd6504-33e8-4866-944c-25df2d67344a');
db.close();
const d = JSON.parse(row.data);
const avant = d.calc;

const wb = XLSX.read(fs.readFileSync(path.resolve('../sample_data/RATIOS  Q2 2026.xlsx')), { type: 'buffer' });
const ratios = parseRatios(wb);
const apres = calculer(d.stockData, d.pmixList, ratios, {}, {});

const f = (n) => n == null ? 'null' : Math.round(n).toLocaleString('fr-FR');
console.log('                  avant (rapport figé)   après (Ratio Q2 reparsé)');
console.log('CA               ', f(avant.ca), ' | ', f(apres.ca));
console.log('Conso théo       ', f(avant.consoTheoTotal), ' | ', f(apres.consoTheoTotal));
console.log('Conso réelle     ', f(avant.consoReelle), ' | ', f(apres.consoReelle));
console.log('Écart matière    ', f(avant.ecartMatiere), ' | ', f(apres.ecartMatiere));
console.log('Écart %          ', avant.ecartMatiereP == null ? 'null' : (avant.ecartMatiereP*100).toFixed(1)+' %', ' | ', apres.ecartMatiereP == null ? 'null' : (apres.ecartMatiereP*100).toFixed(1)+' %');
const pct = (c) => c.ca > 0 ? (c.consoTheoTotal / c.ca * 100).toFixed(1) + ' %' : 'n/a';
console.log('Coût matière %CA ', pct(avant), ' | ', pct(apres));
console.log('Fiches matchées  ', avant.ficheMatchees, ' | ', apres.ficheMatchees);
console.log('PLU non matchés  ', (avant.pluNonMatchés||[]).length, ' | ', (apres.pluNonMatchés||[]).length);
console.log('Couverts         ', f(avant.couverts), ' | ', f(apres.couverts));
