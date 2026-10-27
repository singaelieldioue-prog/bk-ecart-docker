// SONDE lecture seule — table « Articles » du classeur de référence (B5:G591) : catégorie, nom,
// code Bolloré, unité, conditionnement, prix unitaire. Vérifie si les colonnes COLISAGE / Prix
// Unitaire des feuilles d'inventaire en sont la copie, puis compare au classeur généré.
// Exécution : node tests/tmp_exact_articles_table.mjs
import fs from "node:fs";
import JSZip from "jszip";
import XLSX from "xlsx-js-style";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { enrichirAvecBaseLocale } from "../src/utils/parsers.js";

const REF = "C:/Users/arnaud.nzue/Downloads/files (12)/exact/suivis stock BK 1.xlsx";
const norm = (s) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const z = await JSZip.loadAsync(fs.readFileSync(REF));
const ss = [];
{ const s = await z.file("xl/sharedStrings.xml").async("string"); s.replace(/<si>([\s\S]*?)<\/si>/g, (_m, b) => { ss.push([...b.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")); return ""; }); }
const dec = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function rowsOf(chemin) {
  const out = new Map();
  const xml = z.file(chemin);
  return xml.async("string").then((full) => {
    for (const m of full.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const R = Number(m[1]); const cells = {};
      for (const c of m[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const t = (c[2].match(/ t="([^"]+)"/) || [])[1] || "n";
        const v = ((c[3] || "").match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (v === undefined) continue;
        cells[c[1]] = t === "s" ? dec(ss[Number(v)] ?? "") : dec(v);
      }
      out.set(R, cells);
    }
    return out;
  });
}
const art = await rowsOf("xl/worksheets/sheet10.xml");
const table = [];
for (const [R, c] of art) {
  if (R < 5 || !c.C) continue;
  table.push({ ligne: R, cat: c.B || "", nom: c.C, code: c.D || "", unite: c.E || "", cond: c.F, pu: c.G });
}
console.log(`table Articles du CDG : ${table.length} lignes (L${table[0]?.ligne}→L${table.at(-1)?.ligne})`);
console.log(`  avec conditionnement : ${table.filter((t) => t.cond !== undefined).length} · avec prix : ${table.filter((t) => Number(t.pu) > 0).length}`);
const condCount = new Map(), uniteCount = new Map();
table.forEach((t) => { condCount.set(String(t.cond), (condCount.get(String(t.cond)) || 0) + 1); uniteCount.set(String(t.unite), (uniteCount.get(String(t.unite)) || 0) + 1); });
console.log(`  unités rencontrées : ${[...uniteCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([u, n]) => `${u}=${n}`).join(" ")}`);

// les COLISAGE / Prix des inventaires sont-ils la copie de la table Articles ?
for (const [nomFeuille, chemin] of [["Inventaire initial", "xl/worksheets/sheet2.xml"], ["Inventaire Final", "xl/worksheets/sheet8.xml"]]) {
  const inv = await rowsOf(chemin); const byName = new Map(table.map((t) => [norm(t.nom), t]));
  let n = 0, condOk = 0, condKO = 0, puOk = 0, puKO = 0, absente = 0; const ex = [];
  for (const [R, c] of inv) {
    if (R < 7 || !c.D) continue; n++;
    const t = byName.get(norm(c.D));
    if (!t) { absente++; continue; }
    if (Number(t.cond) === Number(c.E)) condOk++; else { condKO++; if (ex.length < 8) ex.push(`${c.D} : Articles F${t.ligne}=${t.cond} vs inventaire E${R}=${c.E}`); }
    if (Math.abs(Number(t.pu) - Number(c.L)) <= 0.005) puOk++; else puKO++;
  }
  console.log(`\n${nomFeuille} : ${n} lignes · absentes de la table ${absente} · colisage conforme ${condOk} / divergent ${condKO} · prix conforme ${puOk} / divergent ${puKO}`);
  ex.forEach((e) => console.log("   " + e));
}

// généré vs table du CDG
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (cc) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(cc); return r ? JSON.parse(r.v) : null; };
const wbx = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
const rows0 = XLSX.utils.sheet_to_json(wbx.Sheets.inventaire, { header: 1, defval: null });
const modele = rows0.slice(6).filter((r) => r[3] && r[14]).map((r) => ({ name: r[3], code: r[14], categorie: r[1] || "", conditionnement: typeof r[4] === "number" ? r[4] : 1, qteInner: typeof r[5] === "number" ? r[5] : 0, unite: r[10] || "" }));
const arts = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles").all();
const byCode = new Map(), byName = new Map();
arts.forEach((a) => { if (a.code) byCode.set(norm(a.code), a); if (a.nom) byName.set(norm(a.nom), a); });
const ordered = enrichirAvecBaseLocale(modele.map((m) => { const s = byCode.get(norm(m.code)) || byName.get(norm(m.name)); return { ...(s || {}), nom: m.name, code: m.code, categorie: m.categorie, conditionnement: m.conditionnement, qteInner: m.qteInner, unite: m.unite || s?.unite || "" }; }), charge("bk_sia_local_articles_v1") || {});
const wb = buildModelesWb(ordered, (charge("bk_sia_ratios_parsed_v1") || {}).allProducts || [], "BK1", "Octobre 2026", "", ["BK1"], charge("bk_sia_pmix_complement_v1") || {}, arts);
const ws = wb.Sheets["Inventaire Initial"];
const parNom = new Map(table.map((t) => [norm(t.nom), t]));
let n = 0, dansTable = 0, condD = [], puD = [];
for (let R = 7; ws["A" + R]?.v; R++) {
  const nom = String(ws["C" + R]?.v ?? ""); if (!nom || nom.startsWith("TOTAL")) break; n++;
  const t = parNom.get(norm(nom));
  if (!t) continue; dansTable++;
  if (Number(t.cond) !== Number(ws["D" + R]?.v)) condD.push({ nom, gen: ws["D" + R]?.v, cdg: t.cond, l: t.ligne });
  if (Math.abs(Number(t.pu) - Number(ws["K" + R]?.v)) > 0.5) puD.push({ nom, gen: ws["K" + R]?.v, cdg: t.pu, l: t.ligne });
}
console.log(`\ngénéré : ${n} lignes d'inventaire, ${dansTable} retrouvées dans la table Articles du CDG`);
console.log(`  colisage divergent : ${condD.length} · prix divergent : ${puD.length}`);
console.log("  exemples colisage :", condD.slice(0, 12).map((d) => `${d.nom}(${d.gen}→${d.cdg})`).join(" | "));
console.log("  exemples prix    :", puD.slice(0, 12).map((d) => `${d.nom}(${d.gen}→${d.cdg})`).join(" | "));
fs.writeFileSync(new URL("./tmp_exact_articles_table.json", import.meta.url), JSON.stringify(table, null, 0));
console.log(`\nsauvegarde : tests/tmp_exact_articles_table.json (${table.length} lignes)`);
