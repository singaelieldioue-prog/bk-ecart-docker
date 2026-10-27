// SONDE lecture seule — confronte la liste et la géométrie de la feuille Pertes générée
// (tmp_verif/Suivi_BK1_Octobre_2026.xlsx, sheet5.xml) avec le modèle du CDG (PERTE JULLET.xlsx, BK1).
// Exécution : node tests/tmp_perte_juillet_vs_genere.mjs
import fs from "node:fs";
import JSZip from "jszip";
import XLSX from "xlsx-js-style";

const DIR = "C:/Users/arnaud.nzue/Downloads/files (12)/recahierdeschargesfonctionnelautomatisationdelava/";
const norm = (s) => String(s ?? "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");

// ── A. Feuille générée : géométrie réelle lue dans le XML (xlsx-js-style ne met pas de cache) ──
const zGen = await JSZip.loadAsync(fs.readFileSync(new URL("../../tmp_verif/Suivi_BK1_Octobre_2026.xlsx", import.meta.url)));
const xmlGen = await zGen.file("xl/worksheets/sheet5.xml").async("string");
const parse = (xml) => {
  const lignes = {};
  for (const m of xml.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const r = Number(m[1]);
    lignes[r] = {};
    for (const c of m[2].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const body = c[4] || "";
      const f = (body.match(/<f[^>]*>([\s\S]*?)<\/f>/) || [])[1];
      const v = (body.match(/<v[^>]*>([\s\S]*?)<\/v>/) || [])[1];
      lignes[r][c[1]] = { f, v, t: (c[3].match(/t="([^"]+)"/) || [])[1], z: (c[3].match(/s="(\d+)"/) || [])[1] };
    }
  }
  return lignes;
};
const G = parse(xmlGen);
console.log("=== Feuille Pertes GÉNÉRÉE (tmp_verif) — lignes 1..5 ===");
for (let r = 1; r <= 5; r++) {
  const cells = Object.entries(G[r] || {}).map(([c, x]) => `${c}=${x.v !== undefined ? JSON.stringify(x.v) : ""}${x.f ? "{f:" + x.f.slice(0, 42) + "}" : ""}`);
  console.log(`L${r} (${cells.length}) : ${cells.slice(0, 14).join(" ")}`);
}
const derniereGen = Math.max(...Object.keys(G).map(Number));
const decode = (s) =>
  String(s ?? "")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
console.log(`dernière ligne XML : ${derniereGen}`);
const totalGen = Object.entries(G[derniereGen] || {}).map(([c, x]) => `${c}=${x.v ?? ""}${x.f ? "{f:" + x.f.slice(0, 40) + "}" : ""}`);
console.log(`ligne ${derniereGen} : ${JSON.stringify(totalGen)}`);

// Liste générée (colonne B = nom, A = catégorie)
const listeGen = [];
for (let r = 5; r <= derniereGen; r++) {
  const nom = decode(G[r]?.B?.v);
  if (nom !== undefined && nom !== "") listeGen.push({ r, cat: decode(G[r]?.A?.v), nom, cond: G[r]?.C?.v, pu: G[r]?.D?.v, unite: decode(G[r]?.F?.v) });
}
const parCatGen = new Map();
listeGen.forEach((x) => parCatGen.set(String(x.cat ?? "(vide)"), (parCatGen.get(String(x.cat ?? "(vide)")) || 0) + 1));
console.log(`lignes de données générées : ${listeGen.length} | catégories ${JSON.stringify([...parCatGen.entries()])}`);
console.log(`unités de perte générées (10 premières) : ${JSON.stringify([...new Set(listeGen.map((x) => x.unite))].slice(0, 12))}`);

// ── B. Modèle CDG : liste BK1 ──
const wb = XLSX.read(fs.readFileSync(DIR + "PERTE JULLET.xlsx"), { type: "buffer" });
const ws = wb.Sheets.BK1;
const listeCdg = [];
for (let r = 5; r <= 196; r++) {
  const nom = ws["C" + r]?.v;
  if (nom === undefined || String(nom).trim() === "") continue;
  listeCdg.push({ r, cat: ws["B" + r]?.v, nom, cond: ws["D" + r]?.v, unite: ws["G" + r]?.v });
}
const parCatCdg = new Map();
listeCdg.forEach((x) => parCatCdg.set(String(x.cat ?? "(vide)"), (parCatCdg.get(String(x.cat ?? "(vide)")) || 0) + 1));
console.log(`\n=== Modèle CDG (BK1) — ${listeCdg.length} lignes | catégories ${JSON.stringify([...parCatCdg.entries()])}`);
console.log(`unités CDG : ${JSON.stringify([...new Set(listeCdg.map((x) => x.unite))])}`);

// ── C. Diff des listes ──
const setGen = new Map(listeGen.map((x) => [norm(x.nom), x]));
const setCdg = new Map(listeCdg.map((x) => [norm(x.nom), x]));
const dansCdgPasGen = listeCdg.filter((x) => !setGen.has(norm(x.nom)));
const dansGenPasCdg = listeGen.filter((x) => !setCdg.has(norm(x.nom)));
console.log(`\nabsentes de la génération (${dansCdgPasGen.length}) :`);
dansCdgPasGen.forEach((x) => console.log(`  L${x.r} [${x.cat}] ${x.nom} (cond. ${x.cond}, unité ${JSON.stringify(x.unite)})`));
console.log(`\nprésentes seulement dans la génération (${dansGenPasCdg.length}) :`);
dansGenPasCdg.forEach((x) => console.log(`  L${x.r} [${x.cat}] ${x.nom}`));

// ── D. Cond. divergent sur les noms communs ──
const condDiff = [];
listeCdg.forEach((x) => {
  const g = setGen.get(norm(x.nom));
  if (!g) return;
  const a = Number(g.cond), b = Number(x.cond);
  if (Number.isFinite(a) && Number.isFinite(b) && a !== b) condDiff.push({ nom: x.nom, gen: a, cdg: b });
});
console.log(`\nconditionnements divergents sur noms communs : ${condDiff.length}`);
condDiff.slice(0, 25).forEach((x) => console.log(`  ${x.nom} : généré ${x.gen} vs CDG ${x.cdg}`));

// ── E. Catégories CDG vs nôtres (libellés) ──
console.log(`\ncatégories générées : ${JSON.stringify([...parCatGen.keys()])}`);
console.log(`catégories CDG      : ${JSON.stringify([...parCatCdg.keys()])}`);
