// SUITE DURABLE — Round-trip réimport des feuilles Inventaire : génération → XLSX → parseSuivisStock.
// Vérifie que les valeurs publiées depuis la table du CDG (src/utils/inventaireReferentielCdg.js)
// survivent à l'écriture XML et sont relues par l'import avec la même sémantique :
//   · COLISAGE (D) → qteCdt, c'est lui qui convertit les pièces au réimport ;
//   · « Nb articles / inner » (E) → 1 inner saisi vaut E/D carton (et non 1 carton) ;
//   · Prix carton (K) → prix de secours quand le référentiel ne connaît pas l'article ;
//   · aucune ligne perdue, aucune ligne du récapitulatif avalée comme article, aucun stock fantôme.
// Exécution : node tests/inventaire-roundtrip-reimport.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { INVENTAIRE_REFERENTIEL_CDG } from "../src/utils/inventaireReferentielCdg.js";
import { PERTES_REFERENTIEL_CDG } from "../src/utils/pertesReferentielCdg.js";
import { CUSTOM_ARTICLES_ORDER } from "../src/utils/customArticleOrder.js";
import {
  parseSuivisStock, parseRatios, parseBaseArticle, parseCorrespondance, buildArtListFromReferentiel,
} from "../src/utils/parsers.js";
import { resoudrePrix } from "../src/utils/calculators.js";
import { norm } from "../src/utils/formatters.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};
const nb = (v) => (v === undefined || v === null || v === "" ? 0 : Number(v));
const proche = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
// Repli identique au filtre de l'exporteur (ponctuation supprimée) : c'est lui qui décide quels
// articles du base sont publiés, et la table du CDG se résout avec la même clé.
const cleFiltre = (s) => String(s ?? "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");

// Le CDG liste 316 lignes mais « SANITIZER TABLETTE » y figure deux fois (L309 et L316) : la
// première occurrence fait foi, exactement comme dans la feuille générée.
const TABLE = [];
{
  const vus = new Set();
  INVENTAIRE_REFERENTIEL_CDG.forEach((t) => { const k = norm(t.nom); if (vus.has(k)) return; vus.add(k); TABLE.push(t); });
}
const dansOrdre = new Set(CUSTOM_ARTICLES_ORDER.map(cleFiltre));

// ── Partie A — table du CDG seule : référentiel volontairement faux dans le modèle ───────────
const articles = TABLE.map((t, i) => ({
  nom: t.nom, code: "RT" + String(i).padStart(4, "0"), categorie: t.cat, fournisseur: t.frns,
  conditionnement: 999, qteInner: 0, unite: "Unité bidon", pu_carton: 111111, pu_piece: 0,
}));
const wb = buildModelesWb(articles, [], "BK1", "Octobre 2026", "", ["BK1"], [], []);

// Aller-retour disque : c'est le XML relu qui est vérifié, pas les cellules en mémoire.
const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
const back = XLSX.read(buf, { type: "buffer" });
const RATIOS_VIDES = { waLandedCost: {}, waByCode: {}, pmpByIng: {}, byPlu: {}, byNom: {} };
const parsed = parseSuivisStock(back, {}, RATIOS_VIDES, {});
const items = parsed.invIni;

const absents = TABLE.filter((t) => !items[norm(t.nom)]).map((t) => t.nom);
check(absents.length === 0, `les ${TABLE.length} articles du CDG reviennent à l'import (absents : ${absents.slice(0, 4).join(" ; ")})`);
check(Object.keys(items).length === TABLE.length, `aucun article en trop à l'import (${Object.keys(items).length} relus pour ${TABLE.length} publiés)`);

const fauxArticles = ["boissons", "nourriture-surgelé", "nourriture-frais", "nourriture-sec", "packaging", "produitsdenettoyage", "total", "totalstock"];
check(fauxArticles.every((k) => !items[k]), "le récapitulatif (Boissons… TOTAL) n'est pas relu comme des articles");

