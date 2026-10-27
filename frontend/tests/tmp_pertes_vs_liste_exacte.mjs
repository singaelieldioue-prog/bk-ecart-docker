// SONDE lecture seule — confronte la liste Pertes publiée aujourd'hui (base vivante + code courant)
// à la liste « exacte » du CDG (PERTE JULLET.xlsx, feuille BK1 : 191 lignes, 5 catégories).
// Exécution : node tests/tmp_pertes_vs_liste_exacte.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { enrichirAvecBaseLocale } from "../src/utils/parsers.js";

const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (c) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(c); return r ? JSON.parse(r.v) : null; };
const norm = (s) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

// ── A. Liste de référence du CDG ───────────────────────────────────────────────
const DIR = "C:/Users/arnaud.nzue/Downloads/files (12)/recahierdeschargesfonctionnelautomatisationdelava/";
const wsRef = XLSX.read(fs.readFileSync(DIR + "PERTE JULLET.xlsx"), { type: "buffer" }).Sheets.BK1;
const ref = [];
for (let r = 5; r <= 250; r++) {
  const nom = wsRef["C" + r]?.v;
  if (nom === undefined || String(nom).trim() === "") continue;
  ref.push({ ligne: r, cat: String(wsRef["B" + r]?.v ?? ""), nom: String(nom), cond: wsRef["D" + r]?.v, unite: wsRef["G" + r]?.v });
}

// ── B. Liste publiée par le code courant ───────────────────────────────────────
const wbx = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
const rows0 = XLSX.utils.sheet_to_json(wbx.Sheets.inventaire, { header: 1, defval: null });
const modele = rows0.slice(6).filter((r) => r[3] && r[14]).map((r) => ({
  name: r[3], code: r[14], categorie: r[1] || "", conditionnement: typeof r[4] === "number" ? r[4] : 1,
  qteInner: typeof r[5] === "number" ? r[5] : 0, unite: r[10] || "",
}));
function ordonnerSelonExemple(articles) {
  const byCode = new Map(), byName = new Map();
  articles.forEach((a) => { if (a.code) byCode.set(norm(a.code), a); if (a.nom) byName.set(norm(a.nom), a); });
  return modele.map((m) => { const s = byCode.get(norm(m.code)) || byName.get(norm(m.name));
    return { ...(s || {}), nom: m.name, code: m.code, categorie: m.categorie, conditionnement: m.conditionnement,
      qteInner: m.qteInner, unite: m.unite || s?.unite || "" }; });
}
const arts = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles").all();
const ratios = charge("bk_sia_ratios_parsed_v1") || {};
const produits = ratios.allProducts || [];
const localArticles = charge("bk_sia_local_articles_v1") || {};
const pmixComplement = charge("bk_sia_pmix_complement_v1") || {};
const ordered = enrichirAvecBaseLocale(ordonnerSelonExemple(arts.filter((a) => a.actif === 1)), localArticles);
const ws = buildModelesWb(ordered, produits, "BK1", "Octobre 2026", "", ["BK1"], pmixComplement, arts).Sheets.Pertes;
const gen = [];
const rg = XLSX.utils.decode_range(ws["!ref"]);
for (let r = 4; r <= rg.e.r; r++) {
  const nom = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
  if (nom === undefined || String(nom).trim() === "" || /^TOTAL/i.test(String(nom))) continue;
  gen.push({
    ligne: r + 1, cat: String(ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v ?? ""), nom: String(nom),
    cond: ws[XLSX.utils.encode_cell({ r, c: 2 })]?.v, unite: ws[XLSX.utils.encode_cell({ r, c: 5 })]?.v,
    pu: ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v,
  });
}

// ── C. Confrontation ───────────────────────────────────────────────────────────
console.log(`référence CDG : ${ref.length} lignes | publié : ${gen.length} lignes`);
const mRef = new Map(), mGen = new Map();
ref.forEach((x) => { const k = norm(x.nom); if (!mRef.has(k)) mRef.set(k, x); });
gen.forEach((x) => { const k = norm(x.nom); if (!mGen.has(k)) mGen.set(k, x); });
const manquantes = ref.filter((x) => !mGen.has(norm(x.nom)));
const enSus = gen.filter((x) => !mRef.has(norm(x.nom)));
console.log(`\n── absents de la publication (${manquantes.length}) ──`);
manquantes.forEach((x) => console.log(`  ref L${x.ligne} [${x.cat}] ${JSON.stringify(x.nom)} cond=${x.cond} unité=${x.unite}`));
console.log(`\n── publiés hors liste exacte (${enSus.length}) ──`);
enSus.forEach((x) => console.log(`  gén L${x.ligne} [${x.cat}] ${JSON.stringify(x.nom)} cond=${x.cond} unité=${x.unite} pu=${x.pu}`));

