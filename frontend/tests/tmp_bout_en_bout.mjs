// CAMPAGNE TEMPORAIRE — Chaîne métier de bout en bout (27/10/2026)
// Ratio + base article + base locale + complément PMIX (lus dans backend/data.db, en lecture seule)
//   → modèle Suivi Stock généré par buildModelesWb
//   → saisie réelle : Inventaires (cartons), Transferts, Pertes (jours), P.Douane, Offert, PMIX
//   → relecture XLSX : parseSuivisStock + extractPmixFromWorkbook + diagnosticPreAnalyse
//   → calcul mono (calculer) et multi (calculerMultiRestaurants)
//   → export réel (exportExcel + logo injecté, téléchargement intercepté)
//   → relecture du classeur exporté et contrôle des totaux publiés.
// Aucun fichier existant n'est modifié ; backend/data.db est ouvert en readonly.
// Exécution : node tests/tmp_bout_en_bout.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import XLSX from "xlsx-js-style";
import JSZip from "jszip";

import { buildModelesWb, exportExcel } from "../src/utils/excelExporter.js";
import {
  enrichirAvecBaseLocale, parseSuivisStock, extractPmixFromWorkbook, diagnosticPreAnalyse,
} from "../src/utils/parsers.js";
import { calculer, calculerMultiRestaurants } from "../src/utils/calculators.js";
import { norm } from "../src/utils/formatters.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};
const TOL = 0.01;
const proche = (a, b, tol = TOL) => Math.abs(Number(a) - Number(b)) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const N = (v) => (v === undefined || v === null || v === "" ? 0 : Number(v));
const normaliser = (v) =>
  String(v || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
// Anomalie constatée sans casser la chaîne : comptée à part, à traiter dans le rapport.
const constats = [];
const constat = (titre, detail) => { constats.push({ titre, detail }); console.log(`CONSTAT - ${titre}${detail ? " — " + detail : ""}`); };

// ── 0. Sources vivantes (lecture seule) ──────────────────────────────────────
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (cle) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(cle); return r ? JSON.parse(r.v) : null; };

const articlesBdd = db.prepare(
  "SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles WHERE actif = 1"
).all();
const ratios = charge("bk_sia_ratios_parsed_v1");
const baseArticle = charge("bk_sia_base_article_map_v1") || {};
const localArticles = charge("bk_sia_local_articles_v1") || {};
const pmixComplement = charge("bk_sia_pmix_complement_v1") || {};
const codesRestos = db.prepare("SELECT code FROM restaurants WHERE actif = 1").all().map((r) => r.code);
const produits = (ratios || {}).allProducts || [];

console.log("=== A. SOURCES ===");
console.log(`articles actifs ${articlesBdd.length} | produits Ratio ${produits.length} | base article ${Object.keys(baseArticle).length} | base locale ${Object.keys(localArticles).length} | complément PMIX ${Object.keys(pmixComplement).length} | restaurants actifs ${codesRestos.join(", ")}`);
check(articlesBdd.length > 0 && produits.length > 0, "sources non vides (base articles + Ratio)");
check(codesRestos.includes("BK1"), "BK1 présent parmi les restaurants actifs");

// Même ordre que l'onglet Base articles (référence exemplaire) puis enrichissement base locale.
function ordonnerSelonExemple(articles) {
  const wbRef = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wbRef.Sheets.inventaire, { header: 1, defval: null });
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

const ordered = enrichirAvecBaseLocale(ordonnerSelonExemple(articlesBdd), localArticles);
const wb = buildModelesWb(ordered, produits, "BK1", "Octobre 2026", "01/10/2026", codesRestos, pmixComplement, articlesBdd);
const WS = (n) => wb.Sheets[n];
const CELL = (sn, r, c) => WS(sn)[XLSX.utils.encode_cell({ r, c })];
const PUT = (sn, r, c, cell) => { WS(sn)[XLSX.utils.encode_cell({ r, c })] = cell; };

console.log("\n=== B. MODÈLE GÉNÉRÉ ===");
console.log("feuilles :", wb.SheetNames.join(" | "));
check(
  ["Inventaire Initial", "Inventaire Final", "Transferts", "Pertes", "P.Douane", "Offert", "PMIX"].every((n) => !!WS(n)),
  "les 7 feuilles de saisie sont présentes"
);