const condKO = [], cdtKO = [], puKO = [];
// Un 0 du CDG n'est pas un prix : c'est un article qu'il ne cote pas dans son Inventaire initial.
// Le prix CARTON de sa table des pertes prime alors (« le prix du carton doit primer », 26/10),
// puis le prix de la base, ici volontairement faux (111 111), pour prouver que le fichier publie
// bien un prix ; les codes synthétiques sont uniques, aucun jumeau n'intervient.
const PERTES_CARTON = new Map();
PERTES_REFERENTIEL_CDG.forEach((t) => { const k = norm(t.nom); if (nb(t.pu) > 0 && !PERTES_CARTON.has(k)) PERTES_CARTON.set(k, t); });
const prixCartonCdg = (nom, cond) => {
  const t = PERTES_CARTON.get(norm(nom));
  if (!t) return 0;
  return (nb(t.pu) / (nb(t.cond) > 0 ? nb(t.cond) : 1)) * (nb(cond) > 0 ? nb(cond) : 1);
};
const prixAttendu = (t) => (nb(t.pu) > 0 ? nb(t.pu) : (prixCartonCdg(t.nom, t.cond) || 111111));
TABLE.forEach((t) => {
  const it = items[norm(t.nom)];
  if (!it) return;
  const attenduCond = nb(t.cond);
  if (nb(it.colisage) !== attenduCond) condKO.push(`${t.nom} : attendu ${attenduCond || "(vide)"}, relu ${JSON.stringify(it.colisage)}`);
  const attenduCdt = t.cond > 0 ? t.cond : 1;
  if (it.qteCdt !== attenduCdt) cdtKO.push(`${t.nom} : qteCdt ${it.qteCdt} ≠ ${attenduCdt}`);
  if (!proche(it.puCarton, prixAttendu(t))) puKO.push(`${t.nom} : attendu ${prixAttendu(t)}, relu ${it.puCarton}`);
});
check(condKO.length === 0, `COLISAGE relu = colonne E du CDG (${TABLE.filter((t) => nb(t.cond) > 0).length} lignes cotées, ${TABLE.filter((t) => t.cond === undefined).length} vides)`, condKO.slice(0, 4).join(" ; "));
check(cdtKO.length === 0, "le réimport convertit les pièces avec le colisage du CDG (et 1 quand le CDG n'en donne pas)", cdtKO.slice(0, 4).join(" ; "));
check(puKO.length === 0, `le prix carton est relu au centime (prix du CDG, ou prix du fichier quand le CDG cote 0)`, puKO.slice(0, 4).join(" ; "));

// Modèle transmis vierge : aucune saisie ⇒ aucun stock fantôme ne doit apparaître.
const fantomes = Object.values(items).filter((it) => it.nbCartons !== 0 || it.valeur !== 0 || it.qtePieces !== 0);
check(fantomes.length === 0, "un modèle sans saisie s'importe à 0 (aucun stock fantôme)", fantomes.slice(0, 3).map((f) => f.nom).join(" ; "));

// L'« Inner » publié porte la taille de l'inner du CDG : 1 inner saisi = E/D carton, pas 1 carton.
const ligneDe = (book, nom) => {
  const ws = book.Sheets["Inventaire Initial"];
  for (let R = 7; ws["C" + R]; R++) {
    if (norm(ws["C" + R].v) === norm(nom)) return { ws, R };
  }
  return null;
};
const cibles = [
  ["SANITIZER TABLETTE ", 1380, 230],   // colisage 1380, inner 230
  ["CHILI CHEESE BITES", 300, 50],      // colisage 300, inner 50
];
cibles.forEach(([nom, cond, inner]) => {
  const l = ligneDe(back, nom);
  if (!l) return check(false, `${nom} introuvable dans la feuille écrite`);
  l.ws["G" + l.R] = { t: "n", v: 1 };   // 1 inner saisi
  const relu = parseSuivisStock(back, {}, RATIOS_VIDES, {}).invIni[norm(nom)];
  check(relu && proche(relu.nbCartons, inner / cond),
    `${nom.trim()} : 1 inner saisi = ${inner}/${cond} carton (relu ${relu ? relu.nbCartons : "?"})`);
});
// Symétrique : sans inner chez le CDG (COCA 50cL, colisage 6), la formule du CDG annule l'inner —
// c'est la conséquence assumée de « conditionnement pareil » ; le carton et les unités restent justes.
{
  const nom = "BOUTEILLE COCA COLA 50cL";
  const l = ligneDe(back, nom);
  check(!!l && !back.Sheets["Inventaire Initial"]["E" + l.R], `${nom} : « Nb articles / inner » reste vide, comme chez le CDG`);
  if (l) {
    l.ws["G" + l.R] = { t: "n", v: 1 };
    const relu = parseSuivisStock(back, {}, RATIOS_VIDES, {}).invIni[norm(nom)];
    check(relu && relu.nbCartons === 0, `${nom} : inner saisi sans inner de référence → 0 carton (formule IF(D>0,G*E/D,0) du CDG)`);
  }
}

