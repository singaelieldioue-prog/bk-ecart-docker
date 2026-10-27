// TEST DE BOUT EN BOUT AVEC DONNÉES FICTIVES — sur la copie corrigée.
// Remplit un classeur de test (ventes PMIX, stocks initial/final, transferts, pertes), puis
// rejoue la chaîne réelle (parseSuivisStock → extractPmixFromWorkbook → calculer) et vérifie
// chaque agrégat contre un recalcul indépendant, y compris l'identité RG-03.
// Les données sont pseudo-aléatoires mais reproductibles (graine fixe) et calibrées pour que
// la consommation réelle dépasse la théorique de 3,0 % — un écart volontaire, chiffré d'avance.
// Le classeur d'origine et la copie corrigée ne sont pas modifiés : sortie = *_TEST_fictif.xlsx
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import XLSX from "xlsx-js-style";
import { parseSuivisStock, extractPmixFromWorkbook } from "../src/utils/parsers.js";
import { calculer, resoudrePrix } from "../src/utils/calculators.js";
import { norm } from "../src/utils/formatters.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};
const f0 = (n) => Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
const f2 = (n) => Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CORR = path.resolve("../tmp_verif/Suivi_BK1_Octobre_2026_corrige.xlsx");
const TEST = path.resolve("../tmp_verif/Suivi_BK1_Octobre_2026_TEST_fictif.xlsx");
const ECART_CIBLE = 0.03;   // +3,0 % de consommation réelle au-dessus de la théorique

// Graine fixe : deux exécutions donnent exactement les mêmes chiffres.
let graine = 20261027;
const rnd = () => { graine = (graine * 1664525 + 1013904223) >>> 0; return graine / 4294967296; };

// ── Référentiels mémorisés (lecture seule) ──────────────────────────────────────────────────
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(path.resolve("../backend/data.db"), { readonly: true, fileMustExist: true });
const charge = (k) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(k); return r ? JSON.parse(r.v) : null; };
const baseArticle = charge("bk_sia_base_article_map_v1") || {};
const ratios = charge("bk_sia_ratios_parsed_v1") || {};
const localArticles = charge("bk_sia_local_articles_v1") || {};
const pmixComplement = charge("bk_sia_pmix_complement_v1") || {};
db.close();

const chemin = (nom) => resoudrePrix(nom, baseArticle, ratios, localArticles);

// ── 1. État de référence : la copie corrigée, vide ─────────────────────────────────────────
const wb = XLSX.read(fs.readFileSync(CORR), { type: "buffer" });
const vide = parseSuivisStock(wb, baseArticle, ratios, localArticles);
const ARTICLES = Object.entries(vide.invIni).map(([cle, it]) => ({
  cle, nom: it.nom, pu: it.puCarton || 0, code: it.codeArticle || "", cat: it.categorie || "",
}));
const valorisables = ARTICLES.filter((a) => a.pu > 0);

// ── 2. Ventes fictives : les 87 PLU du Ratio Q3 ────────────────────────────────────────────
const VENTES = Object.entries(ratios.byPlu).map(([plu, f]) => {
  const cost = Number(f.coutTheo) || 0;
  const qty = 40 + Math.round(rnd() * 180);                       // 40 à 220 unités vendues
  const price = Math.max(500, Math.round((cost * 3.2) / 50) * 50); // prix de vente ≈ 3,2 × coût
  return { plu: String(plu), nom: f.nom || "", cost, qty, price, amount: qty * price };
});
const attends = {
  CA: VENTES.reduce((s, v) => s + v.amount, 0),
  couverts: VENTES.reduce((s, v) => s + v.qty, 0),
  theo: VENTES.reduce((s, v) => s + v.qty * v.cost, 0),
};

// ── 3. Transferts fictifs : 3 entrées AGL → BK1 ────────────────────────────────────────────
const TRANSFERTS = valorisables.filter((a) => a.code).slice(0, 3).map((a, i) => ({
  article: a, qty: [6, 4, 3][i], valeur: [6, 4, 3][i] * a.pu,
}));
attends.entrees = TRANSFERTS.reduce((s, t) => s + t.valeur, 0);