// ── 1. Inventaires : 10 cartons au début, 2 à la fin, sur toutes les lignes cotées ──
function lignesInventaire(nomFeuille) {
  const rows = XLSX.utils.sheet_to_json(WS(nomFeuille), { header: 1, defval: null });
  const out = [];
  for (let r = 6; r < rows.length; r++) {
    const x = rows[r]; if (!x) continue;
    // Même règle que parseInventaire : désignation en C, repli sur B, et le tableau s'arrête
    // sur la ligne « TOTAL STOCK » (écrite en B) avant le récapitulatif par catégorie.
    const nom = typeof x[2] === "string" && x[2].trim() ? x[2] : x[1];
    if (typeof nom !== "string" || !nom.trim()) continue;
    if (/^total\b/i.test(nom.trim())) break;
    out.push({ r, nom: nom.trim(), code: x[13] == null ? "" : String(x[13]).trim(), cond: N(x[3]), prix: N(x[10]) });
  }
  return out;
}
const invIniLignes = lignesInventaire("Inventaire Initial");
const invFinLignes = lignesInventaire("Inventaire Final");
const QTE_INI = 10, QTE_FIN = 2;
for (const l of invIniLignes) PUT("Inventaire Initial", l.r, 5, { t: "n", v: QTE_INI });
for (const l of invFinLignes) PUT("Inventaire Final", l.r, 5, { t: "n", v: QTE_FIN });
console.log(`Inventaire : ${invIniLignes.length} lignes remplies à ${QTE_INI} cartons (initial), ${invFinLignes.length} à ${QTE_FIN} (final)`);

// Prix publiés par la feuille masquée « Référentiel Articles » : c'est la source du VLOOKUP des
// Transferts et de P.Douane. On la lit avant de choisir les témoins pour n'en retenir que des
// articles réellement valorisables par le classeur.
const refRows = XLSX.utils.sheet_to_json(WS("Référentiel Articles"), { header: 1, defval: null });
const prixParCode = new Map();
refRows.slice(1).forEach((r) => { if (r && r[0] != null) prixParCode.set(normaliser(r[0]), N(r[5])); });

// Trois articles témoins : cotés dans le classeur, codés, et valorisables via le référentiel.
const temoins = invIniLignes
  .filter((l) => l.code && l.prix > 0 && l.cond > 0 && prixParCode.get(normaliser(l.code)) > 0)
  .slice(0, 3);
check(temoins.length === 3, `3 articles témoins retenus (${temoins.map((t) => t.nom).join(" ; ")})`);

// ── 2. Transferts : 5 cartons par article témoin ────────────────────────────
// Le classeur valorise I = VLOOKUP(E ; Référentiel Articles) et J = H × I. SheetJS ne publie
// pas les formules sans valeur en cache : on écrit la valeur recalculée, comme Excel.
const transferts = temoins.map((t, i) => {
  const r = 4 + i;
  const prix = prixParCode.get(normaliser(t.code));
  PUT("Transferts", r, 0, { t: "s", v: "01/10/2026" });
  PUT("Transferts", r, 1, { t: "s", v: "BK1" });
  PUT("Transferts", r, 2, { t: "s", v: t.nom });
  PUT("Transferts", r, 3, { t: "s", v: "Test" });
  PUT("Transferts", r, 4, { t: "s", v: t.code });
  PUT("Transferts", r, 5, { t: "s", v: "Pack" });
  PUT("Transferts", r, 6, { t: "n", v: t.cond });
  PUT("Transferts", r, 7, { t: "n", v: 5 });
  PUT("Transferts", r, 8, { t: "n", v: prix });
  PUT("Transferts", r, 9, { t: "n", v: 5 * prix });
  return { ...t, prix };
});
console.log("Transferts :", transferts.map((t) => `${t.nom} 5×${t.prix} = ${5 * t.prix}`).join(" | "));
check(transferts.every((t) => t.prix > 0), "chaque article témoin est valorisé dans le Référentiel Articles (VLOOKUP)");

