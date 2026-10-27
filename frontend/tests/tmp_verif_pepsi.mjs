// VÉRIF PEPSI — le prix de BOUTEILLE PEPSI ZERO 1,5L (base : 3 150 F/carton, cond. 6) arrive-t-il
// réellement dans le classeur Suivi Stock généré par le code actuel ? Lecture seule de la base,
// sortie dans tmp_verif/ sous un nom NEUF (ne touche pas Suivi_BK1_Octobre_2026.xlsx, copie d'audit).
// Exécution : node tests/tmp_verif_pepsi.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import XLSX from "xlsx-js-style";
import JSZip from "jszip";

import { buildModelesWb } from "../src/utils/excelExporter.js";
import { enrichirAvecBaseLocale } from "../src/utils/parsers.js";
import { injecterLogoXlsx } from "../src/utils/xlsxLogo.js";

const V = new URL("../../tmp_verif/", import.meta.url);
const normaliser = (v) =>
  String(v || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");

function ordonnerSelonExemple(articles) {
  const wb = XLSX.read(fs.readFileSync(new URL("../frontend/public/exemple inventaire.xlsx", V)), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.inventaire, { header: 1, defval: null });
  const ref = rows.slice(6).filter((r) => r[3] && r[14]).map((r) => ({
    name: r[3], code: r[14], categorie: r[1] || "",
    conditionnement: typeof r[4] === "number" ? r[4] : 1,
    qteInner: typeof r[5] === "number" ? r[5] : 0,
    unite: r[10] || "",
  }));
  const byCode = new Map(), byName = new Map();
  articles.forEach((a) => { if (a.code) byCode.set(normaliser(a.code), a); if (a.nom) byName.set(normaliser(a.nom), a); });
  return ref.map((reference) => {
    const source = byCode.get(normaliser(reference.code)) || byName.get(normaliser(reference.name));
    return { ...(source || {}), nom: reference.name, code: reference.code, categorie: reference.categorie,
      conditionnement: reference.conditionnement, qteInner: reference.qteInner, unite: reference.unite || source?.unite || "" };
  });
}

const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (cle) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(cle); return r ? JSON.parse(r.v) : null; };

console.log("=== 1. BASE (readonly) ===");
console.table(db.prepare("SELECT ref, nom, code, conditionnement, pu_carton, pu_piece, actif FROM articles WHERE UPPER(nom) LIKE '%PEPSI%' ORDER BY nom").all());

const articlesBdd = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles WHERE actif = 1").all();
const produits = (charge("bk_sia_ratios_parsed_v1") || {}).allProducts || [];
const localArticles = charge("bk_sia_local_articles_v1") || {};
const pmixComplement = charge("bk_sia_pmix_complement_v1") || {};
const codesRestos = db.prepare("SELECT code FROM restaurants WHERE actif = 1").all().map((r) => r.code);

const ordered = enrichirAvecBaseLocale(ordonnerSelonExemple(articlesBdd), localArticles);
console.log("\n=== 2. LIGNES DU MODÈLE contenant PEPSI (avant build) ===");
ordered.filter((a) => /PEPSI/i.test(a.nom || "")).forEach((a) =>
  console.log(`  ${a.nom} | code ${a.code} | cond ${a.conditionnement} | inner ${a.qteInner} | pu_carton ${a.pu_carton} | pu_piece ${a.pu_piece} | cat ${a.categorie}`));

const wb = buildModelesWb(ordered, produits, "BK1", "Octobre 2026", "", codesRestos, pmixComplement, articlesBdd);
const brut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
const avecLogo = await injecterLogoXlsx(brut);
const sortie = new URL("Verif_Pepsi_20261026.xlsx", V);
fs.writeFileSync(sortie, Buffer.from(avecLogo));
console.log("\nfichier :", decodeURIComponent(sortie.pathname.replace(/^\/([A-Za-z]:)/, "$1")), fs.statSync(sortie).size, "octets");
console.log("feuilles :", wb.SheetNames.join(" | "));

console.log("\n=== 3. CELLULES PUBLIÉES (valeurs relues) ===");
const relu = XLSX.read(Buffer.from(avecLogo), { type: "buffer", cellNF: true });
const colName = (c) => XLSX.utils.encode_col(c);
for (const nom of relu.SheetNames) {
  const ws = relu.Sheets[nom];
  const rg = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = rg.s.r; r <= rg.e.r; r++) {
    const cells = [];
    let hit = false;
    for (let c = rg.s.c; c <= rg.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v === "" || cell.v == null) continue;
      if (typeof cell.v === "string" && /PEPSI/i.test(cell.v)) hit = true;
    }
    if (!hit) continue;
    for (let c = rg.s.c; c <= rg.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v === "" || cell.v == null) continue;
      cells.push(`${colName(c)}${r + 1}=${JSON.stringify(cell.v)}${cell.z ? ` [${cell.z}]` : ""}`);
    }
    console.log(`  ${nom} L${r + 1} : ${cells.join("  ")}`);
  }
}

console.log("\n=== 4. FORMULES XML sur ces mêmes lignes (SheetJS ne les relit pas) ===");
const zip = await JSZip.loadAsync(Buffer.from(avecLogo));
const wbXml = await zip.file("xl/workbook.xml").async("string");
const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
const relMap = new Map([...relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]));
const sheetFiles = new Map([...wbXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)]
  .map((m) => [m[1], "xl/" + relMap.get(m[2]).replace(/^\/?xl\//, "")]));
const pepliRows = new Map();   // feuille -> Set de lignes
{
  const relu2 = relu;
  for (const nom of relu2.SheetNames) {
    const ws = relu2.Sheets[nom];
    const rg = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let r = rg.s.r; r <= rg.e.r; r++) {
      for (let c = rg.s.c; c <= rg.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === "string" && /PEPSI/i.test(cell.v)) {
          if (!pepliRows.has(nom)) pepliRows.set(nom, new Set());
          pepliRows.get(nom).add(r + 1);
        }
      }
    }
  }
}
for (const [nom, lignes] of pepliRows) {
  const xml = await zip.file(sheetFiles.get(nom)).async("string");
  for (const L of [...lignes].sort((a, b) => a - b)) {
    const cells = [...xml.matchAll(new RegExp(`<c r="([A-Z]+)${L}"[^>]*>(.*?)</c>`, "g"))].map((m) => {
      const [, col, inner] = m;
      const f = (inner.match(/<f[^>]*>(.*?)<\/f>/) || [])[1];
      const v = (inner.match(/<v[^>]*>(.*?)<\/v>/) || [])[1];
      return f ? `${col}${L}{=${f}}` : (v != null && v !== "" ? `${col}${L}=${v}` : null);
    }).filter(Boolean);
    console.log(`  ${nom} L${L} : ${cells.join("  ")}`);
  }
}
