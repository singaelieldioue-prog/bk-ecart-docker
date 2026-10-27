// SUITE DURABLE — le conditionnement publié par la feuille cachée « Référentiel Articles »
// (celle que lisent les VLOOKUP de Transferts et P.Douane) doit être celui du classeur de
// référence du CDG, pas celui de la base locale :
//   · pour les articles de la table du CDG (src/utils/inventaireReferentielCdg.js) : le
//     conditionnement de l'« Inventaire initial » ;
//   · pour les 3 lignes où le classeur du CDG se contredit — son Inventaire initial porte
//     E=10 / 120 / 240 alors que sa base « Articles » (F) et son journal « Sorties » (H)
//     portent 100 / 10 / 4 — c'est la base Articles qui fait foi, car c'est elle qui vit
//     dans les transferts : GANTS SACHET PACK DE 100 l.378 F=100 (Sorties l.208 H=100),
//     Chicken crunchy filler l.586 F=10 (Sorties l.587 H=10), KAY-5 SANITIZER l.393 F=4
//     (Sorties H=4) ;
//   · pour les articles hors table du CDG : le conditionnement de la base, inchangé.
// Exécution : node tests/referentiel-cond-cdg.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { INVENTAIRE_REFERENTIEL_CDG } from "../src/utils/inventaireReferentielCdg.js";
import { parseBaseArticle, parseRatios, parseCorrespondance, buildArtListFromReferentiel } from "../src/utils/parsers.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};
const cle = (s) => String(s ?? "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");

// Base Articles du CDG (feuille « Articles », l.378 / 586 / 393) : conditionnements qui font foi
// là où l'Inventaire initial du même classeur est resté en arrière.
const COND_MAITRE = new Map([
  [cle("GANTS SACHET PACK DE 100"), 100],
  [cle("Chicken crunchy filler"), 10],
  [cle("KAY-5 SANITIZER"), 4],
]);
const TABLE = new Map();
INVENTAIRE_REFERENTIEL_CDG.forEach((t) => { const k = cle(t.nom); if (!TABLE.has(k)) TABLE.set(k, t); });

// ── Base réelle : BASE ARTICLE SIA + Ratio Q3 ─────────────────────────────��─────────────────
const lire = (rel) => XLSX.read(fs.readFileSync(new URL(rel, import.meta.url)), { type: "buffer" });
const ratioWb = lire("../../sample_data/RATIOS BURGER KING ABJ Q3 2026.xlsx");
const baseWb = lire("../../sample_data/BASE ARTICLE SIA.xlsx");
const ratios = parseRatios(ratioWb);
const baseArt = parseBaseArticle(baseWb);
const corr = parseCorrespondance(ratioWb);
const built = buildArtListFromReferentiel(baseArt, corr, ratios.waLandedCost, ratios.waByCode, null);
const articles = built.artList.map((a) => ({
  nom: a.nom, code: a.code, categorie: a.categorie, unite: a.unite,
  conditionnement: a.conditionnement || 1, qteInner: 0,
  pu_carton: a.puCarton || 0, pu_piece: a.puPiece || 0, fournisseur: "SIA",
}));
console.log(`base : ${articles.length} articles, ${articles.filter((a) => TABLE.has(cle(a.nom))).length} présents dans la table du CDG`);

const wb = buildModelesWb(articles, [], "BK1", "Octobre 2026", "", ["BK1"], [], []);
const ref = wb.Sheets["Référentiel Articles"];
check(!!ref, "feuille cachée « Référentiel Articles » publiée");
const lignes = XLSX.utils.sheet_to_json(ref, { header: 1, defval: null });
// A clé · B désignation · C catégorie · D unité · E cond. · F prix carton
const publie = new Map();
for (let i = 1; i < lignes.length; i++) {
  const nom = lignes[i][1];
  if (!nom) continue;
  if (!publie.has(cle(nom))) publie.set(cle(nom), { cond: lignes[i][4], pu: lignes[i][5], i: i + 1 });
}
check(publie.size >= 500, `référentiel : ${publie.size} désignations publiées`);

const attendu = (nom) => {
  const k = cle(nom);
  if (COND_MAITRE.has(k)) return COND_MAITRE.get(k);
  const t = TABLE.get(k);
  // 24 lignes du CDG n'ont pas de colisage (produits pesés) : la cellule reste vide chez lui,
  // la base locale garde la main.
  return t && t.cond !== undefined ? t.cond : null;
};

