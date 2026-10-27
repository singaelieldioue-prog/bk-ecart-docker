// Sonde : écrit le module src/utils/pertesReferentielCdg.js depuis la table extraite du classeur
// de référence (tests/tmp_exact_table.json). Lecture seule sur le classeur, écriture du module.
// Exécution : node tests/tmp_exact_module.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const table = JSON.parse(fs.readFileSync(new URL("./tmp_exact_table.json", import.meta.url), "utf8"));
const q = (s) => JSON.stringify(String(s)).replace(/\\/g, "\\\\");
const lignes = table.map((l) => {
  const champs = [`cat: ${JSON.stringify(l.cat)}`, `nom: ${JSON.stringify(l.nom)}`, `cond: ${l.cond}`, `unite: ${JSON.stringify(l.unite)}`];
  if (Number(l.pu) > 0) champs.splice(3, 0, `pu: ${l.pu}`);
  return `  { ${champs.join(", ")} },  // L${l.ligne}`;
});
const src = `// Table « Perte_Q1 2026 » du classeur de référence du CDG — exact/suivis stock BK 1.xlsx,
// feuille Perte_Q1 2026, lignes 5→195, colonnes B (Catégorie), C (Nom Article), D (Cond.),
// E (Prix carton), G (Unité de perte). Extraite cellule par cellule (commentaire de fin de ligne =
// numéro de ligne source), générée par frontend/tests/tmp_exact_module.mjs.
//
// Le CDG a demandé (26/10) que notre classeur reproduise cette table à l identique : mêmes articles,
// même ordre, mêmes catégories, mêmes conditionnements, mêmes unités de perte. Le prix carton n est
// absent (champ pu manquant) que sur les 5 lignes où la référence affiche 0 : leurs formules
// XLOOKUP ne trouvent pas l article, le prix est donc résolu par nos sources habituelles.
export const PERTES_REFERENTIEL_CDG = [
${lignes.join("\n")}
];
`;
const cible = fileURLToPath(new URL("../src/utils/pertesReferentielCdg.js", import.meta.url));
fs.writeFileSync(cible, src);
console.log(`écrit : ${cible}`);
console.log(`lignes : ${table.length}, sans pu : ${table.filter((l) => !(Number(l.pu) > 0)).length}`);
