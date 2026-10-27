// VÉRIF-SUIVI — contrôle croisé de la table de styles (index de cellule → format d'affichage).
// Exécution : node tests/tmp_verif_suivi_styles.mjs
import fs from "node:fs";

import JSZip from "jszip";

const zip = await JSZip.loadAsync(fs.readFileSync(new URL("../../tmp_verif/Suivi_BK1_Octobre_2026.xlsx", import.meta.url)));
const st = await zip.file("xl/styles.xml").async("string");

const debut = st.indexOf("<cellXfs");
const fin = st.indexOf("</cellXfs>", debut);
const corps = st.slice(debut, fin);
console.log("balise:", /<cellXfs[^>]*>/.exec(st)[0], "| longueur section:", corps.length);

const xfs = [...corps.matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map((m) => {
  const tag = m[0];
  const id = (tag.match(/numFmtId="(\d+)"/) || [])[1];
  return { s: undefined, numFmtId: id, fontId: (tag.match(/fontId="(\d+)"/) || [])[1], fillId: (tag.match(/fillId="(\d+)"/) || [])[1] };
});
xfs.forEach((x, i) => (x.s = i));
console.log("nombre de xf dans cellXfs :", xfs.length);

const numFmts = {};
for (const m of st.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)) numFmts[m[1]] = m[2];
const BUILTIN = { 0: "General", 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 14: "mm-dd-yy", 22: "m/d/yy h:mm", 39: "#,##0 (#,##0)", 44: '_($* #,##0.00_)' };
const code = (id) => numFmts[id] || BUILTIN[id] || `numFmtId ${id}`;

// Feuille Pertes (sheet5) et Inventaire Initial (sheet1) : formats réels des cellules citées
for (const [nom, chemin, refs] of [
  ["Pertes", "xl/worksheets/sheet5.xml", ["I1", "I2", "I3", "J1", "J2", "J3", "K2", "AO2", "C152", "D152", "E152", "G152", "H152", "C5", "D5", "E5", "H5", "H193", "B48", "A48"]],
  ["Inventaire Initial", "xl/worksheets/sheet1.xml", ["A7", "D7", "E7", "K7", "I7", "L7", "O7", "G7", "B325", "L325", "B333", "C151"]],
  ["Transferts", "xl/worksheets/sheet3.xml", ["A5", "H5", "I5", "J5", "O2", "O4"]],
  ["PMIX", "xl/worksheets/sheet9.xml", ["A3", "C3", "D3", "E3", "I5", "I6", "I7"]],
  ["P.Douane", "xl/worksheets/sheet6.xml", ["A5", "F5", "G5", "H5", "I5", "A205", "I205"]],
]) {
  const xml = await zip.file(chemin).async("string");
  console.log("── " + nom + " (" + chemin + ")");
  for (const ref of refs) {
    const m = new RegExp(`<c r="${ref}"([^>]*)>([\\s\\S]*?)</c>|<c r="${ref}"([^>]*)/>`).exec(xml);
    if (!m) {
      console.log(`   ${ref} : AUCUNE CELLULE`);
      continue;
    }
    const attrs = m[1] || m[3] || "";
    const inner = m[2] || "";
    const s = (attrs.match(/s="(\d+)"/) || [])[1];
    const t = (attrs.match(/t="([^"]+)"/) || [])[1];
    const f = (inner.match(/<f[^>]*>([\s\S]*?)<\/f>/) || [])[1];
    const v = (inner.match(/<v[^>]*>([\s\S]*?)<\/v>/) || [])[1];
    console.log(`   ${ref} : s=${s} (${s == null ? "aucun style" : code(xfs[Number(s)]?.numFmtId)}) t=${t || "n"} v=${JSON.stringify(v)} f=${f ? JSON.stringify(f.slice(0, 70)) : "-"}`);
  }
}
