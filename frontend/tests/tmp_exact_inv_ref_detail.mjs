// SONDE lecture seule — lignes détaillées de « Inventaire initial » (CDG) pour les articles où
// notre généré diverge : colisage vide, prix à 0, unités de pesée.
// Exécution : node tests/tmp_exact_inv_ref_detail.mjs
import fs from "node:fs";
import JSZip from "jszip";

const REF = "C:/Users/arnaud.nzue/Downloads/files (12)/exact/suivis stock BK 1.xlsx";
const norm = (s) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const z = await JSZip.loadAsync(fs.readFileSync(REF));
const ss = [];
{ const s = await z.file("xl/sharedStrings.xml").async("string"); s.replace(/<si>([\s\S]*?)<\/si>/g, (_m, b) => { ss.push([...b.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")); return ""; }); }
const dec = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const full = await z.file("xl/worksheets/sheet2.xml").async("string");
const rows = new Map();
for (const m of full.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const cells = {};
  for (const c of m[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const t = (c[2].match(/ t="([^"]+)"/) || [])[1] || "n";
    const f = ((c[3] || "").match(/<f[^>]*>([\s\S]*?)<\/f>/) || [])[1];
    const v = ((c[3] || "").match(/<v>([\s\S]*?)<\/v>/) || [])[1];
    cells[c[1]] = f ? `=${dec(f)}` : v === undefined ? "" : t === "s" ? dec(ss[Number(v)] ?? "") : dec(v);
  }
  rows.set(Number(m[1]), cells);
}
const data = [...rows.entries()].filter(([R, c]) => R >= 7 && c.D);
console.log(`lignes de données : ${data.length} (L${data[0][0]}→L${data.at(-1)[0]})`);
const vide = data.filter(([, c]) => c.E === "" || c.E === undefined);
const puZero = data.filter(([, c]) => c.L !== "" && Number(c.L) === 0);
const puVide = data.filter(([, c]) => c.L === "");
console.log(`  COLISAGE (E) vide : ${vide.length} · Prix Unitaire (L) à 0 : ${puZero.length} · vide : ${puVide.length}`);
console.log(`  E vides : ${vide.slice(0, 20).map(([, c]) => c.D).join(" | ")}`);
console.log(`  L à 0 : ${puZero.slice(0, 20).map(([, c]) => c.D).join(" | ")}`);
const COLS = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S"];
for (const nom of ["OIGNONS NON EPLUCHES", "TOMATES PFI", "FRITES", "MILO", "THE", "LAIT en Brique", "EAU", "CHILI CHEESE BITES", "BOUTEILLE COCA COLA 1.5L", "SALADE ICEBERG - Boule"]) {
  const hit = data.find(([R, c]) => norm(c.D) === norm(nom));
  if (!hit) { console.log(`\n${nom} : absent d'Inventaire initial`); continue; }
  const [R, c] = hit;
  console.log(`\n${nom} — L${R} : ` + COLS.filter((k) => c[k] !== "" && c[k] !== undefined).map((k) => `${k}=${String(c[k]).slice(0, 30)}`).join(" | "));
}
// en-têtes réels des lignes 5 et 6 (fusions comprises)
for (const R of [5, 6]) console.log(`\nL${R} : ` + COLS.map((k) => `${k}${R}=${rows.get(R)?.[k] ?? ""}`).join(" | "));
const merges = (full.match(/<mergeCells[\s\S]*?<\/mergeCells>/) || [""])[0];
console.log(`\nfusions L1→L8 : ${(merges.match(/ref="[A-Z]+[1-8](?::|")[A-Z]*[1-8]"/g) || []).join(" ")}`);
