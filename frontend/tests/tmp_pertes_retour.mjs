// Sonde lecture seule du RETOUR CDG : un classeur généré (données réelles) avec des quantités
// perdues saisies sur trois lignes repères, reréimporté par parseSuivisStock. Les cellules E (prix
// pièce) reçoivent leur valeur calculée, comme après ouverture dans Excel.
// Exécution : node tests/tmp_pertes_retour.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { enrichirAvecBaseLocale, parseSuivisStock } from "../src/utils/parsers.js";

const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (cle) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(cle); return r ? JSON.parse(r.v) : null; };

const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
function ordonnerSelonExemple(articles) {
  const wbx = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wbx.Sheets.inventaire, { header: 1, defval: null });
  const ref = rows.slice(6).filter((r) => r[3] && r[14]).map((r) => ({
    name: r[3], code: r[14], categorie: r[1] || "",
    conditionnement: typeof r[4] === "number" ? r[4] : 1,
    qteInner: typeof r[5] === "number" ? r[5] : 0, unite: r[10] || "",
  }));
  const byCode = new Map(), byName = new Map();
  articles.forEach((a) => { if (a.code) byCode.set(norm(a.code), a); if (a.nom) byName.set(norm(a.nom), a); });
  return ref.map((reference) => {
    const source = byCode.get(norm(reference.code)) || byName.get(norm(reference.name));
    return { ...(source || {}), nom: reference.name, code: reference.code, categorie: reference.categorie,
      conditionnement: reference.conditionnement, qteInner: reference.qteInner, unite: reference.unite || source?.unite || "" };
  });
}

const arts = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles WHERE actif = 1").all();
const ratios = charge("bk_sia_ratios_parsed_v1") || {};
const produits = ratios.allProducts || [];
const localArticles = charge("bk_sia_local_articles_v1") || {};
const baseArticle = charge("bk_sia_base_article_map_v1") || {};
const pmixComplement = charge("bk_sia_pmix_complement_v1") || {};
const ordered = enrichirAvecBaseLocale(ordonnerSelonExemple(arts), localArticles);

const wb = buildModelesWb(ordered, produits, "BK1", "Octobre 2026", "", ["BK1"], pmixComplement, arts);
const ws = wb.Sheets["Pertes"];
const lignes = ["MIRINDA ORANGE PET 30CL", "BOUTEILLE PEPSI ZERO 1,5L", "CHICKEN BURGER PETIT PRIX"];
const saisis = { "MIRINDA ORANGE PET 30CL": 3, "BOUTEILLE PEPSI ZERO 1,5L": 1, "CHICKEN BURGER PETIT PRIX": 2 };
lignes.forEach((nom) => {
  const R = (() => { for (let r = 5; r < 400; r++) if (norm(ws[`B${r}`]?.v) === norm(nom)) return r; return 0; })();
  const cond = Number(ws[`C${R}`]?.v) || 0, pu = Number(ws[`D${R}`]?.v) || 0;
  ws[`J${R}`] = { v: saisis[nom], t: "n" };
  ws[`G${R}`] = { v: saisis[nom], t: "n", f: ws[`G${R}`].f };                       // quantité recalculée
  ws[`E${R}`] = { v: cond > 0 && pu > 0 ? pu / cond : 0, t: "n", f: ws[`E${R}`].f }; // prix pièce recalculé
  ws[`H${R}`] = { v: saisis[nom] * (cond > 0 && pu > 0 ? pu / cond : 0), t: "n", f: ws[`H${R}`].f };
  console.log(`saisie : ${nom} ligne ${R}, ${saisis[nom]} perte(s), prix pièce ${ws[`E${R}`].v}`);
});

const relu = XLSX.read(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }), { type: "buffer", cellFormula: true });
const sd = parseSuivisStock(relu, baseArticle, ratios, localArticles);
console.log(`\nPertes relues par le parseur : ${sd.pertes.length} ligne(s), total ${Math.round(sd.pertes.reduce((s, p) => s + p.valeur, 0) * 100) / 100} F`);
sd.pertes.forEach((p) => console.log(`  ${p.nom} : ${p.qtePieces} × ${Math.round(p.puPiece * 100) / 100} = ${Math.round(p.valeur * 100) / 100} F  [${p.prixSource}]`));