// ── 3. Pertes : 7 pièces sur 3 lignes pré-remplies, au jour 1 ───────────────
const perteRows = [];
{
  const rows = XLSX.utils.sheet_to_json(WS("Pertes"), { header: 1, defval: null });
  for (let r = 4; r < rows.length && perteRows.length < 3; r++) {
    const x = rows[r]; if (!x) continue;
    const nom = x[1], cond = N(x[2]), prix = N(x[3]);
    if (typeof nom !== "string" || !nom.trim()) continue;
    if (!(cond > 0 && prix > 0)) continue;
    const pu = prix / cond;
    PUT("Pertes", r, 4, { t: "n", v: pu });        // E : prix pièce (formule recalculée)
    PUT("Pertes", r, 6, { t: "n", v: 7 });         // G : quantité perte = Σ jours
    PUT("Pertes", r, 7, { t: "n", v: 7 * pu });    // H : valeur
    PUT("Pertes", r, 9, { t: "n", v: 7 });         // J : jour 1
    perteRows.push({ r, nom: nom.trim(), cond, prix, pu });
  }
}
console.log("Pertes :", perteRows.map((p) => `${p.nom} 7×${p.pu.toFixed(2)} = ${(7 * p.pu).toFixed(2)}`).join(" | "));
check(perteRows.length === 3, "3 lignes de pertes cotées dans la table du CDG");

// ── 4. P.Douane : 10 cartons sur 2 articles + TOTAL recalculé ───────────────
// Modèle vide : A date, D code, F quantité ; G/H/I et la ligne TOTAL sont des formules.
const douaneLignes = transferts.slice(0, 2).map((t, i) => {
  const r = 4 + i;
  const pu = t.prix / t.cond;
  PUT("P.Douane", r, 0, { t: "s", v: "01/10/2026" });
  PUT("P.Douane", r, 3, { t: "s", v: t.code });
  PUT("P.Douane", r, 4, { t: "n", v: t.cond });
  PUT("P.Douane", r, 5, { t: "n", v: 10 });
  PUT("P.Douane", r, 6, { t: "n", v: t.prix });
  PUT("P.Douane", r, 7, { t: "n", v: pu });
  PUT("P.Douane", r, 8, { t: "n", v: 10 * pu });
  return { ...t, pu, valeur: 10 * pu };
});
PUT("P.Douane", 204, 8, { t: "n", v: douaneLignes.reduce((s, d) => s + d.valeur, 0) }); // ligne TOTAL
console.log("P.Douane :", douaneLignes.map((d) => `${d.nom} 10×${d.pu.toFixed(2)} = ${d.valeur.toFixed(2)}`).join(" | "));

// ── 5. Offert : 10 staff meal + 5 offerts, Total recalculé ──────────────────
PUT("Offert", 2, 1, { t: "n", v: 10 });
PUT("Offert", 2, 4, { t: "n", v: 5 });
PUT("Offert", 2, 7, { t: "n", v: 15 });
console.log("Offert : staff 10 + offer 5 = Total 15");

// ── 6. PMIX : 5 PLU du Ratio, 100 ventes chacun, prix et montant recalculés ──
const pmixPlu = [];
for (const p of produits) {
  if (pmixPlu.length >= 5) break;
  const plu = p && p.plu != null ? String(p.plu).trim() : "";
  const cout = N(p && p.coutTheo);
  if (!plu || !(cout > 0)) continue;
  if (pmixPlu.some((x) => x.plu === plu)) continue;
  pmixPlu.push({ plu, nom: String(p.nom || "").trim(), cout });
}
const QTE_VENDUE = 100;
pmixPlu.forEach((p, i) => {
  const r = 2 + i;
  PUT("PMIX", r, 0, { t: "s", v: p.plu });
  PUT("PMIX", r, 2, { t: "n", v: QTE_VENDUE });
  PUT("PMIX", r, 3, { t: "n", v: p.cout });
  PUT("PMIX", r, 4, { t: "n", v: p.cout * QTE_VENDUE });
});
console.log("PMIX :", pmixPlu.map((p) => `${p.plu} «${p.nom}» 100×${p.cout}`).join(" | "));
check(pmixPlu.length === 5, "5 PLU du Ratio avec coût unitaire");

// ── 7. Aller-retour disque puis relecture « production » ────────────────────
const bufSaisie = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
const relu = XLSX.read(bufSaisie, { type: "buffer" });
const stockData = parseSuivisStock(relu, baseArticle, ratios, localArticles);
const pmixItems = extractPmixFromWorkbook(relu, "BK1");
const alertes = diagnosticPreAnalyse(relu, baseArticle, ratios, localArticles);

