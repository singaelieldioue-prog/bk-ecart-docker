// Sonde lecture seule : séquence des catégories et prix publiés dans le XML du classeur livré
// (tmp_verif/Suivi_BK1_Octobre_2026.xlsx), telle que l'ouvrirait Excel — pas la feuille SheetJS en mémoire.
// Exécution : node tests/tmp_pertes_xml_ordre.mjs
import fs from "node:fs";
import JSZip from "jszip";

const Fichier = new URL("../../tmp_verif/Suivi_BK1_Octobre_2026.xlsx", import.meta.url);
const zip = await JSZip.loadAsync(fs.readFileSync(Fichier));
const wbXml = await zip.file("xl/workbook.xml").async("string");
const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
const cible = (wbXml.match(/<sheet[^>]*name="Pertes"[^>]*r:id="(r[^"]+)"/) || [])[1];
const target = (rels.match(new RegExp(`Id="${cible}"[^>]*Target="([^"]+)"`)) || [])[1];
const chemin = target.startsWith("xl/") ? target : `xl/${target}`;
const sheet = await zip.file(chemin).async("string");
const de = (s) => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const lignes = new Map();
for (const m of sheet.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const [, num, corps] = m;
  const cellules = {};
  for (const c of corps.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = c[1], interieur = c[2] || "";
    const ref = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1];
    if (!ref) continue;
    const v = de((interieur.match(/<v[^>]*>([\s\S]*?)<\/v>/) || [])[1] ?? "");
    const f = de((interieur.match(/<f[^>]*>([\s\S]*?)<\/f>/) || [])[1] ?? "");
    cellules[ref] = { v, f };
  }
  lignes.set(Number(num), cellules);
}

const col = (n, c) => lignes.get(n)?.[c] ?? {};
const seq = [];
let nbGardees = 0, blanks = [];
for (let n = 5; n <= 190; n++) {
  const nom = col(n, "B").v;
  if (!nom) continue;
  const cat = col(n, "A").v;
  const cond = col(n, "C").v, carton = col(n, "D").v, piece = col(n, "E").f;
  if (/ISNUMBER/.test(piece)) { nbGardees++; blanks.push(`l${n} « ${nom} »`); }
  seq.push({ n, cat: cat || "(vide)", nom });
}
const blocs = [];
seq.forEach((l) => {
  if (!blocs.length || blocs[blocs.length - 1].cat !== l.cat) blocs.push({ cat: l.cat, debut: l.n, fin: l.n, n: 1 });
  else { blocs[blocs.length - 1].fin = l.n; blocs[blocs.length - 1].n++; }
});
console.log("── blocs de catégories écrits dans le XML ──");
blocs.forEach((b) => console.log(`  ${String(b.debut).padStart(3)}→${String(b.fin).padEnd(4)} (${String(b.n).padStart(3)}) ${b.cat}`));
const distinctes = new Set(blocs.map((b) => b.cat));
console.log(`blocs : ${blocs.length} | catégories distinctes : ${distinctes.size} | retours : ${blocs.length - distinctes.size}`);
console.log(`lignes de données : ${seq.length} | lignes gardées ISNUMBER (à renseigner) : ${nbGardees} → ${blanks.join(" | ") || "aucune"}`);
console.log("\n── les 4 lignes résolues du 26/10, telles qu'écrites ──");
["BOUTEILLE PEPSI ZERO 1,5L", "EAU KIRENE 50 CL 16", "FROMAGE MEDHI NEW", "MOZZARELLA STICKS", "BBQ TENDERCRISP"].forEach((cherché) => {
  const l = seq.find((x) => x.nom === cherché);
  if (!l) return console.log(`  ${cherché} : ABSENTE de la feuille`);
  console.log(`  l${l.n} · A=${JSON.stringify(l.cat)} · C=${JSON.stringify(col(l.n, "C").v)} · D=${JSON.stringify(col(l.n, "D").v)} · E=${col(l.n, "E").f} · F=${JSON.stringify(col(l.n, "F").v)}`);
});
console.log("\n── lignes 1 à 3 et total ──");
console.log(`  A1=${JSON.stringify(col(1, "A").v)} I1=${JSON.stringify(col(1, "I").v)} AO1=${col(1, "AO").f}`);
console.log(`  AO2=${col(2, "AO").f} | AO3=${col(3, "AO").f}`);
console.log(`  L191 : F=${JSON.stringify(col(191, "F").v)} H=${col(191, "H").f}`);
