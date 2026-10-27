// REJEU — chaîne complète sur tmp_verif/Suivi_BK1_Octobre_2026.xlsx (fichier du workspace,
// PAS le fichier rev27 du client). Lecture seule : aucune écriture en base ni dans le classeur.
// Reproduit App.jsx:525-537 : parseSuivisStock → extractPmixFromWorkbook → calculer.
// Exécution : node tests/tmp_rejeu_octobre.mjs
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { createRequire } from "node:module";
import { parseSuivisStock, extractPmixFromWorkbook } from "../src/utils/parsers.js";
import { calculer } from "../src/utils/calculators.js";

const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(path.resolve("../backend/data.db"), { readonly: true, fileMustExist: true });
const charge = (k) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(k); return r ? JSON.parse(r.v) : null; };
const baseArticle = charge("bk_sia_base_article_map_v1") || {};
const ratios = charge("bk_sia_ratios_parsed_v1") || {};
const localArticles = charge("bk_sia_local_articles_v1") || {};
const pmixComplement = charge("bk_sia_pmix_complement_v1") || {};
const ratiosMeta = charge("bk_sia_ratios_v1");
db.close();

const FICHIER = path.resolve(process.argv[2] || "../tmp_verif/Suivi_BK1_Octobre_2026.xlsx");
const wb = XLSX.read(fs.readFileSync(FICHIER), { type: "buffer" });
const sd = parseSuivisStock(wb, baseArticle, ratios, localArticles);
const items = extractPmixFromWorkbook(wb, sd.site);
const pmixList = items.length ? [{ restaurant: sd.site, periode: "", items }] : [];
const calc = calculer(sd, pmixList, ratios, baseArticle, pmixComplement);

const n = (v) => Number(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;
const group = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});

const parType = {};
for (const a of calc.anomaliesIntegrite || []) {
  parType[a.type] = parType[a.type] || { n: 0, exemples: [] };
  parType[a.type].n++;
  if (parType[a.type].exemples.length < 4) parType[a.type].exemples.push(a.nom);
}

const ecartsParOrigine = {};
for (const e of calc.ecartsPrix || []) {
  const g = ecartsParOrigine[e.origine] = ecartsParOrigine[e.origine] || { n: 0, montantAbs: 0, exemples: [] };
  g.n++;
  g.montantAbs += Math.abs(n(e.montant) * (n(e.qte) || 1));
  if (g.exemples.length < 3) g.exemples.push(`${e.nom} : ${r2(e.puSaisi)} → ${r2(e.puRef)}`);
}

const articles = calc.articlesEcart || [];
const sansPrix = articles.filter((a) => !a.puPiece || a.puPiece === 0);
const horsEcart = calc.articlesHorsEcart || [];
const pertesSansPrix = (sd.pertes || []).filter((p) => !(n(p.puPiece) > 0));
const pluCoutNul = calc.pluCoutNul || [];
const qtyCoutNul = pluCoutNul.reduce((s, p) => s + n(p.qty), 0);
const coutMoyenPlu = calc.couverts > 0 ? calc.consoTheoTotal / calc.couverts : 0;

const out = {
  fichier: FICHIER,
  avis: "Fichier du workspace (Suivi_BK1_Octobre_2026.xlsx), PAS la rev27 du client",
  site: sd.site,
  referentiel: {
    ratioLabel: ratiosMeta,
    nbProduits: Object.keys(ratios.byPlu || {}).length,
    nbIngredients: Object.keys(ratios.pmpByIng || {}).length,
  },
  global: {
    ca: r2(calc.ca),
    consoTheoTotal: r2(calc.consoTheoTotal),
    consoReelle: r2(calc.consoReelle),
    ecartMatiere: r2(calc.ecartMatiere),
    ecartMatiereP: calc.ecartMatiereP == null ? null : r2(calc.ecartMatiereP * 100),
    coutMatierePct: calc.ca > 0 ? r2((calc.consoTheoTotal / calc.ca) * 100) : null,
    coutMoyenAvec: r2(calc.coutMoyenAvec),
    coutMoyenSans: r2(calc.coutMoyenSans),
    couverts: n(calc.couverts),
    ficheMatchees: n(calc.ficheMatchees),
    totalValIni: r2(calc.totalValIni),
    totalValFin: r2(calc.totalValFin),
    totalEntrees: r2(calc.totalEntrees),
    totalPertes: r2(calc.totalPertes),
    totalOfferts: r2(calc.totalOfferts),
  },
  compteurs: {
    invIni: Object.keys(sd.invIni || {}).length,
    invFin: Object.keys(sd.invFin || {}).length,
    sorties: (sd.sorties || []).length,
    pertes: (sd.pertes || []).length,
    pmixPlu: items.length,
    articlesEcart: articles.length,
    articlesSansPrix: sansPrix.length,
    articlesHorsEcart: horsEcart.length,
    pertesSansPrix: pertesSansPrix.length,
    pluCoutNul: pluCoutNul.length,
    qtyCoutNul,
    partVentesCoutNul: calc.couverts > 0 ? r2((qtyCoutNul / calc.couverts) * 100) : null,
    ratioCoutNulCount: n(calc.ratioCoutNulCount),
    ratioCoutNulVendus: n(calc.ratioCoutNulVendus),
    valorisationsBloquees: (calc.valorisationsBloquees || []).length,
    doublonsInventaire: (calc.doublonsInventaire || []).length,
    pmixDoublons: (calc.pmixDoublons || []).length,
    pluNonMatches: (calc.pluNonMatchés || []).length,
    pluHorsMatiere: (calc.pluHorsMatiere || []).length,
  },
  anomalies: parType,
  doublonsInventaire: (calc.doublonsInventaire || []).map((d) => ({ type: d.type, nom: d.nom, code: d.code, lignes: d.lignes, noms: d.noms })),
  anomaliesIntegrite: (calc.anomaliesIntegrite || []).map((a) => ({ type: a.type, origine: a.origine, nom: a.nom, detail: a.detail })),
  ecartsPrix: ecartsParOrigine,
  horsEcartDetail: horsEcart.slice(0, 6).map((a) => ({ nom: a.nom, categorie: a.categorie, qte: a.qte, ini: r2(a.iniValeur), fin: r2(a.finValeur) })),
  sansPrixExemples: sansPrix.slice(0, 6).map((a) => ({ nom: a.nom, categorie: a.categorie, qte: a.qte })),
  pertesSansPrixExemples: pertesSansPrix.slice(0, 6).map((p) => ({ nom: p.nom, qtePieces: p.qtePieces })),
  pluCoutNulExemples: pluCoutNul.slice(0, 5).map((p) => ({ plu: p.plu, nom: p.nom, qty: p.qty })),
  estimationImpactCoutNul: r2(qtyCoutNul * coutMoyenPlu),
  whopper: (() => {
    const p = (calc.pmixTheo || []).find((x) => String(x.plu) === "110");
    return p ? { plu: p.plu, nom: p.nom, qty: p.qty, coutUnit: r2(p.coutUnit), prixVente: r2(p.price), coutTheo: r2(p.coutTheo), margeF: r2(n(p.price) - n(p.coutUnit)) } : null;
  })(),
};
console.log(JSON.stringify(out, null, 2));