console.log("\n=== C. RELECTURE DU FICHIER SAISI ===");
console.log(`invIni ${Object.keys(stockData.invIni).length} | invFin ${Object.keys(stockData.invFin).length} | transferts ${stockData.sorties.length} | pertes ${stockData.pertes.length} | douane ${stockData.douane.length} | offerts ${Object.keys(stockData.offerts).length} | PMIX ${pmixItems.length} | site «${stockData.site}»`);
const totalUnique = new Set(invIniLignes.map((l) => norm(l.nom))).size;
check(Object.keys(stockData.invIni).length === totalUnique,
  "Inventaire initial relu : aucun article perdu ni dupliqué",
  `${Object.keys(stockData.invIni).length} relus / ${totalUnique} uniques`);
if (totalUnique !== invIniLignes.length) {
  const doublons = invIniLignes.map((l) => norm(l.nom)).filter((k, i, a) => a.indexOf(k) !== i);
  constat("désignations dupliquées dans le modèle d'inventaire", `${invIniLignes.length} lignes → ${totalUnique} clés (${doublons.join(", ")})`);
}
check(stockData.site === "BK1", `site relu = BK1 (lu «${stockData.site}»)`);
check(stockData.sorties.length === 3, `3 transferts relus (lu ${stockData.sorties.length})`);
check(stockData.pertes.length === 3, `3 pertes relues (lu ${stockData.pertes.length})`);
check(stockData.douane.length === 2, `2 prélèvements douane relus (lu ${stockData.douane.length})`);
check(pmixItems.length === 5, `5 lignes PMIX relues (lu ${pmixItems.length})`);
check(pmixItems.every((p) => p.qty === QTE_VENDUE && p.price > 0), "PMIX : quantités et prix relus",
  pmixItems.filter((p) => !(p.qty === QTE_VENDUE && p.price > 0)).map((p) => p.plu).join(" ; "));
{
  const attenduAmont = pmixItems.reduce((s, p) => s + 100 * p.price, 0);
  if (pmixItems.some((p) => p.amount === 0) && attenduAmont > 0) {
    constat("PMIX : colonne « Amount » perdue à la relecture du modèle généré",
      `${pmixItems.length} lignes à ${attenduAmont.toFixed(2)} F de montant saisies, relues à 0 F — parsers.js : 1053 détecte « INDICATEUR » (récap H1) comme colonne « CA » via /amount|montant|ca/i, d'où colAmount = 7 au lieu de 4`);
  }
}

for (const t of temoins) {
  const a = stockData.invIni[norm(t.nom)];
  const b = stockData.invFin[norm(t.nom)];
  check(!!a && a.qtePieces === QTE_INI * a.qteCdt && !!b && b.qtePieces === QTE_FIN * b.qteCdt,
    `inventaire ${t.nom} : ${QTE_INI} cartons lus ${a ? a.qtePieces : "?"} pièces, ${QTE_FIN} cartons lus ${b ? b.qtePieces : "?"} pièces`,
    a && b ? `colisage ${a.qteCdt}` : "article absent");
}
for (const t of transferts) {
  const s = stockData.sorties.find((x) => norm(x.designation) === norm(t.nom));
  check(!!s && s.qte === 5 && proche(s.valeur, 5 * t.prix) && s.qtePieces === 5 * s.qteCdt,
    `transfert ${t.nom} : 5 cartons = ${s ? s.valeur.toFixed(2) : "?"} F, ${s ? s.qtePieces : "?"} pièces`);
}
for (const p of perteRows) {
  const x = stockData.pertes.find((y) => norm(y.nom) === norm(p.nom));
  check(!!x && x.qtePieces === 7 && proche(x.valeur, 7 * p.pu),
    `perte ${p.nom} : 7 pièces = ${x ? x.valeur.toFixed(2) : "?"} F`);
}
check(proche(stockData.douaneTotal, douaneLignes.reduce((s, d) => s + d.valeur, 0)),
  `douane : TOTAL relu ${stockData.douaneTotal.toFixed(2)} F = somme des 2 lignes`);
check(!!stockData.offerts["BK1"] && stockData.offerts["BK1"].total === 15,
  `offert : Total relu = ${stockData.offerts["BK1"] ? stockData.offerts["BK1"].total : "?"} (10 + 5)`);

const critiques = alertes.filter((a) => a.niveau === "critique");
console.log(`Diagnostic pré-analyse : ${alertes.length} alerte(s) — ${critiques.length} critique(s)`);
alertes.forEach((a) => console.log(`   [${a.niveau}] ${a.titre}`));
check(critiques.length === 0, "diagnostic pré-analyse : aucune alerte critique sur le fichier saisi");