// 1. Chaque article de la table du CDG publié par la base porte le conditionnement du CDG.
const ecarts = [], manquants = [];
let couverts = 0;
for (const a of articles) {
  const att = attendu(a.nom);
  if (att === null) continue;
  const p = publie.get(cle(a.nom));
  if (!p) { manquants.push(a.nom); continue; }
  couverts++;
  if (Number(p.cond) !== Number(att)) ecarts.push(`${a.nom} : publié ${p.cond} ≠ attendu ${att} (base ${a.conditionnement}, l.${p.i})`);
}
check(couverts === articles.filter((a) => attendu(a.nom) !== null).length,
  `${couverts} articles du CDG cotés publiés et vérifiés (${articles.length} articles en base)`);
check(manquants.length === 0, "aucun article du CDG perdu dans le référentiel", manquants.slice(0, 6).join(" ; "));
check(ecarts.length === 0, "conditionnement = celui du CDG (base Articles pour les 3 lignes où l'Inventaire est en retard)", ecarts.slice(0, 10).join("\n         "));

// 2. Base synthétique volontairement fausse (cond. 999) : la table du CDG reprend la main sur
//    les 291 lignes qui portent un colisage (les 24 lignes pesées gardent la valeur de base,
//    comme dans le classeur du CDG où leur cellule est vide).
const faux = [...TABLE.values()].map((t, i) => ({
  nom: t.nom, code: "CDGCOND" + i, categorie: t.cat, unite: "Unité bidon",
  conditionnement: 999, qteInner: 0, pu_carton: 111111, pu_piece: 0, fournisseur: t.frns,
}));
const wb2 = buildModelesWb(faux, [], "BK1", "Octobre 2026", "", ["BK1"], [], []);
const l2 = XLSX.utils.sheet_to_json(wb2.Sheets["Référentiel Articles"], { header: 1, defval: null });
const p2 = new Map();
for (let i = 1; i < l2.length; i++) if (l2[i][1]) p2.set(cle(l2[i][1]), { cond: l2[i][4], i: i + 1 });
const aCorriger = [...TABLE.values()].filter((t) => attendu(t.nom) !== null);
const restes999 = aCorriger.filter((t) => Number(p2.get(cle(t.nom))?.cond) === 999 || p2.get(cle(t.nom)) === undefined);
check(restes999.length === 0, `base à 999 : les ${aCorriger.length} articles du CDG cotés reprennent le conditionnement du CDG`, restes999.slice(0, 5).map((t) => t.nom).join(" ; "));

// 3. Les 3 lignes en contradiction portent bien la valeur de la base Articles du CDG
//    (vérifiées sur la base synthétique : l'article « Chicken crunchy filler » n'existe pas
//    dans BASE ARTICLE SIA, mais il peut être saisi en local).
for (const [nom, val] of COND_MAITRE) {
  const p = p2.get(nom);
  check(p && Number(p.cond) === val, `base synthétique : conditionnement ${val} publié pour ${nom} (l.${p?.i})`, p ? `publié ${p.cond}` : "absent");
}

// 4. Un article hors table du CDG conserve le conditionnement de la base.
const horsTable = articles.find((a) => !TABLE.has(cle(a.nom)) && publie.has(cle(a.nom)) && a.conditionnement > 0);
const hp = horsTable ? publie.get(cle(horsTable.nom)) : null;
check(horsTable && Number(hp.cond) === Number(horsTable.conditionnement),
  `article hors CDG : ${horsTable?.nom} garde son conditionnement de base (${horsTable?.conditionnement})`, hp ? `publié ${hp.cond}` : "absent");

// 5. Transferts et P.Douane lisent bien la 5e colonne du référentiel (Cond.).
const ft = wb.Sheets["Transferts"]["G5"];
check(ft && String(ft.f).includes("'Référentiel Articles'") && String(ft.f).includes(",5,"),
  "Transferts G5 : COND. auto = VLOOKUP(..., 5) sur le référentiel", ft ? ft.f : "cellule absente");
const fd = wb.Sheets["P.Douane"]["E5"];
check(fd && String(fd.f).includes("'Référentiel Articles'") && String(fd.f).includes(",5,"),
  "P.Douane E5 : COND. auto = VLOOKUP(..., 5) sur le référentiel", fd ? fd.f : "cellule absente");

console.log(`\n${ok} PASS / ${ko} FAIL`);
process.exit(ko ? 1 : 0);
