// SONDE — 1) ordre des lignes « Inventaire initial » du CDG vs notre feuille générée
//           2) génère src/utils/inventaireReferentielCdg.js (323 lignes L7→L330, colonnes B/C/D/E/F/K/L)
// Exécution : node tests/tmp_exact_inv_module.mjs [--write]
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
const full = await z.file("xl/worksheets/sheet2.xml").async("string");
const table = [];
for (const m of full.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const R = Number(m[1]); if (R < 7) continue;
  const cells = {};
  for (const c of m[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const t = (c[2].match(/ t="([^"]+)"/) || [])[1] || "n";
    const v = ((c[3] || "").match(/<v>([\s\S]*?)<\/v>/) || [])[1];
    if (v === undefined) continue;
    cells[c[1]] = t === "s" ? dec(ss[Number(v)] ?? "") : dec(v);
  }
  if (!cells.D || !cells.B) continue;   // la table s'arrête où la catégorie s'arrête (le récap du CDG n'a pas de colonne B)
  const o = { ligne: R, cat: cells.B || "", frns: cells.C || "", nom: cells.D };
  if (cells.E !== undefined && cells.E !== "") o.cond = Number(cells.E);
  if (cells.F !== undefined && cells.F !== "") o.inner = Number(cells.F);
  if (cells.K !== undefined) o.unite = cells.K;
  if (cells.L !== undefined && cells.L !== "") o.pu = Number(cells.L);
  table.push(o);
}
console.log(`table Inventaire initial du CDG : ${table.length} lignes (L${table[0]?.ligne}→L${table.at(-1)?.ligne})`);
console.log(`  avec colisage : ${table.filter((t) => t.cond !== undefined).length} · avec inner : ${table.filter((t) => t.inner !== undefined).length} · avec prix : ${table.filter((t) => t.pu !== undefined).length}`);

// notre feuille générée
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (c) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(c); return r ? JSON.parse(r.v) : null; };
const wbx = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
const rows0 = XLSX.utils.sheet_to_json(wbx.Sheets.inventaire, { header: 1, defval: null });
const modele = rows0.slice(6).filter((r) => r[3] && r[14]).map((r) => ({ name: r[3], code: r[14], categorie: r[1] || "", conditionnement: typeof r[4] === "number" ? r[4] : 1, qteInner: typeof r[5] === "number" ? r[5] : 0, unite: r[10] || "" }));
const arts = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles").all();
const byCode = new Map(), byName = new Map();
arts.forEach((a) => { if (a.code) byCode.set(norm(a.code), a); if (a.nom) byName.set(norm(a.nom), a); });
const ordered = enrichirAvecBaseLocale(modele.map((m) => { const s = byCode.get(norm(m.code)) || byName.get(norm(m.name)); return { ...(s || {}), nom: m.name, code: m.code, categorie: m.categorie, conditionnement: m.conditionnement, qteInner: m.qteInner, unite: m.unite || s?.unite || "" }; }), charge("bk_sia_local_articles_v1") || {});
const wb = buildModelesWb(ordered, (charge("bk_sia_ratios_parsed_v1") || {}).allProducts || [], "BK1", "Octobre 2026", "", ["BK1"], charge("bk_sia_pmix_complement_v1") || {}, arts);
const ws = wb.Sheets["Inventaire Initial"];
const gen = [];
for (let R = 7; ; R++) {
  if (!ws["A" + R]?.v) break;
  const nom = String(ws["C" + R]?.v ?? ""); if (!nom) break;
  gen.push({ ligne: R, nom, cond: ws["D" + R]?.v, inner: ws["E" + R]?.v, unite: ws["J" + R]?.v, pu: ws["K" + R]?.v });
}
console.log(`généré : ${gen.length} lignes (L7→L${gen.at(-1)?.ligne})`);

// ordre : comparaison ligne à ligne sur les deux listes
const parNomGen = new Map(gen.map((g, i) => [norm(g.nom), i]));
let dansRef = 0, horsOrdre = [];
table.forEach((t, i) => {
  const j = parNomGen.get(norm(t.nom));
  if (j === undefined) return;
  dansRef++;
  if (j !== i) horsOrdre.push(`${t.nom} : réf L${t.ligne} (index ${i}) vs généré L${gen[j].ligne} (index ${j})`);
});
console.log(`\nordre : ${dansRef} lignes communes · décalages index : ${horsOrdre.length}`);
// L'ordre des lignes communes est-il le même (simple décalage dû aux lignes absentes) ?
const seq = table.map((t) => parNomGen.get(norm(t.nom))).filter((j) => j !== undefined);
let inv = 0;
for (let i = 0; i < seq.length; i++) for (let k = i + 1; k < seq.length; k++) if (seq[i] > seq[k]) inv++;
const maxDecal = Math.max(...seq.map((j, i) => Math.abs(j - i)));
console.log(`inversions d'ordre entre les deux listes : ${inv} · plus grand décalage index : ${maxDecal}`);
horsOrdre.slice(0, 10).forEach((h) => console.log("  " + h));
const absentsGen = table.filter((t) => !parNomGen.has(norm(t.nom)));
const absentsRef = gen.filter((g) => !table.some((t) => norm(t.nom) === norm(g.nom)));
console.log(`absents de notre feuille : ${absentsGen.length} → ${absentsGen.slice(0, 12).map((t) => t.nom).join(" | ")}`);
console.log(`absents de la référence : ${absentsRef.length} → ${absentsRef.slice(0, 12).map((g) => g.nom).join(" | ")}`);

if (process.argv.includes("--write")) {
  const lignes = table.map((t) => {
    const parts = [`cat: ${JSON.stringify(t.cat)}`, `frns: ${JSON.stringify(t.frns)}`, `nom: ${JSON.stringify(t.nom)}`];
    if (t.cond !== undefined) parts.push(`cond: ${t.cond}`);
    if (t.inner !== undefined) parts.push(`inner: ${t.inner}`);
    if (t.unite !== undefined) parts.push(`unite: ${JSON.stringify(t.unite)}`);
    if (t.pu !== undefined) parts.push(`pu: ${t.pu}`);
    return `  { ${parts.join(", ")} },  // L${t.ligne}`;
  });
  const entete = `// Référentiel « Inventaire » du CDG — table reproduite cellule pour cellule de la feuille\n` +
    `// « Inventaire initial » du classeur de référence du CDG (exact/suivis stock BK 1.xlsx,\n` +
    `// relevé du 26/10/2026) : les \${table.length} articles suivis au stock, leur catégorie, leur marque\n` +
    `// (Frns), leur COLISAGE (colonne E), leur « Nb articles / inner » (F), leur unité affichée (K) et\n` +
    `// leur prix unitaire de valorisation (L), ligne à ligne et dans l'ordre du classeur du CDG.\n` +
    `// Un champ absent = cellule vide chez le CDG (ex. 24 lignes sans colisage : produits pesés en\n` +
    `// kilogrammes ou « Unités »).\n` +
    `// Demande du 26/10/2026 : « je produis tout pareil pour notre fichier suivi de stock,\n` +
    `// conditionnement pareil et tout ».\n` +
    `export const INVENTAIRE_REFERENTIEL_CDG = [\n${lignes.join("\n")}\n];\n`;
  fs.writeFileSync(new URL("../src/utils/inventaireReferentielCdg.js", import.meta.url), entete);
  console.log(`\nécrit : src/utils/inventaireReferentielCdg.js (${table.length} lignes)`);
}