// ── 8. Calcul mono ──────────────────────────────────────────────────────────
const calc = calculer(stockData, [{ restaurant: "BK1", periode: "Octobre 2026", items: pmixItems }], ratios, baseArticle, pmixComplement);
const somme = (arr, f) => arr.reduce((s, x) => s + N(f(x)), 0);
const attendu = {
  valIni: somme(Object.values(stockData.invIni), (a) => a.valeur),
  valFin: somme(Object.values(stockData.invFin), (a) => a.valeur),
  entrees: somme(stockData.sorties, (s) => s.valeur),
  pertes: somme(stockData.pertes, (p) => p.valeur),
  theo: somme(pmixItems, (p) => { const f = ratios.byPlu[p.plu]; return f ? f.coutTheo * p.qty : 0; }),
  couverts: somme(pmixItems, (p) => p.qty),
  ca: somme(pmixItems, (p) => p.amount),
};

console.log("\n=== D. CALCUL MONO (RG-03 / RG-06 / RG-07) ===");
console.log(`Stock initial ${calc.totalValIni.toFixed(2)} | final ${calc.totalValFin.toFixed(2)} | transferts ${calc.totalEntrees.toFixed(2)} | pertes ${calc.totalPertes.toFixed(2)}`);
console.log(`Conso réelle ${calc.consoReelle.toFixed(2)} | conso théo ${calc.consoTheoTotal.toFixed(2)} | écart ${calc.ecartMatiere.toFixed(2)} (${(calc.ecartMatiereP * 100).toFixed(2)} %)`);
console.log(`Couverts ${calc.couverts} | fiches matchées ${calc.ficheMatchees} | complément ${calc.complementMatchees} | douane ${calc.douaneTotal.toFixed(2)} | offerts ${calc.totalOfferts} | CA PMIX ${calc.ca.toFixed(2)}`);

check(proche(calc.totalValIni, attendu.valIni), "calcul : stock initial = somme des valeurs relues");
check(proche(calc.totalValFin, attendu.valFin), "calcul : stock final = somme des valeurs relues");
check(proche(calc.totalEntrees, attendu.entrees), "calcul : entrées = somme des transferts");
check(proche(calc.totalPertes, attendu.pertes), "calcul : pertes = somme des pertes relues");
check(proche(calc.variationStock, attendu.valIni - attendu.valFin), "calcul : variation = initial − final");
check(proche(calc.consoReelle, calc.variationStock + calc.totalEntrees), "calcul : conso réelle = variation + transferts (RG-03)");
check(calc.couverts === attendu.couverts, `calcul : couverts = ${attendu.couverts}`);
check(calc.ficheMatchees === 5, `calcul : 5 fiches Ratio matchées (lu ${calc.ficheMatchees})`);
check(proche(calc.consoTheoTotal, attendu.theo), "calcul : conso théorique = Σ coût PLU × quantité", `${calc.consoTheoTotal} vs ${attendu.theo}`);
check(proche(calc.ecartMatiere, calc.consoReelle - calc.consoTheoTotal), "calcul : écart = conso réelle − conso théorique (RG-06)");
check(proche(calc.ecartMatiereP, calc.ecartMatiere / calc.consoTheoTotal), "calcul : taux d'écart = écart / conso théorique");
check(proche(calc.douaneTotal, stockData.douaneTotal), "calcul : douane reportée du fichier");
check(calc.totalOfferts === 15, "calcul : offerts = 15");
check(proche(calc.ca, attendu.ca), "calcul : CA PMIX = Σ montants relus");

