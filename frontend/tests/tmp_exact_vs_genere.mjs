// SONDE lecture seule — confronte la feuille Pertes publiée par le code courant à la feuille
// « Perte_Q1 2026 » du classeur de référence du CDG (files (12)/exact/suivis stock BK 1.xlsx) :
// ligne par ligne, catégorie, désignation, Cond., Prix carton, Unité de perte.
// Exécution : node tests/tmp_exact_vs_genere.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { enrichirAvecBaseLocale } from "../src/utils/parsers.js";

const EXACT = "C:/Users/arnaud.nzue/Downloads/files (12)/exact/suivis stock BK 1.xlsx";
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (c) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(c); return r ? JSON.parse(r.v) : null; };
const norm = (s) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g,"");

// ── A. Référence CDG ───────────────────────────────────────────────────────────
const wsRef = XLSX.read(fs.readFileSync(EXACT), { type: "buffer" }).Sheets["Perte_Q1 2026"];
const ref = [];
for (let r = 5; r <= 200; r++) {
  const nom = wsRef["C" + r]?.v;
  if (nom === undefined || String(nom).trim() === "") continue;
  ref.push({ ligne: r, cat: String(wsRef["B" + r]?.v ?? ""), nom: String(nom), cond: wsRef["D" + r]?.v, pu: wsRef["E" + r]?.v, unite: String(wsRef["G" + r]?.v ?? "") });
}

// ── B. Publication courante ────────────────────────────────────────────────────
const wbx = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
const rows0 = XLSX.utils.sheet_to_json(wbx.Sheets.inventaire, { header: 1, defval: null });
const modele = rows0.slice(6).filter((r) => r[3] && r[14]).map((r) => ({
  name: r[3], code: r[14], categorie: r[1] || "", conditionnement: typeof r[4] === "number" ? r[4] : 1,
  qteInner: typeof r[5] === "number" ? r[5] : 0, unite: r[10] || "",
}));
const arts = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles").all();
const byCode = new Map(), byName = new Map();
arts.forEach((a) => { if (a.code) byCode.set(norm(a.code), a); if (a.nom) byName.set(norm(a.nom), a); });
const ordered0 = modele.map((m) => { const s = byCode.get(norm(m.code)) || byName.get(norm(m.name));
  return { ...(s || {}), nom: m.name, code: m.code, categorie: m.categorie, conditionnement: m.conditionnement, qteInner: m.qteInner, unite: m.unite || s?.unite || "" }; });
const ordered = enrichirAvecBaseLocale(ordered0, charge("bk_sia_local_articles_v1") || {});
const ws = buildModelesWb(ordered, (charge("bk_sia_ratios_parsed_v1") || {}).allProducts || [], "BK1", "Octobre 2026", "", ["BK1"], charge("bk_sia_pmix_complement_v1") || {}, arts).Sheets.Pertes;
const gen = [];
const rg = XLSX.utils.decode_range(ws["!ref"]);
for (let r = 4; r <= rg.e.r; r++) {
  const cell = (c) => ws[XLSX.utils.encode_cell({ r, c })];
  const nom = cell(1)?.v;
  if (nom === undefined || String(nom).trim() === "" || /^TOTAL/i.test(String(nom))) continue;
  gen.push({ ligne: r + 1, cat: String(cell(0)?.v ?? ""), nom: String(nom), cond: cell(2)?.v, pu: cell(3)?.v, unite: String(cell(5)?.v ?? "") });
}

// ── C. Confrontation ligne à ligne, dans l'ordre ───────────────────────────────
console.log(`référence : ${ref.length} lignes (L5→${ref[ref.length - 1].ligne}) | publié : ${gen.length} lignes (L5→${gen[gen.length - 1]?.ligne})`);
const mGen = new Map(), mRef = new Map();
gen.forEach((x) => { const k = norm(x.nom); if (!mGen.has(k)) mGen.set(k, x); });
ref.forEach((x) => { const k = norm(x.nom); if (!mRef.has(k)) mRef.set(k, x); });
const eq = (a, b) => Math.abs(Number(a) - Number(b)) <= Math.max(0.01, Math.abs(Number(b)) * 1e-6);

