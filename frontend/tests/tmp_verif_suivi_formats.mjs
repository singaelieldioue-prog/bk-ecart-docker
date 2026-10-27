// VÉRIF-SUIVI — formats numFmt réellement appliqués aux cellules de saisie/texte des feuilles
// PMIX, Offert, Transferts et P.Douane (contrôle des libellés de colonnes non numériques).
// Lecture seule. Exécution : node tests/tmp_verif_suivi_formats.mjs
import fs from "node:fs";

const V = new URL("../../tmp_verif/", import.meta.url);
const inv = JSON.parse(fs.readFileSync(new URL("xml_inventory.json", V), "utf8"));
const sondes = {
  PMIX: ["A3", "B3", "C3", "D3", "E3", "F3", "A4", "B4", "F4", "A1002", "H2", "I2"],
  Offert: ["A3", "B2", "H2"],
  Transferts: ["A5", "E5", "K5"],
  "P.Douane": ["A5", "D5", "B5"],
  "Inventaire Initial": ["A7", "C7", "J7", "N7", "K7"],
};
for (const [f, adresses] of Object.entries(sondes)) {
  const feuilles = inv.feuilles[f];
  console.log("──", f);
  adresses.forEach((a) => {
    const col = a.replace(/\d+/g, ""), lg = Number(a.replace(/\D+/g, ""));
    const c = feuilles.lignes[lg]?.[col];
    console.log(`   ${a} : ${c ? `t=${c.t} s=${c.s} fmt=${JSON.stringify(c.z)} v=${JSON.stringify(c.v)} f=${c.f ? "oui" : "-"}` : "cellule absente du XML"}`);
  });
}