{
  const parNom = new Map(calc.articlesEcart.map((a) => [normaliser(a.nom), a]));
  const ko = [];
  for (const t of temoins) {
    const a = parNom.get(normaliser(t.nom));
    if (!a || a.iniPieces !== QTE_INI * a.qteCdt || a.finPieces !== QTE_FIN * a.qteCdt) ko.push(`${t.nom} : ini/fin`);
  }
  for (const t of transferts) {
    const a = parNom.get(normaliser(t.nom));
    if (!a || !(a.entreesPieces > 0)) ko.push(`${t.nom} : entrées`);
  }
  for (const p of perteRows) {
    const a = parNom.get(normaliser(p.nom));
    if (!a || a.pertesPieces < 7) ko.push(`${p.nom} : pertes`);
  }
  check(ko.length === 0, "écart par article : quantités initial/final/entrées/pertes rattachées", ko.join(" ; "));
}
{
  const ko = calc.articlesEcart.filter((a) => {
    const theo = a.iniPieces + a.entreesPieces - a.ventesPieces - a.pertesPieces;
    return Math.abs(a.stockTheo - theo) > 1e-6 || Math.abs(a.ecartPieces - (a.stockTheo - a.finPieces)) > 1e-6;
  });
  check(ko.length === 0, `écart par article : identité stock théorique et écart vérifiée sur ${calc.articlesEcart.length} articles`,
    ko.slice(0, 3).map((a) => `${a.nom} : ${a.stockTheo}`).join(" ; "));
  const sansPrix = calc.articlesEcart.filter((a) => !(a.puPiece > 0) && !(a.puPieceCost > 0));
  check(sansPrix.every((a) => a.ecartVal === 0), "écart par article : une ligne sans prix n'est pas valorisée (0 F)",
    sansPrix.filter((a) => a.ecartVal !== 0).map((a) => a.nom).join(" ; "));
  if (sansPrix.length > 0) {
    constat("articles sans aucun prix dans le classeur ni dans les référentiels",
      `${sansPrix.length} ligne(s) : ${sansPrix.slice(0, 10).map((a) => a.nom).join(", ")}${sansPrix.length > 10 ? " …" : ""}`);
  }
}

// ── 9. Calcul multi-restaurants (2 copies du même suivi) ────────────────────
const stock2 = JSON.parse(JSON.stringify(stockData));
const multi = calculerMultiRestaurants(
  [stockData, stock2],
  [pmixItems, JSON.parse(JSON.stringify(pmixItems))],
  ratios, baseArticle, pmixComplement
);
console.log("\n=== E. CALCUL MULTI (2 sites) ===");
console.log(`Stock initial ${multi.totalValIni.toFixed(2)} | conso réelle ${multi.consoReelle.toFixed(2)} | conso théo ${multi.consoTheoTotal.toFixed(2)} | écart ${multi.ecartMatiere.toFixed(2)} | couverts ${multi.couverts}`);
check(multi.isMulti === true, "multi : drapeau isMulti");
check(multi.parRestaurant.length === 2, `multi : 2 restaurants agrégés (lu ${multi.parRestaurant.length})`);
check(proche(multi.totalValIni, 2 * calc.totalValIni), "multi : stock initial = 2 × mono");
check(proche(multi.totalEntrees, 2 * calc.totalEntrees), "multi : entrées = 2 × mono");
check(proche(multi.consoTheoTotal, 2 * calc.consoTheoTotal), "multi : conso théorique = 2 × mono");
check(proche(multi.consoReelle, 2 * calc.consoReelle), "multi : conso réelle = 2 × mono");
check(proche(multi.ecartMatiere, 2 * calc.ecartMatiere), "multi : écart = 2 × mono");
check(multi.couverts === 2 * calc.couverts, `multi : couverts = 2 × mono (${multi.couverts})`);

// ── 10. Export réel (téléchargement intercepté) ─────────────────────────────
const rapport = {
  titre: "ANALYSE E2E 27/10/2026",
  status: "draft",
  history: [],
  data: {
    site: "BK1",
    stockData,
    calc,
    ratiosMeta: { label: "Ratio Q3 (test E2E)" },
    ficheMatchees: calc.ficheMatchees,
    pmixTheo: calc.pmixTheo,
  },
};

let blobCapture = null;
const ancienDocument = globalThis.document;
const ancienCreate = URL.createObjectURL;
const ancienRevoke = URL.revokeObjectURL;
globalThis.document = { createElement: () => ({ click() {} }) };
URL.createObjectURL = (blob) => { blobCapture = blob; return "blob:e2e"; };
URL.revokeObjectURL = () => {};
try {
  await exportExcel(rapport);
} catch (e) {
  check(false, "export Excel : aucune exception", e.message);
} finally {
  globalThis.document = ancienDocument;
  URL.createObjectURL = ancienCreate;
  URL.revokeObjectURL = ancienRevoke;
}
check(!!blobCapture, "export Excel : classeur produit et téléchargement déclenché");
const bufExport = blobCapture ? Buffer.from(await blobCapture.arrayBuffer()) : null;
console.log(`\n=== F. EXPORT ===\nClasseur exporté : ${bufExport ? bufExport.length : 0} octets`);