// Inventaire Final relu à l'identique.
const finalKO = TABLE.filter((t) => {
  const it = parsed.invFin[norm(t.nom)];
  return !it || nb(it.colisage) !== nb(t.cond) || !proche(it.puCarton, prixAttendu(t));
});
check(finalKO.length === 0, "Inventaire Final : mêmes colisages et prix après réimport", finalKO.slice(0, 4).map((t) => t.nom).join(" ; "));

// ── Partie B — données réelles de sample_data ───────────────────────────────────────────────
const readWb = (rel) => XLSX.read(fs.readFileSync(new URL(rel, import.meta.url)), { type: "buffer" });
const ratioWb = readWb("../../sample_data/RATIOS BURGER KING ABJ Q3 2026.xlsx");
const baseWb = readWb("../../sample_data/BASE ARTICLE SIA.xlsx");
const ratios = parseRatios(ratioWb);
const baseArt = parseBaseArticle(baseWb);
const corr = parseCorrespondance(ratioWb);
const built = buildArtListFromReferentiel(baseArt, corr, ratios.waLandedCost, ratios.waByCode, null);
const artsReels = built.artList.map((a) => ({
  nom: a.nom, code: a.code, categorie: a.categorie, unite: a.unite,
  conditionnement: a.conditionnement || 1, qteInner: 0,
  pu_carton: a.puCarton || 0, pu_piece: a.puPiece || 0, fournisseur: "SIA",
}));
const attendusReels = artsReels.filter((a) => dansOrdre.has(cleFiltre(a.nom)));
const publiesAttendus = new Set(attendusReels.map((a) => cleFiltre(a.nom)));
const wbReel = buildModelesWb(artsReels, [], "BK1", "Octobre 2026", "", ["BK1"], [], []);
const bufReel = XLSX.write(wbReel, { bookType: "xlsx", type: "buffer" });
const backReel = XLSX.read(bufReel, { type: "buffer" });
const parsedReel = parseSuivisStock(backReel, baseArt, ratios, {});
const itemsReel = parsedReel.invIni;

check(Object.keys(itemsReel).length === publiesAttendus.size,
  `données réelles : ${Object.keys(itemsReel).length} articles relus pour ${publiesAttendus.size} publiés (aucune perte, récap non avalé)`);

// Libellés que le base article écrit autrement que la liste de référence (ponctuation) : ils
// étaient exclus en silence des inventaires avant le repli de normalisation du 26/10.
const VARIANTES = ["BOUTEILLE PEPSI 1,5L", "HAMBURGER PATTY - Toledo", "WHOPPER PATTY  - Toledo", "BUN 4’’ NOUGATINE ", "CAN PEPSI 250 ml"];
const variantesKO = VARIANTES.filter((n) => !Object.values(itemsReel).some((it) => cleFiltre(it.nom) === cleFiltre(n)));
check(variantesKO.length === 0, `les ${VARIANTES.length} libellés du CDG écrits autrement dans le base article (1.5L, Toledo, 4'', 250ML) sont publiés et relus`, variantesKO.join(" ; "));