// ── 4. Pertes fictives : 10 articles, 3 pièces perdus sur 2 jours ──────────────────────────
const wsPertes = wb.Sheets["Pertes"];
const rowsPertes = XLSX.utils.sheet_to_json(wsPertes, { header: 1, defval: null });
const PERTES = [];
for (let i = 4; i < rowsPertes.length && PERTES.length < 10; i++) {
  const r = rowsPertes[i];
  const nom = r && typeof r[1] === "string" ? r[1].trim() : "";
  if (!nom) continue;
  const puPiece = chemin(nom).puPiece || 0;
  if (puPiece <= 0) continue;
  PERTES.push({ ligne: i + 1, nom, jours: [3, 2], puPiece });
}
attends.pertes = PERTES.reduce((s, p) => s + p.jours.reduce((a, b) => a + b, 0) * p.puPiece, 0);

// ── 5. Stocks fictifs : calibrés pour viser l'écart cible ──────────────────────────────────
const BASE = valorisables.map((a, i) => 1 + (i % 6));           // 1 à 6 cartons de base
const valeurBase = valorisables.reduce((s, a, i) => s + BASE[i] * a.pu, 0);
const cibleVariation = (1 + ECART_CIBLE) * attends.theo - attends.entrees;
const facteurIni = (2 * cibleVariation) / valeurBase;            // fin = ini / 2 ⇒ ini − fin = ini / 2
const QTE_INI = valorisables.map((a, i) => BASE[i] * facteurIni);
let QTE_FIN = QTE_INI.map((q) => q / 2);

// ── 6. Écriture du classeur de test ────────────────────────────────────────────────────────
const addr = (ligne, col) => XLSX.utils.encode_cell({ r: ligne - 1, c: col });
const poserNombre = (ws, ligne, col, v) => { ws[addr(ligne, col)] = { t: "n", v }; };
const poserTexte = (ws, ligne, col, v) => { ws[addr(ligne, col)] = { t: "s", v }; };
// Le classeur ne stocke que 4 décimales de carton : c'est cette valeur-là qui doit servir
// de référence au recalcul indépendant, sinon l'écart d'arrondi ferait échouer le contrôle.
const arrondi = (q) => Math.round(q * 1e4) / 1e4;

// Ventes
const wsPmix = wb.Sheets["PMIX"];
VENTES.forEach((v, i) => {
  const l = 3 + i;
  poserTexte(wsPmix, l, 0, v.plu);
  poserTexte(wsPmix, l, 1, v.nom);
  poserNombre(wsPmix, l, 2, v.qty);
  poserNombre(wsPmix, l, 3, v.price);
  poserNombre(wsPmix, l, 4, v.amount);
});
// Transferts (colonnes A date, B BK, C désignation, D catégorie, E code, G cond., H quantité)
const wsTr = wb.Sheets["Transferts"];
TRANSFERTS.forEach((t, i) => {
  const l = 5 + i;
  poserTexte(wsTr, l, 0, "2026-10-05");
  poserTexte(wsTr, l, 1, "BK1");
  poserTexte(wsTr, l, 2, t.article.nom);
  poserTexte(wsTr, l, 3, t.article.cat);
  poserTexte(wsTr, l, 4, t.article.code);
  poserNombre(wsTr, l, 7, t.qty);
});
// Pertes : saisies journalières (colonnes J et K = jours 1 et 2), la colonne G reste la formule
PERTES.forEach((p) => {
  poserNombre(wsPertes, p.ligne, 9, p.jours[0]);
  poserNombre(wsPertes, p.ligne, 10, p.jours[1]);
});
// Stocks : lignes des deux inventaires, appariées sur la désignation
const lignesStock = (nomFeuille) => {
  const ws = wb.Sheets[nomFeuille];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const map = new Map();
  for (let i = 6; i < rows.length; i++) {
    const r = rows[i] || [];
    if (r[2] && typeof r[2] === "string" && r[0]) map.set(norm(r[2]), i + 1);
  }
  return { ws, map };
};
const INIT = lignesStock("Inventaire Initial");
const FIN = lignesStock("Inventaire Final");
const ecrireStocks = () => {
  valorisables.forEach((a, i) => {
    const li = INIT.map.get(a.cle);
    if (li) poserNombre(INIT.ws, li, 5, arrondi(QTE_INI[i]));
    const lf = FIN.map.get(a.cle);
    if (lf) poserNombre(FIN.ws, lf, 5, arrondi(QTE_FIN[i]));
  });
};