const catDiff = [], condDiff = [], uniteDiff = [];
ref.forEach((x) => { const g = mGen.get(norm(x.nom)); if (!g) return;
  if (norm(g.cat) !== norm(x.cat)) catDiff.push({ nom: x.nom, ref: x.cat, gen: g.cat });
  const a = Number(g.cond), b = Number(x.cond);
  if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 1e-9) condDiff.push({ nom: x.nom, ref: b, gen: a });
  if (String(g.unite ?? "").trim() !== String(x.unite ?? "").trim()) uniteDiff.push({ nom: x.cat === "Produit fini" ? x.nom : x.nom, ref: x.unite, gen: g.unite });
});
console.log(`\n── libellés de catégorie divergents (${catDiff.length}) ──`);
catDiff.forEach((x) => console.log(`  ${x.nom} : CDG ${JSON.stringify(x.ref)} vs publié ${JSON.stringify(x.gen)}`));
console.log(`\n── conditionnements divergents (${condDiff.length}) ──`);
condDiff.forEach((x) => console.log(`  ${x.nom} : CDG ${x.ref} vs publié ${x.gen}`));
console.log(`\n── unités de perte divergentes (${uniteDiff.length}) ──`);
uniteDiff.forEach((x) => console.log(`  ${x.nom} : CDG ${JSON.stringify(x.ref)} vs publié ${JSON.stringify(x.gen)}`));

const blocs = (l, cle) => { const o = []; l.forEach((x) => { const c = x[cle]; const d = o[o.length - 1];
  if (d && d.cat === c) { d.n++; d.fin = x.ligne; } else o.push({ cat: c, debut: x.ligne, fin: x.ligne, n: 1 }); }); return o; };
console.log(`\n── blocs de référence ──`);
blocs(ref, "cat").forEach((b) => console.log(`  ${b.cat} : L${b.debut}→${b.fin} (${b.n})`));
console.log(`\n── blocs publiés ──`);
blocs(gen, "cat").forEach((b) => console.log(`  ${b.cat} : L${b.debut}→${b.fin} (${b.n})`));

const seqRef = ref.map((x) => norm(x.nom)), seqGen = gen.map((x) => norm(x.nom));
const horsOrdre = seqRef.filter((k) => mGen.has(k));
const posGen = new Map(seqGen.map((k, i) => [k, i]));
const inversions = [];
for (let i = 1; i < horsOrdre.length; i++) {
  const a = horsOrdre[i - 1], b = horsOrdre[i];
  if (posGen.get(b) < posGen.get(a)) inversions.push([ref.find((x) => norm(x.nom) === a).nom, ref.find((x) => norm(x.nom) === b).nom]);
}
console.log(`\n── paires en ordre inversé réf→publié : ${inversions.length}`);
inversions.slice(0, 15).forEach(([a, b]) => console.log(`  « ${a} » publié après « ${b} »`));
const vides = gen.filter((x) => !(Number(x.pu) > 0));
console.log(`\n── lignes publiées sans prix (${vides.length}) ──`);
vides.forEach((x) => console.log(`  L${x.ligne} [${x.cat}] ${x.nom}`));

// ── D. Géométrie de la feuille publiée (en-têtes + lignes repères) ─────────────
console.log("\n── en-têtes publiés ──");
for (const r of [3, 4]) { const o = []; for (let c = 0; c < 12; c++) { const v = ws[XLSX.utils.encode_cell({ r, c })]?.v;
  if (v !== undefined && v !== null && String(v).trim() !== "") o.push(XLSX.utils.encode_col(c) + (r + 1) + "=" + JSON.stringify(v)); } console.log(" ", o.join("  ")); }
console.log("── lignes repères (A..F) ──");
[5, 40, 48, 62, 117, 165, 190].forEach((n) => { const r = n - 1; const o = [];
  for (let c = 0; c < 6; c++) { const cell = ws[XLSX.utils.encode_cell({ r, c })];
    o.push(XLSX.utils.encode_col(c) + "=" + (cell ? (cell.f ? "{f:" + cell.f + "}" : JSON.stringify(cell.v)) : "—")); }
  console.log(`  L${n}`, o.join(" ")); });
