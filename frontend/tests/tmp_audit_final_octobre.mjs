// AUDIT FINAL — tmp_verif/Suivi_BK1_Octobre_2026.xlsx (fichier du workspace, PAS la rev27).
// Lecture seule (base en readonly). Compte les articles réels (les lignes séparatrices de
// catégorie et la ligne TOTAL ne sont pas des articles), puis chiffre C-09…C-14.
// Exécution : node tests/tmp_audit_final_octobre.mjs
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { createRequire } from "node:module";
import { resoudrePrix } from "../src/utils/calculators.js";

const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(path.resolve("../backend/data.db"), { readonly: true, fileMustExist: true });
const charge = (k) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(k); return r ? JSON.parse(r.v) : null; };
const baseArticle = charge("bk_sia_base_article_map_v1") || {};
const ratios = charge("bk_sia_ratios_parsed_v1") || {};
const localArticles = charge("bk_sia_local_articles_v1") || {};
const ratiosMeta = charge("bk_sia_ratios_v1") || null;
db.close();

const n = (v) => Number(v) || 0;
const wb = XLSX.read(fs.readFileSync(path.resolve("../tmp_verif/Suivi_BK1_Octobre_2026.xlsx")), { type: "buffer" });
const rowsOf = (s) => XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, defval: null });

// Un article a sa catégorie en A ET sa désignation en C. Les séparateurs de catégorie
// ([null,"Boissons",…]) et la ligne TOTAL n'ont pas de catégorie en A.
const ini = rowsOf("Inventaire Initial").slice(6).filter((r) => r[2] && String(r[2]).trim());
const articles = ini.filter((r) => r[0] && String(r[0]).trim());
// Pertes : pas de ligne séparatrice, mais une ligne transmise sans catégorie (BBQ TENDERCRISP)
// reste un article à part entière → on ne filtre que sur la désignation.
const pertes = rowsOf("Pertes").slice(4).filter((r) => r[1] && String(r[1]).trim());

const resoudre = (nom) => resoudrePrix(nom, baseArticle, ratios, localArticles);
const prixRef = (p) => n(p.pmpCarton) > 0 ? n(p.pmpCarton) : (n(p.puPiece) > 0 ? n(p.puPiece) * (n(p.qteCdt) || 1) : 0);

console.log("═══ VOLUMES ═══");
console.log(`lignes nommées : ${ini.length} | articles réels : ${articles.length} | lignes séparatrices/TOTAL : ${ini.length - articles.length}`);
console.log(`Pertes : ${pertes.length} lignes d'articles`);
console.log(`Ratio actif : ${JSON.stringify(ratiosMeta)} | produits ${Object.keys(ratios.byPlu || {}).length} | ingrédients ${Object.keys(ratios.pmpByIng || {}).length}`);

// ── C-10 / C-11 sur l'inventaire ────────────────────────────────────────────
const ecarts = [], sansPrixFichier = [], sansSource = [], sources = {};
for (const r of articles) {
  const nom = String(r[2]).trim();
  const k = n(r[10]);
  const p = resoudre(nom);
  const ref = prixRef(p);
  sources[p.source] = (sources[p.source] || 0) + 1;
  if (!(k > 0)) sansPrixFichier.push(nom);
  if (!(ref > 0) && !(k > 0)) sansSource.push(nom);
  if (ref > 0 && k > 0 && Math.abs(k - ref) > 0.01) ecarts.push({ nom, fichier: k, ref, montant: k - ref });
}
console.log("\n═══ C-10 prix d'inventaire ≠ référentiel ═══");
console.log(`écarts : ${ecarts.length}/${articles.length} | montant cumulé fichier−référentiel : ${Math.round(ecarts.reduce((s, e) => s + e.montant, 0))} F`);
console.log("exemples : " + ecarts.slice(0, 6).map((e) => `${e.nom} ${Math.round(e.fichier)}→${Math.round(e.ref)}`).join(" | "));
const ecartsTries = [...ecarts].sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant));
console.log("détail : " + ecartsTries.map((e) => `${e.nom} ${e.montant.toFixed(2)}`).join(" | "));
console.log(`écarts > 1 F : ${ecarts.filter((e) => Math.abs(e.montant) > 1).length} | arrondis ≤ 1 F : ${ecarts.filter((e) => Math.abs(e.montant) <= 1).length}`);