const absents = ref.filter((x) => !mGen.has(norm(x.nom)));
const sus = gen.filter((x) => !mRef.has(norm(x.nom)));
console.log(`\n── lignes de la référence absentes de la publication (${absents.length}) ──`);
absents.forEach((x) => console.log(`  ref L${x.ligne} [${x.cat}] ${JSON.stringify(x.nom)} cond=${x.cond} pu=${x.pu} unité=${x.unite}`));
console.log(`\n── lignes publiées hors référence (${sus.length}) ──`);
sus.forEach((x) => console.log(`  pub L${x.ligne} [${x.cat}] ${JSON.stringify(x.nom)} cond=${x.cond} pu=${x.pu} unité=${x.unite}`));

let nCat = 0, nCond = 0, nPu = 0, nUn = 0;
const detail = [];
ref.forEach((x) => {
  const g = mGen.get(norm(x.nom));
  if (!g) return;
  const d = [];
  if (norm(g.cat) !== norm(x.cat)) { d.push(`catégorie ${JSON.stringify(x.cat)}→${JSON.stringify(g.cat)}`); nCat++; }
  if (!eq(g.cond, x.cond)) { d.push(`Cond. ${x.cond}→${g.cond}`); nCond++; }
  if (!eq(g.pu, x.pu)) { d.push(`Prix carton ${x.pu}→${g.pu}`); nPu++; }
  if (norm(g.unite) !== norm(x.unite)) { d.push(`Unité ${JSON.stringify(x.unite)}→${JSON.stringify(g.unite)}`); nUn++; }
  if (d.length) detail.push(`  ${JSON.stringify(x.nom).padEnd(42)} (ref L${x.ligne}/pub L${g.ligne}) : ${d.join(" | ")}`);
});
console.log(`\n── champs divergents sur les ${mRef.size} lignes communes : catégorie ${nCat}, Cond. ${nCond}, Prix carton ${nPu}, Unité ${nUn} ──`);
detail.forEach((l) => console.log(l));

const blocs = (l, cle) => { const o = []; l.forEach((x) => { const c = x[cle]; const d = o[o.length - 1];
  if (d && d.cat === c) { d.n++; d.fin = x.ligne; } else o.push({ cat: c, debut: x.ligne, fin: x.ligne, n: 1 }); }); return o; };
console.log("\n── blocs de la référence ──");
blocs(ref, "cat").forEach((b) => console.log(`  ${b.cat} : L${b.debut}→${b.fin} (${b.n})`));
console.log("── blocs publiés ──");
blocs(gen, "cat").forEach((b) => console.log(`  ${b.cat || "(vide)"} : L${b.debut}→${b.fin} (${b.n})`));
const pos = new Map(gen.map((x, i) => [norm(x.nom), i]));
const seq = ref.map((x) => norm(x.nom)).filter((k) => pos.has(k));
let inv = 0;
for (let i = 1; i < seq.length; i++) if (pos.get(seq[i]) < pos.get(seq[i - 1])) inv++;
console.log(`\n── inversions d'ordre consécutives réf→publié : ${inv}`);
const totalRef = { H: wsRef["H197"]?.f, I: wsRef["I197"]?.f, J2: wsRef["J2"]?.f, AO2: wsRef["AO2"]?.f };
console.log(`\n── formules de la référence ──\n  ${JSON.stringify(totalRef)}`);
console.log(`  F5 (Prix pièce) = ${JSON.stringify(wsRef["F5"]?.f)}`);
console.log(`  H5 (Quantité)   = ${JSON.stringify(wsRef["H5"]?.f)}`);