if (bufExport) {
  const wbExport = XLSX.read(bufExport, { type: "buffer" });
  console.log("feuilles :", wbExport.SheetNames.join(" | "));
  check(["Synthèse", "Écart par article", "Pertes", "Conso théo ingrédients", "PMIX valorisé", "Anomalies", "Douane", "Historique"].every((n) => wbExport.Sheets[n]),
    "export : les 8 feuilles du rapport sont présentes");

  const synthese = XLSX.utils.sheet_to_json(wbExport.Sheets["Synthèse"], { header: 1, defval: null });
  const valeur = (label) => {
    const row = synthese.find((r) => r && String(r[0] ?? "").trim() === label);
    return row ? N(row[1]) : null;
  };
  const attendusSynthese = [
    ["Stock initial", calc.totalValIni],
    ["Stock final", calc.totalValFin],
    ["Variation de stock (Ini − Fin)", calc.variationStock],
    ["+ Transferts AGL → BK (entrées)", calc.totalEntrees],
    ["= CONSOMMATION RÉELLE", calc.consoReelle],
    ["Pertes contrôlées valorisées", calc.totalPertes],
    ["Prélèvements Douane", calc.douaneTotal],
    ["Offerts / Repas", calc.totalOfferts],
    ["Consommation théorique", calc.consoTheoTotal],
    ["Consommation réelle", calc.consoReelle],
    ["Écart matières", calc.ecartMatiere],
    ["Couverts vendus", calc.couverts],
  ];
  const ecartsSynth = attendusSynthese.filter(([l, v]) => valeur(l) === null || !proche(valeur(l), v));
  check(ecartsSynth.length === 0, "export : les 12 totaux de la Synthèse égalent le calcul",
    ecartsSynth.map(([l, v]) => `${l} : ${valeur(l)} ≠ ${v}`).join(" ; "));

  const syntheseVersion = synthese.find((r) => r && String(r[0] ?? "").trim() === "Version Ratios");
  check(!!syntheseVersion && syntheseVersion[1] === "Ratio Q3 (test E2E)", "export : version Ratios reportée");

  const lignesExport = (nom, colCle) => {
    const rows = XLSX.utils.sheet_to_json(wbExport.Sheets[nom], { header: 1, defval: null });
    return rows.slice(2).filter((r) => r && r[colCle] !== null && r[colCle] !== "" && String(r[0] ?? "").trim() !== "TOTAL");
  };
  check(lignesExport("Écart par article", 1).length === calc.articlesEcart.length,
    `export : ${calc.articlesEcart.length} lignes dans « Écart par article »`);
  check(lignesExport("PMIX valorisé", 0).length === calc.pmixTheo.length,
    `export : ${calc.pmixTheo.length} lignes dans « PMIX valorisé »`);

  const pertesExport = XLSX.utils.sheet_to_json(wbExport.Sheets["Pertes"], { header: 1, defval: null });
  const totalPertesExport = pertesExport.find((r) => r && String(r[1] ?? "").trim() === "TOTAL");
  check(!!totalPertesExport && proche(totalPertesExport[4], calc.totalPertes),
    `export : TOTAL de la feuille Pertes = ${calc.totalPertes.toFixed(2)}`);
  check(pertesExport.slice(2).filter((r) => r && r[1] && String(r[1]).trim() !== "TOTAL" && r[4] != null).length === stockData.pertes.length,
    `export : ${stockData.pertes.length} lignes de pertes publiées`);

  const douaneExport = XLSX.utils.sheet_to_json(wbExport.Sheets["Douane"], { header: 1, defval: null });
  const totalDouane = douaneExport.find((r) => r && String(r[0] ?? "").trim() === "TOTAL");
  check(!!totalDouane && proche(totalDouane[7], calc.douaneTotal), `export : TOTAL Douane = ${calc.douaneTotal.toFixed(2)}`);

  const zip = await JSZip.loadAsync(bufExport);
  const logo = zip.file("xl/media/logo_bk_servair.png");
  const xmlWb = await zip.file("xl/workbook.xml").async("string");
  check(!!logo, "export : logo BK/Servair injecté dans le classeur");
  check(/fullCalcOnLoad="1"/.test(xmlWb), "export : recalcul complet demandé à l'ouverture (fullCalcOnLoad)");
}

console.log(`\n=== RÉSULTAT : ${ok} PASS / ${ko} FAIL ===`);
if (ko > 0) process.exitCode = 1;
