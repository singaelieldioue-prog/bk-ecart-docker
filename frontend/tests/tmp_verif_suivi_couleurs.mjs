// VÉRIF-SUIVI — couleurs de fond réelles des cellules de saisie / de total (lecture seule).
// Exécution : node tests/tmp_verif_suivi_couleurs.mjs
import fs from "node:fs";

import JSZip from "jszip";

const zip = await JSZip.loadAsync(fs.readFileSync(new URL("../../tmp_verif/Suivi_BK1_Octobre_2026.xlsx", import.meta.url)));
const st = await zip.file("xl/styles.xml").async("string");

const fills = [...st.slice(st.indexOf("<fills"), st.indexOf("</fills>")).matchAll(/<fill\b[\s\S]*?<\/fill>/g)].map((m) => m[0]);
const d = st.indexOf("<cellXfs");
const xfs = [...st.slice(d, st.indexOf("</cellXfs>", d)).matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map((m) => m[0]);
const fonts = [...st.slice(st.indexOf("<fonts"), st.indexOf("</fonts>")).matchAll(/<font\b[\s\S]*?<\/font>/g)].map((m) => m[0]);
const bord = (s) => (xfs[Number(s)].match(/borderId="(\d+)"/) || [])[1];
const fond = (s) => {
  const f = (xfs[Number(s)].match(/fillId="(\d+)"/) || [])[1];
  return (fills[Number(f)] || "").match(/rgb="([0-9A-F]+)"/)?.[1] || "aucun";
};
const police = (s) => {
  const i = Number((xfs[Number(s)].match(/fontId="(\d+)"/) || [])[1]);
  const bl = (fonts[i] || "").match(/rgb="([0-9A-F]+)"/)?.[1];
  return `${(fonts[i] || "").includes("<b") ? "gras" : "normal"}${bl ? "/#" + bl : ""}`;
};

const CELLULES = [
  ["Inventaire Initial", "xl/worksheets/sheet1.xml", ["A4", "F2", "I2", "C7", "F7", "G7", "H7", "I7", "K7", "L7", "B325", "L325", "A333", "B333"]],
  ["Pertes", "xl/worksheets/sheet5.xml", ["A151", "B152", "C152", "D152", "J5", "H5", "A165", "B166", "D166", "J2", "J3", "F193", "H193"]],
  ["Transferts", "xl/worksheets/sheet3.xml", ["A5", "C2", "E2", "E5", "J5", "K5", "N2", "N4", "O4", "N6", "N7", "N8", "N9", "O9"]],
  ["P.Douane", "xl/worksheets/sheet6.xml", ["B2", "D2", "D5", "H5", "A205", "I205"]],
  ["PMIX", "xl/worksheets/sheet9.xml", ["A3", "C3", "F3", "H5", "I5", "H6", "I6", "B1003", "C1003"]],
];

for (const [nom, chemin, refs] of CELLULES) {
  const x = await zip.file(chemin).async("string");
  console.log("── " + nom + " (" + chemin + ")");
  for (const ref of refs) {
    const m = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`).exec(x);
    if (!m) {
      console.log(`   ${ref} : aucune cellule`);
      continue;
    }
    const s = (m[1].match(/s="(\d+)"/) || [])[1];
    if (s == null) {
      console.log(`   ${ref} : sans style`);
      continue;
    }
    console.log(`   ${ref} : s=${s} fond=#${fond(s)} police=${police(s)} bordure=${bord(s)}`);
  }
}