const mesurer = () => {
  XLSX.writeFile(wb, TEST, { bookType: "xlsx", compression: true });
  const wbTest = XLSX.read(fs.readFileSync(TEST), { type: "buffer" });
  const sd = parseSuivisStock(wbTest, baseArticle, ratios, localArticles);
  const items = extractPmixFromWorkbook(wbTest, sd.site);
  const pmixList = items.length ? [{ restaurant: sd.site, periode: "", items }] : [];
  return { sd, items, calc: calculer(sd, pmixList, ratios, baseArticle, pmixComplement) };
};

// Calibration : on ajuste les quantités finales jusqu'à obtenir l'écart cible.
let etat = null;
for (let passe = 0; passe < 5; passe++) {
  ecrireStocks();
  etat = mesurer();
  const c = etat.calc;
  const cible = (1 + ECART_CIBLE) * c.consoTheoTotal;
  const ecartConso = c.consoReelle - cible;
  if (Math.abs(ecartConso) < 0.5) break;
  const nouveauFin = c.totalValFin + ecartConso;       // plus de stock final ⇒ moins de conso
  const k = nouveauFin / c.totalValFin;
  QTE_FIN = QTE_FIN.map((q) => q * k);
}
ecrireStocks();
etat = mesurer();
const { sd, items, calc } = etat;

// ── 7. Vérifications ──────────────────────────────────────────────────────────────────────
const proche = (a, b, tol = 0.01) => Math.abs(Number(a) - Number(b)) <= tol;

check(Object.keys(sd.invIni).length === 317 && Object.keys(sd.invFin).length === 317,
  `les 317 articles sont relus dans les deux inventaires (${Object.keys(sd.invIni).length} / ${Object.keys(sd.invFin).length})`);
check(items.length === VENTES.length, `${VENTES.length} PLU vendus relus depuis la feuille PMIX (${items.length})`);
check(sd.sorties.length === TRANSFERTS.length, `${TRANSFERTS.length} transferts relus (${sd.sorties.length})`);
check(sd.pertes.length === PERTES.length, `${PERTES.length} lignes de pertes relues (${sd.pertes.length})`);

check(proche(calc.ca, attends.CA), `CA = Σ (quantité × prix) des ventes : ${f2(calc.ca)} F`, `attendu ${f2(attends.CA)}`);
check(proche(calc.couverts, attends.couverts, 0.001), `couverts = Σ quantités vendues : ${f0(calc.couverts)}`, `attendu ${f0(attends.couverts)}`);
check(proche(calc.consoTheoTotal, attends.theo, 0.5), `conso théorique = Σ (quantité × coût Ratio) : ${f2(calc.consoTheoTotal)} F`, `attendu ${f2(attends.theo)}`);
check(calc.ficheMatchees === VENTES.length, `toutes les ventes sont rattachées à une fiche technique (${calc.ficheMatchees}/${VENTES.length})`);

const valIni = valorisables.reduce((s, a, i) => s + arrondi(QTE_INI[i]) * a.pu, 0);
const valFin = valorisables.reduce((s, a, i) => s + arrondi(QTE_FIN[i]) * a.pu, 0);
check(proche(calc.totalValIni, valIni, 1), `stock initial valorisé = Σ (cartons × prix carton) : ${f2(calc.totalValIni)} F`, `attendu ${f2(valIni)}`);
check(proche(calc.totalValFin, valFin, 1), `stock final valorisé = Σ (cartons × prix carton) : ${f2(calc.totalValFin)} F`, `attendu ${f2(valFin)}`);
check(proche(calc.totalEntrees, attends.entrees, 0.5), `transferts valorisés : ${f2(calc.totalEntrees)} F`, `attendu ${f2(attends.entrees)}`);