console.log("\n═══ C-11 articles sans prix ═══");
console.log(`sans prix carton DANS LE FICHIER : ${sansPrixFichier.length}/${articles.length}`);
console.log(`sans aucune source de prix (fichier + référentiel) : ${sansSource.length}`);
console.log("sources : " + JSON.stringify(sources));

// ── C-12 Pertes ─────────────────────────────────────────────────────────────
const prixIni = new Map();
for (const r of articles) { const k = String(r[2]).trim().toUpperCase(); if (!prixIni.has(k)) prixIni.set(k, n(r[10])); }
let ecartsP = [], absentesInventaire = [], absentesReferentiel = [];
for (const r of pertes) {
  const nom = String(r[1]).trim();
  const k = n(r[3]);
  const ref = prixRef(resoudre(nom));
  if (!prixIni.has(nom.toUpperCase())) absentesInventaire.push(nom);
  if (!(ref > 0)) { absentesReferentiel.push(nom); continue; }
  if (k > 0 && Math.abs(k - ref) > 0.01) ecartsP.push({ nom, fichier: k, ref, montant: k - ref });
}
console.log("\n═══ C-12 Pertes ═══");
console.log(`prix Pertes ≠ référentiel : ${ecartsP.length}/${pertes.length} | cumul fichier−référentiel : ${Math.round(ecartsP.reduce((s, e) => s + e.montant, 0))} F`);
console.log("exemples : " + ecartsP.slice(0, 6).map((e) => `${e.nom} ${Math.round(e.fichier)}→${Math.round(e.ref)}`).join(" | "));
const ecartsPTries = [...ecartsP].sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant));
console.log("détail : " + ecartsPTries.map((e) => `${e.nom} ${e.montant.toFixed(2)}`).join(" | "));
console.log(`écarts > 1 F : ${ecartsP.filter((e) => Math.abs(e.montant) > 1).length} | arrondis ≤ 1 F : ${ecartsP.filter((e) => Math.abs(e.montant) <= 1).length}`);
console.log(`désignations absentes de l'Inventaire : ${absentesInventaire.length}`);
console.log(`désignations sans prix au référentiel : ${absentesReferentiel.length}`);
console.log(`lignes Pertes sans prix carton dans le fichier : ${pertes.filter((r) => !(n(r[3]) > 0)).length}`);

// ── C-13 Référentiel PMIX ───────────────────────────────────────────────────
const pm = rowsOf("Référentiel PMIX").slice(1).filter((r) => r[0] != null && String(r[0]).trim());
const coutNul = pm.filter((r) => !(n(r[2]) > 0));
console.log("\n═══ C-13 Référentiel PMIX ═══");
console.log(`PLU : ${pm.length} | coût 0/absent : ${coutNul.length} (${Math.round((coutNul.length / pm.length) * 1000) / 10} %)`);
console.log("exemples : " + coutNul.slice(0, 6).map((r) => `${r[0]} ${r[1]}`).join(" | "));

// ── C-14 colisage ───────────────────────────────────────────────────────────
const cdtVide = articles.filter((r) => !(n(r[3]) > 0));
const cdtUn = articles.filter((r) => n(r[3]) === 1);
const innerVide = articles.filter((r) => n(r[3]) > 1 && !(n(r[4]) > 0));
const cdtAbsurde = articles.filter((r) => n(r[3]) > 1000);
console.log("\n═══ C-14 colisage ═══");
console.log(`colisage vide/0 : ${cdtVide.length} | =1 : ${cdtUn.length} | >1 sans inner : ${innerVide.length} | >1000 : ${cdtAbsurde.length}`);
console.log("exemples vide : " + cdtVide.map((r) => r[2]).slice(0, 6).join(" | "));
console.log("exemples =1 : " + cdtUn.map((r) => r[2]).slice(0, 6).join(" | "));
