// SONDE lecture seule — Inventaire : colisage / unité / prix unitaire du classeur de référence du CDG
// (exact/suivis stock BK 1.xlsx, feuilles "Inventaire initial" sheet2 et "Inventaire Final" sheet8)
// comparés au classeur généré par le code courant.
// Exécution : node tests/tmp_exact_inv_colisage.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import JSZip from "jszip";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { enrichirAvecBaseLocale } from "../src/utils/parsers.js";

const REF = "C:/Users/arnaud.nzue/Downloads/files (12)/exact/suivis stock BK 1.xlsx";
const norm = (s) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

// ── référence : lecture XML des deux feuilles d'inventaire (2 Mo max chacune) ──
const z = await JSZip.loadAsync(fs.readFileSync(REF));
const ss = [];
{
  const s = await z.file("xl/sharedStrings.xml").async("string");
  s.replace(/<si>([\s\S]*?)<\/si>/g, (_m, b) => { ss.push([...b.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")); return ""; });
}
const dec = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function parseRef(chemin) {
  const xml = z.file(chemin);
  return xml.async("string").then((full) => {
    const out = [];
    for (const [, rn, body] of [...full.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)]) {
      const R = Number(rn);
      if (R < 7) continue;
      const cells = {};
      for (const m of body.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const col = m[1], attrs = m[2] || "", inner = m[3] || "";
        const t = (attrs.match(/ t="([^"]+)"/) || [])[1] || "n";
        const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (v === undefined) continue;
        cells[col] = t === "s" ? dec(ss[Number(v)] ?? "") : dec(v);
      }
      const nom = cells.D;
      if (!nom) continue;
      out.push({ ligne: R, cat: cells.B || "", nom, colisage: cells.E, unite: cells.K, pu: cells.L, valeur: cells.M });
    }
    return out;
  });
}
const refInitial = await parseRef("xl/worksheets/sheet2.xml");
const refFinal = await parseRef("xl/worksheets/sheet8.xml");
console.log(`référence : Inventaire initial ${refInitial.length} lignes (L7→L${refInitial.at(-1)?.ligne}), Inventaire Final ${refFinal.length} lignes`);

// ── généré ──
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (c) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(c); return r ? JSON.parse(r.v) : null; };
const wbx = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
const rows0 = XLSX.utils.sheet_to_json(wbx.Sheets.inventaire, { header: 1, defval: null });
const modele = rows0.slice(6).filter((r) => r[3] && r[14]).map((r) => ({ name: r[3], code: r[14], categorie: r[1] || "", conditionnement: typeof r[4] === "number" ? r[4] : 1, qteInner: typeof r[5] === "number" ? r[5] : 0, unite: r[10] || "" }));
const arts = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles").all();
const byCode = new Map(), byName = new Map();
arts.forEach((a) => { if (a.code) byCode.set(norm(a.code), a); if (a.nom) byName.set(norm(a.nom), a); });
const ordered = enrichirAvecBaseLocale(modele.map((m) => {
  const s = byCode.get(norm(m.code)) || byName.get(norm(m.name));
  return { ...(s || {}), nom: m.name, code: m.code, categorie: m.categorie, conditionnement: m.conditionnement, qteInner: m.qteInner, unite: m.unite || s?.unite || "" };
}), charge("bk_sia_local_articles_v1") || {});
const wb = buildModelesWb(ordered, (charge("bk_sia_ratios_parsed_v1") || {}).allProducts || [], "BK1", "Octobre 2026", "", ["BK1"], charge("bk_sia_pmix_complement_v1") || {}, arts);
const gen = (nomFeuille) => {
  const ws = wb.Sheets[nomFeuille];
  const o = [];
  for (let R = 7; ; R++) {
    const c = ws["A" + R]?.v;
    if (!c || String(c).startsWith("TOTAL")) break;
    o.push({ ligne: R, cat: String(c), nom: String(ws["C" + R]?.v ?? ""), colisage: ws["D" + R]?.v, unite: String(ws["J" + R]?.v ?? ""), pu: ws["K" + R]?.v });
  }
  return o;
};
const genInitial = gen("Inventaire Initial");
console.log(`généré : Inventaire Initial ${genInitial.length} lignes (L7→L${genInitial.at(-1)?.ligne})`);

const parNomGen = new Map();
genInitial.forEach((l) => parNomGen.set(norm(l.nom), l));

// ── colisages du modèle (généré) vs référence ──
let communs = 0, condDiff = [], condRefAbsents = [], puDiff = [], uniteDiff = [];
genInitial.forEach((g) => {
  const r = refInitial.find((x) => norm(x.nom) === norm(g.nom));
  if (!r) { condRefAbsents.push(g.nom); return; }
  communs++;
  const nb=(v)=>(v===undefined||v===null||v===""?null:Number(v));
  if (nb(r.colisage) !== nb(g.colisage)) condDiff.push({ nom: g.nom, ref: r.colisage, gen: g.colisage, ligneRef: r.ligne, ligneGen: g.ligne });
  const ru = norm(r.unite), gu = norm(g.unite);
  if (ru !== gu) uniteDiff.push({ nom: g.nom, ref: r.unite, gen: g.unite });
  if (Number.isFinite(Number(r.pu)) && Number.isFinite(Number(g.pu)) && Math.abs(Number(r.pu) - Number(g.pu)) > 0.5) puDiff.push({ nom: g.nom, ref: Number(r.pu), gen: Number(g.pu) });
});
console.log(`\narticles communs : ${communs} · présents seulement dans le généré : ${condRefAbsents.length}`);
console.log(`COLISAGE différents : ${condDiff.length}`);
condDiff.slice(0, 25).forEach((d) => console.log(`  ${JSON.stringify(d.nom).padEnd(38)} réf L${d.ligneRef}=${d.ref}  généré L${d.ligneGen}=${d.gen}`));
console.log(`UNITÉ ("Carton de N") différents : ${uniteDiff.length}`);
uniteDiff.slice(0, 15).forEach((d) => console.log(`  ${JSON.stringify(d.nom).padEnd(38)} réf=${JSON.stringify(d.ref)}  généré=${JSON.stringify(d.gen)}`));
console.log(`Prix unitaire différents (> 0,5 F) : ${puDiff.length}`);
puDiff.slice(0, 30).forEach((d) => console.log(`  ${JSON.stringify(d.nom).padEnd(38)} réf=${d.ref.toFixed(2)}  généré=${d.gen.toFixed(2)}`));
console.log(`\nabsents de la référence (extrait) : ${condRefAbsents.slice(0, 12).join(" | ")}`);