const cdgParNom = new Map(TABLE.map((t) => [cleFiltre(t.nom), t]));
const reelCondKO = [], reelPuKO = [];
let couverts = 0;
Object.values(itemsReel).forEach((it) => {
  const t = cdgParNom.get(cleFiltre(it.nom));
  if (!t) return;
  couverts++;
  const p = resoudrePrix(it.nom, baseArt, ratios, {});
  // Colisage relu : celui du fichier (CDG) ; quand le CDG n'en donne pas, la cellule reste vide
  // et l'import retombe sur le colisage du référentiel, comme avant alignement.
  const attenduCdt = t.cond > 0 ? t.cond : (Number(p.qteCdt) > 0 ? Number(p.qteCdt) : 1);
  if (it.qteCdt !== attenduCdt) reelCondKO.push(`${it.nom} : ${it.qteCdt} ≠ ${attenduCdt}`);
  // Prix relu : le référentiel prime (sémantique de l'import), puis le prix du fichier — celui du
  // CDG ou, quand il cote 0, son prix CARTON de la table des pertes — puis la dérivation pièce.
  const basePu = Number(p.pmpCarton) > 0 ? Number(p.pmpCarton) : 0;
  const puCdg = nb(t.pu) > 0 ? nb(t.pu) : prixCartonCdg(it.nom, t.cond > 0 ? t.cond : it.qteCdt);
  const attenduPu = basePu > 0 ? basePu : (puCdg > 0 ? puCdg : (Number(p.puPiece) > 0 ? Number(p.puPiece) * it.qteCdt : 0));
  if (!proche(it.puCarton, attenduPu)) reelPuKO.push(`${it.nom} : ${it.puCarton} ≠ ${attenduPu} (CDG=${nb(t.pu)}, carton CDG=${prixCartonCdg(it.nom, it.qteCdt)}, référentiel=${basePu})`);
});
check(couverts > 250 && reelCondKO.length === 0,
  `données réelles : les ${couverts} articles couverts par le CDG reviennent avec son colisage`, reelCondKO.slice(0, 4).join(" ; "));
check(reelPuKO.length === 0, "données réelles : prix relu = référentiel, à défaut prix du CDG, à défaut dérivation pièce", reelPuKO.slice(0, 4).join(" ; "));

const reelFantomes = Object.values(itemsReel).filter((it) => it.nbCartons !== 0 || it.valeur !== 0);
check(reelFantomes.length === 0, "données réelles : modèle vierge ⇒ stock importé nul", reelFantomes.slice(0, 3).map((f) => f.nom).join(" ; "));

const horsCdg = Object.values(itemsReel).filter((it) => !cdgParNom.has(cleFiltre(it.nom)));
console.log(
  [
    "",
    "— preuves —",
    `table du CDG = ${INVENTAIRE_REFERENTIEL_CDG.length} lignes, ${TABLE.length} noms distincts`,
    `inner renseigné chez le CDG = ${TABLE.filter((t) => t.inner !== undefined).length} ; colisage sans inner = ${TABLE.filter((t) => t.cond > 1 && t.inner === undefined).length}`,
    `colisage vide (pesés) = ${TABLE.filter((t) => t.cond === undefined).length} ; prix à 0 = ${TABLE.filter((t) => nb(t.pu) === 0).length}`,
    `données réelles : ${artsReels.length} articles de la base, ${attendusReels.length} publiés (liste d'ordre), ${couverts} couverts par le CDG`,
    `articles publiés hors table du CDG = ${horsCdg.length}${horsCdg.length ? " (" + horsCdg.slice(0, 5).map((a) => a.nom).join(" | ") + ")" : ""}`,
    `buffer écrit = ${Math.round(buf.length / 1024)} Ko (jeu CDG), ${Math.round(bufReel.length / 1024)} Ko (données réelles)`,
  ].join("\n")
);

console.log(`\n${ok + ko} vérifications · ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
