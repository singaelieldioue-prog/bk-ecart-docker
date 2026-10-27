// SONDE lecture seule — structure du fichier Pertes réel du CDG (PERTE JULLET.xlsx)
// et du fichier CA JUILLET 2026.xlsx, pour inspiration de la feuille Pertes générée.
// Aucune écriture ailleurs que stdout. Exécution : node tests/tmp_perte_juillet.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";

const DIR = "C:/Users/arnaud.nzue/Downloads/files (12)/recahierdeschargesfonctionnelautomatisationdelava/";
const FICHIER = process.argv[2] || "PERTE JULLET.xlsx";
const wb = XLSX.read(fs.readFileSync(DIR + FICHIER), { type: "buffer", cellNF: true, cellStyles: true });

console.log("=== " + FICHIER + " ===");
console.log("feuilles :", wb.SheetNames.join(" | "));
for (const nom of wb.SheetNames) {
  const ws = wb.Sheets[nom];
  if (!ws) { console.log(`  ${nom} : absente`); continue; }
  console.log(`\n--- ${nom} --- ${JSON.stringify(ws["!ref"])} | merges ${JSON.stringify(ws["!merges"] || [])}`);
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const nbCell = Object.keys(ws).filter((k) => k[0] !== "!").length;
  const nbForm = Object.keys(ws).filter((k) => k[0] !== "!" && ws[k].f).length;
  console.log(`  cellules ${nbCell} | formules ${nbForm} | lignes ${range.e.r + 1} colonnes ${range.e.c + 1}`);
}

// Dump intégral des 12 premières lignes de la première feuille (et de la feuille « Pertes » si elle existe)
const cible = process.argv[3] || wb.SheetNames.find((n) => /perte/i.test(n)) || wb.SheetNames[0];
const ws = wb.Sheets[cible];
const range = XLSX.utils.decode_range(ws["!ref"]);
const LET = XLSX.utils.encode_col;
console.log(`\n=== dump feuille « ${cible} » lignes 1..12 ===`);
for (let r = range.s.r; r <= Math.min(range.s.r + 11, range.e.r); r++) {
  const cells = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = LET(c) + (r + 1);
    const cell = ws[addr];
    if (!cell) continue;
    const v = cell.w !== undefined ? cell.w : String(cell.v);
    cells.push(`${addr}=${JSON.stringify(v)}${cell.f ? " {" + cell.f + "}" : ""}${cell.z ? " [" + cell.z + "]" : ""}`);
  }
  console.log(`L${r + 1} (${cells.length}) : ${cells.join("  ")}`);
}

console.log(`\n=== dump feuille « ${cible} » 12 dernières lignes non vides ===`);
const lignesVides = [];
for (let r = range.s.r; r <= range.e.r; r++) {
  let n = 0;
  for (let c = range.s.c; c <= range.e.c; c++) if (ws[LET(c) + (r + 1)]) n++;
  if (n === 0) lignesVides.push(r + 1);
}
console.log("lignes entièrement vides :", lignesVides.length, JSON.stringify(lignesVides.slice(0, 30)));
for (let r = Math.max(range.s.r, range.e.r - 11); r <= range.e.r; r++) {
  const cells = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = LET(c) + (r + 1);
    const cell = ws[addr];
    if (!cell) continue;
    const v = cell.w !== undefined ? cell.w : String(cell.v);
    cells.push(`${addr}=${JSON.stringify(v)}${cell.f ? " {" + cell.f + "}" : ""}${cell.z ? " [" + cell.z + "]" : ""}`);
  }
  console.log(`L${r + 1} (${cells.length}) : ${cells.join("  ")}`);
}

// Profil des colonnes : sur les lignes de données (7..dernière), type dominant + exemples
console.log(`\n=== profil de colonnes (feuille « ${cible} ») ===`);
for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 12); c++) {
  const col = LET(c);
  const vals = [];
  for (let r = 6; r <= range.e.r; r++) {
    const cell = ws[col + (r + 1)];
    if (cell && cell.t !== "e") vals.push(cell);
  }
  const types = {};
  vals.forEach((x) => (types[x.t] = (types[x.t] || 0) + 1));
  const ex = vals.slice(0, 4).map((x) => `${x.w ?? x.v}${x.f ? "{f}" : ""}`);
  console.log(`  ${col} : ${vals.length} valeurs ${JSON.stringify(types)} | ${JSON.stringify(ex)}`);
}