check(proche(calc.consoReelle, calc.totalValIni - calc.totalValFin + calc.totalEntrees, 0.01),
  `RG-03 : conso réelle = (stock initial − stock final) + transferts = ${f2(calc.consoReelle)} F`);
check(proche(calc.ecartMatiere, calc.consoReelle - calc.consoTheoTotal, 0.01),
  `écart matières = conso réelle − conso théorique = ${f2(calc.ecartMatiere)} F`);
check(calc.ecartMatiereP != null && Math.abs(calc.ecartMatiereP - ECART_CIBLE) < 0.001,
  `écart % = ${(calc.ecartMatiereP * 100).toFixed(2)} % (cible ${(ECART_CIBLE * 100).toFixed(1)} %)`);

const foodCost = calc.ca > 0 ? calc.consoTheoTotal / calc.ca : null;
check(foodCost != null && foodCost > 0.2 && foodCost < 0.45, `coût matière % CA = ${(foodCost * 100).toFixed(1)} % (plausible entre 20 et 45 %)`);

check(proche(calc.totalPertes, attends.pertes, 1), `pertes valorisées à la pièce : ${f2(calc.totalPertes)} F`, `attendu ${f2(attends.pertes)}`);
check(calc.totalPertes > 0 && !proche(calc.consoReelle, calc.totalValIni - calc.totalValFin + calc.totalEntrees + calc.totalPertes, 0.01),
  `les pertes restent hors du flux de stock (${f2(calc.totalPertes)} F non déduits de la conso réelle)`);

const cles = ["ca", "consoTheoTotal", "consoReelle", "ecartMatiere", "totalValIni", "totalValFin", "totalEntrees", "totalPertes"];
check(cles.every((k) => Number.isFinite(calc[k])) && calc.totalValIni > 0 && calc.totalValFin > 0,
  "aucun agrégat NaN / infini, stocks strictement positifs");
check((calc.doublonsInventaire || []).length === 0, `0 doublon signalé (${(calc.doublonsInventaire || []).length})`);
check((calc.anomaliesIntegrite || []).length === 1, `1 défaut d'intégrité (GANTS), inchangé (${(calc.anomaliesIntegrite || []).length})`);
check((calc.pluCoutNul || []).length === 0 && (calc.pluNonMatchés || []).length === 0,
  "aucun PLU à coût nul, aucun PLU non rattaché au Ratio");
check((calc.valorisationsBloquees || []).length === 0, "aucune ligne valorisée en aveugle : tout ce qui porte du stock a un prix");

// ── 8. Récapitulatif ──────────────────────────────────────────────────────────────────────
console.log("\n──────────────── RÉCAPITULATIF DES DONNÉES FICTIVES ────────────────");
console.log(`CA HT                        ${f2(calc.ca).padStart(16)} F`);
console.log(`Couvertures                  ${f0(calc.couverts).padStart(16)}`);
console.log(`Conso théorique              ${f2(calc.consoTheoTotal).padStart(16)} F   (${(foodCost * 100).toFixed(1)} % du CA)`);
console.log(`Stock initial                ${f2(calc.totalValIni).padStart(16)} F`);
console.log(`Transferts entrants          ${f2(calc.totalEntrees).padStart(16)} F`);
console.log(`Stock final                  ${f2(calc.totalValFin).padStart(16)} F`);
console.log(`Conso réelle                 ${f2(calc.consoReelle).padStart(16)} F`);
console.log(`Écart matières               ${f2(calc.ecartMatiere).padStart(16)} F   (${(calc.ecartMatiereP * 100).toFixed(2)} %)`);
console.log(`Pertes (hors flux)           ${f2(calc.totalPertes).padStart(16)} F`);
console.log(`Coût moyen par couvert       ${f2(calc.consoTheoTotal / calc.couverts).padStart(16)} F`);
console.log(`\nClasseur de test : ${TEST}`);
console.log(`\nRésultat : ${ok} PASS / ${ko} FAIL`);
process.exit(ko ? 1 : 0);
