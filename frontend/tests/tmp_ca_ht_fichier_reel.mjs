// Radiographie (lecture seule) de la ligne « CA HT du jour » dans le classeur réellement livré :
// tmp_verif/Suivi_BK1_Octobre_2026.xlsx, tel qu'écrit par la chaîne complète (générateur +
// injection du logo). Contrôle le XML publié, pas l'objet SheetJS en mémoire.
// Exécution : node tests/tmp_ca_ht_fichier_reel.mjs
import fs from "node:fs";

import JSZip from "jszip";
import XLSX from "xlsx-js-style";

const Fichier = new URL("../../tmp_verif/Suivi_BK1_Octobre_2026.xlsx", import.meta.url);

const zip = await JSZip.loadAsync(fs.readFileSync(Fichier));
const workbookXml = await zip.file("xl/workbook.xml").async("string");
const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
const rels = new Map(
  [...relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => {
    const t = m[2].replace(/^\/+/, "");
    return [m[1], t.startsWith("xl/") ? t : `xl/${t}`];
  })
);
const target = (workbookXml.match(/<sheet[^>]*name="Pertes"[^>]*r:id="(rId\d+)"/) || [])[1];
const chemin = rels.get(target);
const sheetNames = [...workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"/g)].map((m) => m[1]);
console.log("feuilles :", sheetNames.join(" | "));
console.log(`« Pertes » lu dans : ${chemin}`);
const xml = await zip.file(chemin).async("string");

const decode = (s) =>
  String(s ?? "")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const lignes = {};
for (const m of xml.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const cells = {};
  for (const c of m[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const body = c[3] || "";
    cells[c[1]] = {
      f: decode((body.match(/<f[^>]*>([\s\S]*?)<\/f>/) || [])[1]),
      v: decode((body.match(/<v[^>]*>([\s\S]*?)<\/v>/) || [])[1]),
      attrs: c[2],
    };
  }
  lignes[Number(m[1])] = cells;
}

// Résolution indice de style → remplissage + format (xlsx-js-style ne déduplique pas les styles)
const stylesXml = await zip.file("xl/styles.xml").async("string");
const fills = [...stylesXml.matchAll(/<fill>(?:(?!<fill>)[\s\S])*?<\/fill>/g)].map((m) => m[0]);
const xfs = [...stylesXml.match(/<cellXfs[\s\S]*?<\/cellXfs>/)[0].matchAll(/<xf\b[\s\S]*?(?:\/>|<\/xf>)/g)].map((m) => m[0]);
const style = (attrs) => {
  const xf = xfs[Number((attrs.match(/s="(\d+)"/) || [])[1])] || "";
  const fill = fills[Number((xf.match(/fillId="(\d+)"/) || [])[1])] || "";
  return {
    rgb: decode((fill.match(/fgColor rgb="([0-9A-F]+)"/) || [])[1]),
    numFmtId: (xf.match(/numFmtId="(\d+)"/) || [])[1],
  };
};

const JOURS = Array.from({ length: 31 }, (_, i) => XLSX.utils.encode_col(9 + i));
const dim = (xml.match(/<dimension ref="([^"]+)"/) || [])[1];
const pane = (xml.match(/<pane[^>]*\/>/) || [])[0];
console.log(`\nPertes — dimension ${dim} | pane ${pane || "aucun"}`);
console.log(`dernière ligne écrite : ${Math.max(...Object.keys(lignes).map(Number))}`);

const presentes = JOURS.filter((c) => lignes[1]?.[c]);
const nonNilles = presentes.filter((c) => lignes[1][c].v !== "0");
const formules = presentes.filter((c) => lignes[1][c].f);
const styles = [...new Set(presentes.map((c) => style(lignes[1][c].attrs).rgb + "/" + style(lignes[1][c].attrs).numFmtId))];
console.log(`J1..AN1 : ${presentes.length}/31 publiées | v ≠ 0 : ${nonNilles.length} | avec formule : ${formules.length} | styles ${styles.join(",")} (FFE8F5E9/3 = vert saisie + « #,##0 »)`);
console.log(`I1 = ${JSON.stringify(lignes[1]?.I?.v)}`);
console.log(`AO1 = ${lignes[1]?.AO?.f}   (→ ${lignes[1]?.AO?.v})`);
console.log(`AO2 = ${lignes[2]?.AO?.f}`);
console.log(`AO3 = ${lignes[3]?.AO?.f}`);
console.log(`J2 = ${lignes[2]?.J?.f}`);
console.log(`J3 = ${lignes[3]?.J?.f}`);
console.log(`AO1 à la ligne 1 (total du CA, voulu) = ${lignes[1]?.AO?.f ?? "absente"} | AP1 = ${lignes[1]?.AP ? "PRÉSENTE " + lignes[1].AP.v : "absente"}`);

// Les 31 cellules de CA ne doivent pas être lues comme des pertes au réimport
const relu = XLSX.read(fs.readFileSync(Fichier), { type: "buffer", cellFormula: true });
const { createRequire } = await import("node:module");
const { fileURLToPath } = await import("node:url");
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (cle) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(cle); return r ? JSON.parse(r.v) : null; };
const { parseSuivisStock } = await import("../src/utils/parsers.js");
const sd = parseSuivisStock(
  relu,
  charge("bk_sia_base_article_map_v1") || {},
  charge("bk_sia_ratios_parsed_v1") || { waLandedCost: {}, waByCode: {}, pmpByIng: {} },
  charge("bk_sia_local_articles_v1") || {}
);
console.log(`\nréimport du classeur livré : ${sd.pertes.length} perte(s) | lignes « CA HT » importées : ${sd.pertes.filter((p) => /CA HT/i.test(String(p.nom))).length}`);
