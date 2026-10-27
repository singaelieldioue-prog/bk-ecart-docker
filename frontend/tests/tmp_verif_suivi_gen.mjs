// VÉRIF-SUIVI — génération d'un classeur Suivi Stock BK1 / Octobre 2026 pour audit en lecture seule.
// Reproduit la chaîne réelle de l'application (BaseArticlesTab.jsx:141-165) :
//   articles BDD (actif=1) → orderArticlesByInventoryExample → enrichirAvecBaseLocale
//   → buildModelesWb → XLSX.write → injecterLogoXlsx.
// Écrit dans tmp_verif/ uniquement (aucun fichier existant modifié).
// Exécution : node tests/tmp_verif_suivi_gen.mjs
import fs from "node:fs";

import XLSX from "xlsx-js-style";

import { buildModelesWb } from "../src/utils/excelExporter.js";
import { enrichirAvecBaseLocale } from "../src/utils/parsers.js";
import { injecterLogoXlsx } from "../src/utils/xlsxLogo.js";

const V = new URL("../../tmp_verif/", import.meta.url);
const lire = (f) => JSON.parse(fs.readFileSync(new URL(f, V), "utf-8"));
const normaliser = (v) =>
  String(v || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");

// orderArticlesByInventoryExample (BaseArticlesTab.jsx:20-59), version fichier local.
function ordonnerSelonExemple(articles) {
  const wb = XLSX.read(fs.readFileSync(new URL("../frontend/public/exemple inventaire.xlsx", V)), { type: "buffer" });
  const sheet = wb.Sheets.inventaire;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const ref = rows
    .slice(6)
    .filter((r) => r[3] && r[14])
    .map((r) => ({
      name: r[3],
      code: r[14],
      categorie: r[1] || "",
      conditionnement: typeof r[4] === "number" ? r[4] : 1,
      qteInner: typeof r[5] === "number" ? r[5] : 0,
      unite: r[10] || "",
    }));
  const byCode = new Map(), byName = new Map();
  articles.forEach((a) => {
    if (a.code) byCode.set(normaliser(a.code), a);
    if (a.nom) byName.set(normaliser(a.nom), a);
  });
  return ref.map((reference) => {
    const source = byCode.get(normaliser(reference.code)) || byName.get(normaliser(reference.name));
    return {
      ...(source || {}),
      nom: reference.name,
      code: reference.code,
      categorie: reference.categorie,
      conditionnement: reference.conditionnement,
      qteInner: reference.qteInner,
      unite: reference.unite || source?.unite || "",
    };
  });
}

// Les sources sont lues en base de données (lecture seule) : les dumps JSON de tmp_verif datent du
// 25/10 au matin, avant la revalorisation du conditionnement. better-sqlite3 n'est installé que côté backend.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (cle) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(cle); return r ? JSON.parse(r.v) : null; };

const articlesBdd = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles WHERE actif = 1").all();
const produits = (charge("bk_sia_ratios_parsed_v1") || {}).allProducts || [];
const localArticles = charge("bk_sia_local_articles_v1") || {};
const pmixComplement = charge("bk_sia_pmix_complement_v1") || {};
const codesRestos = (db.prepare("SELECT code FROM restaurants WHERE actif = 1").all()).map((r) => r.code);

const ordered = enrichirAvecBaseLocale(ordonnerSelonExemple(articlesBdd), localArticles);
console.log("articles BDD actif=1 :", articlesBdd.length, "| lignes de l'exemple :", ordered.length);

const wb = buildModelesWb(ordered, produits, "BK1", "Octobre 2026", "", codesRestos, pmixComplement, articlesBdd);
const brut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
const avecLogo = await injecterLogoXlsx(brut);
const sortie = new URL("Suivi_BK1_Octobre_2026.xlsx", V);
fs.writeFileSync(sortie, Buffer.from(avecLogo));
console.log("écrit :", decodeURIComponent(sortie.pathname.replace(/^\/([A-Za-z]:)/, "$1")), fs.statSync(sortie).size, "octets");
console.log("feuilles :", wb.SheetNames.join(" | "));
