// Sonde lecture seule : pourquoi « BOUTEILLE PEPSI ZERO 1,5L » est refusée par la garde doublon de code ?
// Exécution : node tests/tmp_pertes_code_pepsi.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { enrichirAvecBaseLocale } from "../src/utils/parsers.js";
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (c) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(c); return r ? JSON.parse(r.v) : null; };
const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const wbx = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wbx.Sheets.inventaire, { header: 1, defval: null });
const ref = rows.slice(6).filter((r) => r[3] && r[14]).map((r) => ({ name: r[3], code: r[14], categorie: r[1] || "", conditionnement: typeof r[4] === "number" ? r[4] : 1, qteInner: typeof r[5] === "number" ? r[5] : 0, unite: r[10] || "" }));
function ordonnerSelonExemple(articles) {
  const byCode = new Map(), byName = new Map();
  articles.forEach((a) => { if (a.code) byCode.set(norm(a.code), a); if (a.nom) byName.set(norm(a.nom), a); });
  return ref.map((reference) => {
    const source = byCode.get(norm(reference.code)) || byName.get(norm(reference.name));
    return { ...(source || {}), nom: reference.name, code: reference.code, categorie: reference.categorie,
      conditionnement: reference.conditionnement, qteInner: reference.qteInner, unite: reference.unite || source?.unite || "" };
  });
}
console.log("── Articles de la base dont le nom contient PEPSI ──");
db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif FROM articles WHERE UPPER(nom) LIKE '%PEPSI%' ORDER BY nom").all()
  .forEach(a => console.log(`  ${JSON.stringify(a.nom).padEnd(32)} code=${JSON.stringify(a.code).padEnd(20)} cat=${JSON.stringify(a.categorie).padEnd(12)} cond=${a.conditionnement} carton=${a.pu_carton} piece=${a.pu_piece} unite=${JSON.stringify(a.unite)} actif=${a.actif} norm(code)=${norm(a.code)}`));
console.log("\n── Lignes du modèle d'inventaire portant le code normalisé « btlpepsi15l » ──");
ref.filter(r => norm(r.code) === "btlpepsi15l").forEach(r => console.log(`  modèle : nom=${JSON.stringify(r.name)} code=${JSON.stringify(r.code)} cat=${JSON.stringify(r.categorie)}`));
const arts = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles").all();
const artsActifs = arts.filter(a => a.actif === 1);
const ratios = charge("bk_sia_ratios_parsed_v1") || {}; const produits = ratios.allProducts || [];
const localArticles = charge("bk_sia_local_articles_v1") || {}; const pmixComplement = charge("bk_sia_pmix_complement_v1") || {};
const ordered = enrichirAvecBaseLocale(ordonnerSelonExemple(artsActifs), localArticles);
console.log("\n── Lignes « ordered » (source des 146 publiées) portant ce code ──");
ordered.filter(a => norm(a.code) === "btlpepsi15l").forEach(a => console.log(`  ordered : nom=${JSON.stringify(a.nom)} code=${JSON.stringify(a.code)} cat=${JSON.stringify(a.categorie)} cond=${a.conditionnement} pu_carton=${a.pu_carton}`));
console.log("\n── Lignes « ordered » dont le nom contient PEPSI ──");
ordered.filter(a => /pepsi/i.test(String(a.nom))).forEach(a => console.log(`  nom=${JSON.stringify(a.nom)} code=${JSON.stringify(a.code)} cat=${JSON.stringify(a.categorie)}`));
console.log("\n── Lignes publiées dans la feuille Pertes dont la désignation contient PEPSI ──");
const ws = buildModelesWb(ordered, produits, "BK1", "Octobre 2026", "", ["BK1"], pmixComplement, arts).Sheets["Pertes"];
const rg = XLSX.utils.decode_range(ws["!ref"]);
for (let r = 4; r <= rg.e.r - 1; r++) {
  const x = ws[XLSX.utils.encode_cell({ r, c: 1 })]; if (!x) continue;
  const n = String(x.v || ""); if (!/pepsi/i.test(n)) continue;
  const g = (c) => { const y = ws[XLSX.utils.encode_cell({ r, c })]; return y ? (y.v !== undefined ? y.v : y.f) : null; };
  console.log(`  Pertes l.${r + 1} cat=${JSON.stringify(g(0))} nom=${JSON.stringify(n)} cond=${JSON.stringify(g(2))} carton=${JSON.stringify(g(3))}`);
}
