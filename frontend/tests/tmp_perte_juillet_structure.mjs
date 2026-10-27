// SONDE lecture seule — modèle « Pertes » du CDG (PERTE JULLET.xlsx) :
// en-têtes compacts, tableaux Excel structurés (XML), profil de colonnes, bas de feuille.
// Exécution : node tests/tmp_perte_juillet_structure.mjs [feuille=BK1]
import fs from "node:fs";
import JSZip from "jszip";
import XLSX from "xlsx-js-style";

const DIR = "C:/Users/arnaud.nzue/Downloads/files (12)/recahierdeschargesfonctionnelautomatisationdelava/";
const FICHIER = "PERTE JULLET.xlsx";
const FEUILLE = process.argv[2] || "BK1";
const buf = fs.readFileSync(DIR + FICHIER);

// ── 1. Tableaux structurés déclarés dans le XML ────────────────────────────────
const zip = await JSZip.loadAsync(buf);
const wbXml = await zip.file("xl/workbook.xml").async("string");
const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
const rels = [...relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => ({ id: m[1], t: m[2] }));
const feuilles = [...wbXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((m) => {
  const rel = rels.find((r) => r.id === m[2]);
  return { nom: m[1], cible: rel && rel.t };
});
const cheminDe = feuilles.find((f) => f.nom === FEUILLE).cible.replace(/\/xl\//, "").replace(/^\//, "");
const path = "xl/" + cheminDe.replace(/^xl\//, "");
console.log("chemin XML feuille", FEUILLE, ":", path);
const xml = await zip.file(path).async("string");
const tableRel = (xml.match(/<tableParts>[\s\S]*?<\/tableParts>/) || ["aucun"])[0];
console.log("tableParts :", tableRel.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
const tableFiles = [];
for (const f of Object.keys(zip.files)) if (/^xl\/tables\/table\d+\.xml$/.test(f)) tableFiles.push(f);
for (const f of tableFiles.sort()) {
  const t = await zip.file(f).async("string");
  const name = (t.match(/name="([^"]+)"/) || [])[1];
  const ref = (t.match(/ref="([^"]+)"/) || [])[1];
  const header = (t.match(/headerRowCount="(\d+)"/) || [])[1];
  const totals = (t.match(/totalsRowCount="(\d+)"/) || [])[1];
  const cols = [...t.matchAll(/<tableColumn[^>]*name="([^"]*)"/g)].map((m) => m[1]);
  const calc = [...t.matchAll(/<calculatedColumnFormula>([\s\S]*?)<\/calculatedColumnFormula>/g)].map((m) => m[1]);
  console.log(`  ${f} : ${name} ref=${ref} headerRow=${header} totalsRow=${totals} colonnes=${cols.length}`);
  console.log(`    noms : ${JSON.stringify(cols)}`);
  if (calc.length) console.log(`    formules calculées (${calc.length}) : ${JSON.stringify(calc.slice(0, 4))}`);
}

// ── 2. En-têtes et premières lignes de données, version compacte ───────────────
const wb = XLSX.read(buf, { type: "buffer", cellNF: true });
const ws = wb.Sheets[FEUILLE];
const range = XLSX.utils.decode_range(ws["!ref"]);
const LET = XLSX.utils.encode_col;
const court = (s, n = 22) => (s.length > n ? s.slice(0, n) + "…" : s);
const cellule = (addr) => {
  const c = ws[addr];
  if (!c) return null;
  const v = c.w !== undefined ? c.w : String(c.v);
  return `${court(String(v), 18)}${c.f ? " {" + court(c.f, 46) + "}" : ""}${c.z && c.z !== "General" ? " [" + court(c.z, 14) + "]" : ""}`;
};
console.log(`\n=== lignes 1..8, colonnes B..I (journalières résumées) ===`);
for (let r = 0; r <= 7; r++) {
  const fixes = ["B", "C", "D", "E", "F", "G", "H", "I"].map((col) => `${col}=${cellule(col + (r + 1)) || "-"}`).join("  ");
  const jours = [];
  for (let c = 9; c <= range.e.c; c++) {
    const x = cellule(LET(c) + (r + 1));
    if (x) jours.push(`${LET(c)}=${x}`);
  }
  console.log(`L${r + 1} : ${fixes}\n      jours (${jours.length}) : ${court(jours.slice(0, 6).join("  "), 200)}`);
}

// ── 3. Profil de colonnes sur les lignes de données (ligne 7 → fin) ────────────
console.log(`\n=== profil de colonnes (L7..L${range.e.r + 1}) ===`);
for (let c = range.s.c; c <= Math.min(range.e.c, 8); c++) {
  const col = LET(c);
  const vals = [];
  for (let r = 6; r <= range.e.r; r++) {
    const cell = ws[col + (r + 1)];
    if (cell && cell.t !== "e") vals.push(cell);
  }
  const types = {};
  vals.forEach((x) => (types[x.t] = (types[x.t] || 0) + 1));
  const ex = vals.slice(0, 5).map((x) => String(x.w ?? x.v));
  console.log(`  ${col} : ${vals.length} valeurs ${JSON.stringify(types)} | ${JSON.stringify(ex)}`);
}

// ── 4. Bas de feuille : 8 dernières lignes avec du contenu ─────────────────────
console.log(`\n=== contenu des 8 dernières lignes non vides ===`);
const avecContenu = [];
for (let r = range.s.r; r <= range.e.r; r++) {
  let n = 0;
  for (let c = range.s.c; c <= range.e.c; c++) if (ws[LET(c) + (r + 1)]) n++;
  avecContenu.push({ r: r + 1, n });
}
const dernieres = avecContenu.filter((x) => x.n > 0).slice(-8);
console.log("lignes non vides :", avecContenu.filter((x) => x.n > 0).length, "| vides :", avecContenu.filter((x) => x.n === 0).length);
for (const { r } of dernieres) {
  const cells = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const x = cellule(LET(c) + r);
    if (x) cells.push(`${LET(c)}${r}=${x}`);
  }
  console.log(`L${r} (${cells.length}) : ${court(cells.slice(0, 10).join("  "), 300)}`);
}

// ── 5. Colonne « Prix pièce » : formule et origine ────────────────────────────
console.log(`\n=== échantillon de 6 lignes de données (colonnes B..I + J) ===`);
let vues = 0;
for (let r = 6; r <= range.e.r && vues < 6; r++) {
  if (!ws["C" + (r + 1)]) continue;
  vues++;
  const cells = ["B", "C", "D", "E", "F", "G", "H", "I", "J"].map((col) => `${col}=${cellule(col + (r + 1)) || "-"}`);
  console.log(`L${r + 1} : ${court(cells.join("  "), 300)}`);
}
