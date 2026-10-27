// Sonde lecture seule : tableau complet des lignes Pertes 145→190 (bloc transmises + produits finis),
// avec catégorie / Cond. / prix carton / prix pièce, pour repérer ce qui est résolu ou laissé vide.
// Exécution : node tests/tmp_pertes_bloc.mjs
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
const rows0 = XLSX.utils.sheet_to_json(wbx.Sheets.inventaire, { header: 1, defval: null });
const ref = rows0.slice(6).filter((r) => r[3] && r[14]).map((r) => ({ name: r[3], code: r[14], categorie: r[1] || "", conditionnement: typeof r[4] === "number" ? r[4] : 1, qteInner: typeof r[5] === "number" ? r[5] : 0, unite: r[10] || "" }));
function ordonnerSelonExemple(articles) {
  const byCode = new Map(), byName = new Map();
  articles.forEach((a) => { if (a.code) byCode.set(norm(a.code), a); if (a.nom) byName.set(norm(a.nom), a); });
  return ref.map((reference) => { const s = byCode.get(norm(reference.code)) || byName.get(norm(reference.name));
    return { ...(s || {}), nom: reference.name, code: reference.code, categorie: reference.categorie,
      conditionnement: reference.conditionnement, qteInner: reference.qteInner, unite: reference.unite || s?.unite || "" }; });
}
const arts = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles").all();
const ratios = charge("bk_sia_ratios_parsed_v1") || {}; const produits = ratios.allProducts || [];
const localArticles = charge("bk_sia_local_articles_v1") || {}; const pmixComplement = charge("bk_sia_pmix_complement_v1") || {};
const ordered = enrichirAvecBaseLocale(ordonnerSelonExemple(arts.filter(a=>a.actif===1)), localArticles);
const ws = buildModelesWb(ordered, produits, "BK1", "Octobre 2026", "", ["BK1"], pmixComplement, arts).Sheets["Pertes"];
const rg = XLSX.utils.decode_range(ws["!ref"]);
const g = (r, c) => { const y = ws[XLSX.utils.encode_cell({ r, c })]; return y ? (y.v !== undefined ? y.v : y.f) : null; };
const fmt = (v) => (v === null || v === undefined || v === "" ? "—" : (typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : String(v)));
const de = Number(process.env.DE || 145), fi = Number(process.env.FI || 190);
console.log("lig | catégorie            | désignation                              | Cond. | prix carton | prix pièce(formule)");
for (let r = de - 1; r <= fi - 1; r++) {
  const nom = g(r, 1); if (!nom) continue;
  console.log(`${String(r + 1).padStart(3)} | ${fmt(g(r, 0)).padEnd(20)} | ${fmt(nom).padEnd(38)} | ${fmt(g(r, 2)).padEnd(5)} | ${fmt(g(r, 3)).padEnd(11)} | ${fmt(g(r, 4))}`);
}
console.log("\n── Recherche KIRENE dans le modèle d inventaire et la base ──");
ref.filter(x=>/kirene|kiren/i.test(x.name)).forEach(x=>console.log(`  modèle : ${JSON.stringify(x.name)} code=${JSON.stringify(x.code)} cat=${JSON.stringify(x.categorie)} cond=${x.conditionnement}`));
ordered.filter(x=>/kirene|kiren/i.test(String(x.nom))).forEach(x=>console.log(`  ordered: ${JSON.stringify(x.nom)} code=${JSON.stringify(x.code)} cat=${JSON.stringify(x.categorie)} cond=${x.conditionnement} pu_carton=${x.pu_carton}`));
