// SONDE lecture seule — comparaison du modèle Pertes du CDG (PERTE JULLET.xlsx) avec la
// feuille Pertes générée par l'app. Points visés : colonne de total (AO/AP), ligne 1 « CA HT »,
// ligne 197 sous-totaux, contenu des 189 désignations, et origine du CA (CA JUILLET 2026.xlsx).
// Exécution : node tests/tmp_perte_juillet_comparaison.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";

const DIR = "C:/Users/arnaud.nzue/Downloads/files (12)/recahierdeschargesfonctionnelautomatisationdelava/";
const wb = XLSX.read(fs.readFileSync(DIR + "PERTE JULLET.xlsx"), { type: "buffer", cellNF: true });
const court = (s, n = 60) => (String(s).length > n ? String(s).slice(0, n) + "…" : String(s));

// 1. Colonnes de total : AO et AP sur les lignes 1..4 pour BK1 (et BK7/BK8, qui ont une colonne de plus)
for (const nom of ["BK1", "BK7", "BK8"]) {
  const ws = wb.Sheets[nom];
  const l = [];
  for (let r = 1; r <= 4; r++) {
    for (const col of ["AN", "AO", "AP"]) {
      const c = ws[col + r];
      if (c) l.push(`${col}${r}=${court(c.w ?? c.v, 14)}${c.f ? "{" + court(c.f, 40) + "}" : ""}[${court(c.z ?? "General", 10)}]`);
    }
  }
  console.log(`${nom} : ${JSON.stringify(l)}`);
}

// 2. Lignes 1..3 complètes BK1 : quelles colonnes fixes portent un contenu ?
const ws1 = wb.Sheets.BK1;
for (let r = 1; r <= 3; r++) {
  const cols = [];
  for (let c = 1; c <= 41; c++) {
    const addr = XLSX.utils.encode_col(c) + r;
    if (ws1[addr]) cols.push(addr);
  }
  console.log(`BK1 L${r} : ${cols.length} cellules ${JSON.stringify(cols.slice(0, 3))}…${JSON.stringify(cols.slice(-2))}`);
}

// 3. Inventaire des désignations : catégories, nombre de lignes, unité de perte
const ws = wb.Sheets.BK1;
const lignes = [];
for (let r = 5; r <= 197; r++) {
  const cat = ws["B" + r]?.v;
  const nom = ws["C" + r]?.v;
  if (nom === undefined && cat === undefined) continue;
  lignes.push({ r, cat, nom, cond: ws["D" + r]?.v, puCarton: ws["E" + r]?.v, puPiece: ws["F" + r]?.v, unite: ws["G" + r]?.v });
}
const parCat = new Map();
lignes.forEach((x) => parCat.set(String(x.cat ?? "(vide)"), (parCat.get(String(x.cat ?? "(vide)")) || 0) + 1));
console.log(`\nBK1 lignes 5..197 retenues : ${lignes.length}`);
console.log("catégories :", JSON.stringify([...parCat.entries()]));
console.log("Cond. non numérique :", JSON.stringify(lignes.filter((x) => x.cond !== undefined && typeof x.cond !== "number").map((x) => x.nom).slice(0, 10)));
console.log("Prix carton renseignés :", lignes.filter((x) => typeof x.puCarton === "number" && x.puCarton !== 0).length);
console.log("Prix pièce renseignés :", lignes.filter((x) => typeof x.puPiece === "number" && x.puPiece !== 0).length);
console.log("unités distinctes :", JSON.stringify([...new Set(lignes.map((x) => JSON.stringify(x.unite)))]));
const avecSaisie = lignes.filter((x) => {
  for (let c = 9; c <= 39; c++) {
    const v = ws[XLSX.utils.encode_col(c) + x.r];
    if (v && typeof v.v === "number" && v.v !== 0) return true;
  }
  return false;
});
console.log("lignes avec une quantité ≠ 0 un jour :", avecSaisie.length, JSON.stringify(avecSaisie.slice(0, 12).map((x) => `${x.nom} (${x.cat})`)));

// 4. CA JUILLET 2026.xlsx — le CA HT saisi vient-il de là ?
const wCA = XLSX.read(fs.readFileSync(DIR + "CA JUILLET 2026.xlsx"), { type: "buffer", cellNF: true });
console.log(`\nCA JUILLET : feuilles ${JSON.stringify(wCA.SheetNames)}`);
for (const nom of wCA.SheetNames) {
  const s = wCA.Sheets[nom];
  const rg = XLSX.utils.decode_range(s["!ref"]);
  console.log(`--- ${nom} ${JSON.stringify(s["!ref"])}`);
  for (let r = rg.s.r; r <= Math.min(rg.s.r + 6, rg.e.r); r++) {
    const cells = [];
    for (let c = rg.s.c; c <= rg.e.c; c++) {
      const addr = XLSX.utils.encode_col(c) + (r + 1);
      if (s[addr]) cells.push(`${addr}=${court(s[addr].w ?? s[addr].v, 16)}`);
    }
    console.log(`  L${r + 1} (${cells.length}) : ${court(cells.slice(0, 12).join(" "), 240)}`);
  }
}

// 5. Le CA HT de BK1 ligne 1 est-il la somme du fichier CA ?
const caBK1 = [];
for (let c = 9; c <= 39; c++) caBK1.push(ws1[XLSX.utils.encode_col(c) + "1"]?.v);
console.log(`\nBK1 J1..AN1 : ${caBK1.filter((x) => x !== undefined).length} valeurs, somme = ${caBK1.reduce((a, b) => a + (Number(b) || 0), 0)}`);
