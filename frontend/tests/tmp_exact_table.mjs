// Sonde lecture seule : table exacte de la feuille `Perte_Q1 2026` du classeur de référence
// (exact/suivis stock BK 1.xlsx) — catégorie, nom, Cond., Prix carton, Unité de perte, avec
// l'adresse de la cellule source. Exécution : node tests/tmp_exact_table.mjs [chunk|json]
import fs from "node:fs";
import XLSX from "xlsx-js-style";

const REF = "C:/Users/arnaud.nzue/Downloads/files (12)/exact/suivis stock BK 1.xlsx";
const wb = XLSX.read(fs.readFileSync(REF), { type: "buffer" });
const ws = wb.Sheets["Perte_Q1 2026"];
const g = (ref) => ws[ref];
const lignes = [];
for (let r = 5; r <= 195; r++) {
  const cat = g("B" + r)?.v, nom = g("C" + r)?.v, cond = g("D" + r)?.v;
  const pu = g("E" + r)?.v, up = g("G" + r)?.v;
  if (nom === undefined || String(nom).trim() === "") continue;
  lignes.push({ ligne: r, cellB: "B" + r, cellC: "C" + r, cellD: "D" + r, cellE: "E" + r, cellG: "G" + r,
    cat: cat ?? null, nom: String(nom), cond: cond ?? null, pu: pu ?? null, unite: up ?? null });
}
if (process.argv[2] === "json") {
  fs.writeFileSync(new URL("./tmp_exact_table.json", import.meta.url), JSON.stringify(lignes, null, 1));
}
const parCat = new Map();
lignes.forEach((l) => parCat.set(l.cat, (parCat.get(l.cat) || 0) + 1));
console.log(`lignes : ${lignes.length} (5→${lignes[lignes.length - 1].ligne})`);
console.log(`catégories : ${JSON.stringify([...parCat.entries()])}`);
const sansPrix = lignes.filter((l) => !(Number(l.pu) > 0));
console.log(`prix carton absents ou nuls : ${sansPrix.length} → ${JSON.stringify(sansPrix.map((l) => l.ligne + ":" + l.nom))}`);
const condAbsents = lignes.filter((l) => !(Number(l.cond) > 0));
console.log(`Cond. absents ou nuls : ${condAbsents.length} → ${JSON.stringify(condAbsents.map((l) => l.ligne + ":" + l.nom))}`);
console.log(`unités : ${JSON.stringify([...new Set(lignes.map((l) => l.unite))])}`);
const dups = new Map();
lignes.forEach((l) => { const k = String(l.nom).trim().toLowerCase(); dups.set(k, (dups.get(k) || 0) + 1); });
console.log(`doublons de désignations : ${JSON.stringify([...dups.entries()].filter(([, n]) => n > 1))}`);
console.log("\n── table complète ──");
lignes.forEach((l) => console.log(`${l.ligne} | ${JSON.stringify(l.cat)} | ${JSON.stringify(l.nom)} | ${l.cond} | ${l.pu} | ${JSON.stringify(l.unite)}`));
