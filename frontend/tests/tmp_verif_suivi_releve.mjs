// VÉRIF-SUIVI — relevé lisible du classeur (lecture seule) : lignes d'en-tête, premières
// lignes de données, lignes de total, pour chaque feuille. Alimente verif_suivi_stock.md.
// Exécution : node tests/tmp_verif_suivi_releve.mjs [NomFeuille]
import fs from "node:fs";

const V = new URL("../../tmp_verif/", import.meta.url);
const inv = JSON.parse(await fs.promises.readFile(new URL("xml_inventory.json", V), "utf8"));
const filtre = process.argv[2];

const L = (n) => "═".repeat(n);
const fmtCell = (c) => {
  if (!c) return "—";
  const parts = [`v=${c.v == null ? "" : String(c.v).slice(0, 42)}`];
  if (c.f) parts.push(`f=${c.f}`);
  if (c.z) parts.push(`z:${c.z}`);
  if (c.s != null) parts.push(`s${c.s}`);
  return parts.join(" · ");
};

for (const [nom, f] of Object.entries(inv.feuilles)) {
  if (filtre && nom !== filtre) continue;
  console.log(L(100));
  console.log(`${nom} · ${f.etat} · ${f.chemin} · dimension ${f.dimension} · ${f.nbRowsXml} rows · merges: ${f.mergeCells.join(", ")}`);
  console.log(`  pane ${f.pane}`);
  const lignes = Object.keys(f.lignes).map(Number).sort((a, b) => a - b);
  const entetes = lignes.filter((r) => r <= 8);
  const avecTotal = new Set();
  for (const r of lignes) {
    const cells = f.lignes[r];
    if (Object.values(cells).some((c) => c && typeof c.v === "string" && /total|synth[ée]se|contr[ôo]le/i.test(c.v))) {
      for (const k of [r - 1, r, r + 1]) avecTotal.add(k);
    }
  }
  const aImprimer = [...new Set([...entetes, ...avecTotal])].sort((a, b) => a - b);
  for (const r of aImprimer) {
    const cells = f.lignes[r];
    if (!cells) continue;
    const cols = Object.keys(cells).sort();
    console.log(`  --- ligne ${r} ---`);
    for (const c of cols) console.log(`    ${c}${r}: ${fmtCell(cells[c])}`);
  }
}
