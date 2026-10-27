// VÉRIF-SUIVI — radioGRAPHIE brute des lignes d'inventaire dont ARTICLE ou Code Article est
// rendu vide dans le classeur écrit : ce que dit l'exemple, ce que dit la base, ce que le XML écrit.
// Lecture seule. Exécution : node tests/tmp_verif_suivi_cellules.mjs
import fs from "node:fs";

import XLSX from "xlsx-js-style";
import JSZip from "jszip";

import { CUSTOM_ARTICLES_ORDER } from "../src/utils/customArticleOrder.js";

const V = new URL("../../tmp_verif/", import.meta.url);
const buf = fs.readFileSync(new URL("Suivi_BK1_Octobre_2026.xlsx", V));
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file("xl/worksheets/sheet1.xml").async("string");

const wb = XLSX.read(buf, { type: "buffer", cellFormula: true });
const ws = wb.Sheets["Inventaire Initial"];

const inv = JSON.parse(fs.readFileSync(new URL("xml_inventory.json", V), "utf8"));
const L = inv.feuilles["Inventaire Initial"].lignes;

const exemples = (() => {
  const ewb = XLSX.read(fs.readFileSync(new URL("../frontend/public/exemple inventaire.xlsx", V)), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(ewb.Sheets.inventaire, { header: 1, defval: null });
  return rows.slice(6).filter((r) => r[3] && r[14]);
})();
const base = JSON.parse(fs.readFileSync(new URL("articles.json", V), "utf8"));
const normNom = (s) => String(s ?? "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const parNom = new Map(base.map((a) => [normNom(a.nom), a]));

const suspects = [];
for (let r = 7; r <= 324; r++) {
  const nom = L[r]?.C?.v, code = L[r]?.N?.v;
  if (String(nom ?? "").trim() === "" || String(code ?? "").trim() === "") {
    const ex = exemples[r - 7];
    const xmlRow = (xml.match(new RegExp(`<row r="${r}"[\\s\\S]*?</row>`)) || [""])[0];
    suspects.push({
      ligne: r,
      cellule_C: JSON.stringify(ws[`C${r}`] ?? null),
      cellule_N: JSON.stringify(ws[`N${r}`] ?? null),
      xml_C: (xmlRow.match(/<c r="C\d+"[\s\S]*?(?:\/>|<\/c>)/) || ["—"])[0],
      xml_N: (xmlRow.match(/<c r="N\d+"[\s\S]*?(?:\/>|<\/c>)/) || ["—"])[0],
      exemple_nom: JSON.stringify(ex?.[3]),
      exemple_code: JSON.stringify(ex?.[14]),
      dans_CUSTOM_ORDER: CUSTOM_ARTICLES_ORDER.filter((n) => normNom(n) === normNom(ex?.[3])).length,
      base_par_nom: (() => { const b = parNom.get(normNom(ex?.[3])); return b ? { code: JSON.stringify(b.code), nom: JSON.stringify(b.nom) } : null; })(),
    });
  }
}
console.log("lignes suspectes :", suspects.length);
suspects.slice(0, 22).forEach((s) => console.log(JSON.stringify(s)));
