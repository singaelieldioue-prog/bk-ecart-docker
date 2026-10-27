// Correction ciblée du classeur d'octobre (copie) :
//  1) Inventaire Initial/Final, ligne 227 : code saisi SSM30700 (code du format 2 000) → SSM4000 ;
//  2) ligne 312 : SANITIZER TABLETTE doublon dont le conditionnement 6/6 contredit le référentiel
//     (« 6*230 » = 1 380/230, validé par la feuille Référentiel Articles, L305) → contenu article vidé,
//     la ligne physique et ses bordures sont conservées.
// Aucune autre cellule, aucune autre feuille n'est touchée. Écriture sur une COPIE.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import JSZip from "jszip";

const SRC = path.resolve("../tmp_verif/Suivi_BK1_Octobre_2026.xlsx");
const DST = path.resolve("../tmp_verif/Suivi_BK1_Octobre_2026_corrige.xlsx");
const src = fs.readFileSync(SRC);
const zip = await JSZip.loadAsync(src);
const avant = {};
for (const [nom, f] of Object.entries(zip.files)) if (!f.dir) avant[nom] = crypto.createHash("sha256").update(await f.async("nodebuffer")).digest("hex");

const rempl = (xml, de, vers, attendu = 1) => {
  const n = xml.split(de).length - 1;
  if (n !== attendu) throw new Error(`occurrences ${n} ≠ ${attendu} pour ${de.slice(0, 60)}`);
  return xml.split(de).join(vers);
};

for (const feuille of ["xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) {
  let xml = await zip.file(feuille).async("string");
  xml = rempl(xml, '<c r="N227" s="35" t="str"><v>SSM30700</v></c>', '<c r="N227" s="35" t="str"><v>SSM4000</v></c>');
  const vide = [
    ['<c r="A312" s="41" t="str"><v>Produits de Nettoyage</v></c>', '<c r="A312" s="41"/>'],
    ['<c r="B312" s="41" t="str"><v>SIA</v></c>', '<c r="B312" s="41"/>'],
    ['<c r="C312" s="45" t="str"><v xml:space="preserve">SANITIZER TABLETTE </v></c>', '<c r="C312" s="45"/>'],
    ['<c r="D312" s="46"><v>6</v></c>', '<c r="D312" s="46"/>'],
    ['<c r="E312" s="46"><v>6</v></c>', '<c r="E312" s="46"/>'],
    ['<c r="J312" s="41" t="str"><v>Carton</v></c>', '<c r="J312" s="41"/>'],
    ['<c r="K312" s="46"><v>62935</v></c>', '<c r="K312" s="46"/>'],
    ['<c r="N312" s="41" t="str"><v>2600320ST</v></c>', '<c r="N312" s="41"/>'],
  ];
  for (const [de, vers] of vide) xml = rempl(xml, de, vers);
  zip.file(feuille, xml);
}

const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 }, platform: "DOS" });
fs.writeFileSync(DST, out);

const verif = await JSZip.loadAsync(out);
const modifiees = [];
for (const [nom, f] of Object.entries(verif.files)) {
  if (f.dir) continue;
  const h = crypto.createHash("sha256").update(await f.async("nodebuffer")).digest("hex");
  if (avant[nom] !== h) modifiees.push(nom);
}
console.log("Écrit :", DST);
console.log("Taille :", (src.length / 1048576).toFixed(2), "Mo →", (out.length / 1048576).toFixed(2), "Mo");
console.log("Entrées zip :", Object.keys(avant).length, "→", Object.keys(verif.files).filter((n) => !verif.files[n].dir).length);
console.log("Entrées modifiées :", modifiees.join(", ") || "(aucune)");
