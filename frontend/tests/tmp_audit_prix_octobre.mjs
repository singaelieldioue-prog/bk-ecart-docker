import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { createRequire } from 'node:module';
import { resoudrePrix } from '../src/utils/calculators.js';

const Database = createRequire(new URL('../../backend/package.json', import.meta.url))('better-sqlite3');
const db = new Database(path.resolve('../backend/data.db'), { readonly: true, fileMustExist: true });
const charge = (k) => { const r = db.prepare('SELECT v FROM kv WHERE k = ?').get(k); return r ? JSON.parse(r.v) : null; };
const baseArticle = charge('bk_sia_base_article_map_v1') || {};
const ratios = charge('bk_sia_ratios_parsed_v1') || {};
const localArticles = charge('bk_sia_local_articles_v1') || {};
const articlesBdd = db.prepare('SELECT nom, code, categorie, conditionnement, pu_carton, unite FROM articles WHERE actif = 1').all();
db.close();

const n = (v) => Number(v) || 0;
const wb = XLSX.read(fs.readFileSync(path.resolve('../tmp_verif/Suivi_BK1_Octobre_2026.xlsx')), { type: 'buffer' });
const rowsOf = (s) => XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, defval: null });
const EST_CAT = (nom) => /^(boissons|nourriture|packaging|produits de nettoyage|pmc|ifb)$/i.test(String(nom || '').trim());

const ini = rowsOf('Inventaire Initial').slice(6).filter(r => r[2] && String(r[2]).trim());
const lignes = ini.filter(r => !EST_CAT(r[2]));
console.log('lignes d\'inventaire :', ini.length, '| articles (hors lignes de catégorie) :', lignes.length);

const resoudre = (nom) => resoudrePrix(nom, baseArticle, ratios, localArticles);
const prixRef = (p) => n(p.pmpCarton) > 0 ? n(p.pmpCarton) : (n(p.puPiece) > 0 ? n(p.puPiece) * (n(p.qteCdt) || 1) : 0);

let ecarts = [], sansPrix = [], sources = {};
for (const r of lignes) {
  const nom = String(r[2]).trim();
  const k = n(r[10]);
  const p = resoudre(nom);
  const ref = prixRef(p);
  sources[p.source] = (sources[p.source] || 0) + 1;
  if (!(ref > 0) && !(k > 0)) sansPrix.push(nom);
  if (ref > 0 && k > 0 && Math.abs(k - ref) > 0.01) ecarts.push({ nom, fichier: k, ref, montant: k - ref });
}
console.log('C-10 prix fichier ≠ référentiel :', ecarts.length, '/', lignes.length);
console.log('   montant cumulé (fichier − référentiel) :', Math.round(ecarts.reduce((s, e) => s + e.montant, 0)));
console.log('   exemples :', ecarts.slice(0, 5).map(e => `${e.nom} ${Math.round(e.fichier)}→${Math.round(e.ref)}`).join(' | '));
console.log('C-11 aucune source de prix :', sansPrix.length, '→', sansPrix.slice(0, 8).join(' | '));
console.log('sources de prix :', JSON.stringify(sources));

const pertes = rowsOf('Pertes').slice(4).filter(r => r[1] && String(r[1]).trim() && !EST_CAT(r[1]));
let ecartsP = [], absentesP = [];
for (const r of pertes) {
  const nom = String(r[1]).trim();
  const k = n(r[3]);
  const ref = prixRef(resoudre(nom));
  if (!(ref > 0)) { absentesP.push(nom); continue; }
  if (k > 0 && Math.abs(k - ref) > 0.01) ecartsP.push({ nom, fichier: k, ref, montant: k - ref });
}
console.log('\nC-12 Pertes :', pertes.length, 'lignes');
console.log('   prix fichier ≠ référentiel :', ecartsP.length, '| montant cumulé :', Math.round(ecartsP.reduce((s, e) => s + e.montant, 0)));
console.log('   exemples :', ecartsP.slice(0, 5).map(e => `${e.nom} ${Math.round(e.fichier)}→${Math.round(e.ref)}`).join(' | '));
console.log('   sans prix au référentiel (désignations absentes) :', absentesP.length);

// C-14 : articles dont le colisage du fichier est absent ou incohérent
const sansCdt = lignes.filter(r => !(n(r[3]) > 0));
const cdtUn = lignes.filter(r => n(r[3]) === 1);
const innerVide = lignes.filter(r => n(r[3]) > 1 && !(n(r[4]) > 0));
console.log('\nC-14 colisage (D) vide/0 :', sansCdt.length, '| colisage = 1 :', cdtUn.length, '| >1 sans inner :', innerVide.length);
// Articles de la BDD sans conditionnement renseigné
const bddSansCdt = articlesBdd.filter(a => !(n(a.conditionnement) > 0));
console.log('   BDD articles actifs :', articlesBdd.length, '| sans conditionnement :', bddSansCdt.length);
