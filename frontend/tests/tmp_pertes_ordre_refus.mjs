// Sonde lecture seule : (1) ordre des catégories dans la feuille Pertes générée, (2) lignes
// transmises laissées sans Cond./Prix et leur existence réelle dans la base articles.
// Exécution : node tests/tmp_pertes_ordre_refus.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { enrichirAvecBaseLocale } from "../src/utils/parsers.js";

const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (cle) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(cle); return r ? JSON.parse(r.v) : null; };
const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

function ordonnerSelonExemple(articles) {
  const wbx = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wbx.Sheets.inventaire, { header: 1, defval: null });
  const ref = rows.slice(6).filter((r) => r[3] && r[14]).map((r) => ({
    name: r[3], code: r[14], categorie: r[1] || "",
    conditionnement: typeof r[4] === "number" ? r[4] : 1,
    qteInner: typeof r[5] === "number" ? r[5] : 0, unite: r[10] || "",
  }));
  const byCode = new Map(), byName = new Map();
  articles.forEach((a) => { if (a.code) byCode.set(norm(a.code), a); if (a.nom) byName.set(norm(a.nom), a); });
  return ref.map((reference) => {
    const source = byCode.get(norm(reference.code)) || byName.get(norm(reference.name));
    return { ...(source || {}), nom: reference.name, code: reference.code, categorie: reference.categorie,
      conditionnement: reference.conditionnement, qteInner: reference.qteInner, unite: reference.unite || source?.unite || "" };
  });
}

const arts = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles").all();
const artsActifs = arts.filter((a) => a.actif === 1);
const ratios = charge("bk_sia_ratios_parsed_v1") || {};
const produits = ratios.allProducts || [];
const localArticles = charge("bk_sia_local_articles_v1") || {};
const baseArticle = charge("bk_sia_base_article_map_v1") || {};
const pmixComplement = charge("bk_sia_pmix_complement_v1") || {};
const ordered = enrichirAvecBaseLocale(ordonnerSelonExemple(artsActifs), localArticles);

const wb = buildModelesWb(ordered, produits, "BK1", "Octobre 2026", "", ["BK1"], pmixComplement, arts);
const ws = wb.Sheets["Pertes"];
const range = XLSX.utils.decode_range(ws["!ref"]);
const cell = (r, c) => { const x = ws[XLSX.utils.encode_cell({ r, c })]; return x ? (x.v !== undefined ? x.v : x.f) : null; };

// ── 1. Séquence des catégories, ligne par ligne ────────────────────────────
console.log("── 1. Ordre des catégories dans la feuille Pertes générée ──");
let prec = null, groupes = [];
for (let r = 4; r <= range.e.r - 1; r++) {
  const cat = cell(r, 0), nom = cell(r, 1);
  if (nom === null || nom === undefined || nom === "") continue;
  const cle = (cat === null || cat === "") ? "(sans catégorie)" : String(cat);
  if (cle !== prec) { groupes.push({ cat: cle, debut: r + 1, fin: r + 1, n: 1, prec }); prec = cle; }
  else groupes[groupes.length - 1].fin = r + 1, groupes[groupes.length - 1].n++;
}
groupes.forEach((g, i) => {
  const rupture = i > 0 && groupes.some((h, j) => j < i && h.cat === g.cat);
  console.log(`${String(g.debut).padStart(4)}→${String(g.fin).padEnd(4)} (${String(g.n).padStart(3)}) ${g.cat.padEnd(22)}${rupture ? "  ⚠️ catégorie déjà rencontrée plus haut" : ""}`);
});
const vus = new Set(); let retours = 0;
groupes.forEach((g) => { if (vus.has(g.cat)) retours++; vus.add(g.cat); });
console.log(`blocs publiés : ${groupes.length} | catégories distinctes : ${vus.size} | blocs de retour : ${retours}`);

// ── 2. Les lignes laissées sans Cond./Prix ─────────────────────────────────
console.log("\n── 2. Lignes transmises sans Cond./Prix et leur base ──");
for (let r = 4; r <= range.e.r - 1; r++) {
  const nom = cell(r, 1);
  if (!nom) continue;
  const cond = cell(r, 2), pcart = cell(r, 3);
  if (cond !== null && cond !== "" && pcart !== null && pcart !== "") continue;
  const dansBase = arts.filter((a) => norm(a.nom) === norm(nom));
  console.log(`\nExcel ligne ${r + 1} · « ${nom} » · catégorie cellule = « ${cell(r, 0) ?? ""} »`);
  if (!dansBase.length) { console.log("   base articles : AUCUNE ligne avec ce nom exact"); }
  dansBase.forEach((b) => {
    const codeN = norm(b.code);
    const memesCode = arts.filter((a) => a.code && norm(a.code) === codeN && norm(a.nom) !== norm(b.nom)).map((a) => a.nom);
    const publie = ws && [...Array(range.e.r - 3).keys()].some((i) => {
      const n = cell(4 + i, 1); const c = cell(4 + i, 0);
      return n && c !== "" && c !== null && memesCode.includes(n);
    });
    console.log(`   base : code=${JSON.stringify(b.code)} cat=${JSON.stringify(b.categorie)} cond=${b.conditionnement} `
      + `pu_carton=${b.pu_carton} pu_piece=${b.pu_piece} unite=${JSON.stringify(b.unite)} actif=${b.actif}`);
    console.log(`   autres articles partageant ce code : ${memesCode.length ? memesCode.join(" | ") : "aucun"}`);
    if (memesCode.length) console.log(`   → l'un au moins est-il publié avec une catégorie ? ${publie ? "OUI (garde doublon légitime)" : "NON (garde doublon abusive)"}`);
  });
}

// ── 3. Ordre des catégories dans le fichier du CDG (PERTE JULLET.xlsx, BK1) ─
console.log("\n── 3. Ordre des catégories dans PERTE JULLET.xlsx (modèle du CDG) ──");
try {
  const jw = XLSX.read(fs.readFileSync("C:/Users/arnaud.nzue/Downloads/files (12)/recahierdeschargesfonctionnelautomatisationdelava/PERTE JULLET.xlsx"), { type: "buffer" });
  ["BK1", "BK2", "BK5"].forEach((sh) => {
    const s = jw.Sheets[sh]; if (!s) return;
    const rr = XLSX.utils.sheet_to_json(s, { header: 1, defval: null });
    let p = null, g = [];
    for (let i = 4; i < rr.length; i++) {
      const nom = rr[i]?.[1]; if (!nom || typeof nom !== "string") continue;
      const cat = rr[i]?.[0] ? String(rr[i][0]) : "(vide)";
      if (cat !== p) { g.push(cat); p = cat; }
    }
    console.log(`${sh} : ${g.join(" → ")}`);
  });
} catch (e) { console.log("lecture impossible :", e.message); }
