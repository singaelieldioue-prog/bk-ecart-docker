// SUITE DURABLE — les feuilles Inventaire publient le référentiel « Inventaire initial » du CDG
// (exact/suivis stock BK 1.xlsx, table src/utils/inventaireReferentielCdg.js) : COLISAGE,
// « Nb articles / inner », unité affichée et prix de valorisation, ligne à ligne.
// Demande du 26/10/2026 : « je produis tout pareil pour notre fichier suivi de stock,
// conditionnement pareil et tout regarde ».
// Cette suite remplace les attentes du 25/10 (E-DERIVE) pour les lignes cotées par le CDG : la
// dérivation inner depuis le colisage ne sert plus qu'aux articles absents de sa table.
// Exécution : node tests/inventaire-referentiel-cdg.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import JSZip from "jszip";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { INVENTAIRE_REFERENTIEL_CDG } from "../src/utils/inventaireReferentielCdg.js";
import { PERTES_REFERENTIEL_CDG } from "../src/utils/pertesReferentielCdg.js";

let ok = 0, ko = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log("PASS - " + msg); } else { ko++; console.log("FAIL - " + msg); } };
const norm = (s) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

// modèle d'inventaire volontairement faux (colisages et prix inventés) : le CDG doit primer
const COLISAGES_FAUX = { "bouteillecocacola50cl": 999, eau: 77, frites: 3, milo: 8 };
// FANTA 1.5L reste sans prix de base : c'est le prix carton du CDG qui le cote (voir plus bas).
const PRIX_FAUX = { "bouteillecocacola50cl": 111111, eau: 222222, frites: 333333, "chilicheesebites": 444444, "bouteillefanta15l": 0, "tomatesbeneva": 0 };
// Un prix CDG renseigné fait foi ; son 0 est un trou et laisse la main au PRIX CARTON du CDG (même
// désignation dans sa table des pertes), puis au prix de base connu (demande du 26/10 « utiliser
// les codes pour faire correspondre les prix absents », puis « le prix du carton doit primer »).
const PERTES_CARTON = new Map();
PERTES_REFERENTIEL_CDG.forEach((t) => { const k = norm(t.nom); if (Number(t.pu) > 0 && !PERTES_CARTON.has(k)) PERTES_CARTON.set(k, t); });
const prixCartonCdg = (nom, cond) => {
  const t = PERTES_CARTON.get(norm(nom));
  if (!t) return 0;
  return (Number(t.pu) / (Number(t.cond) > 0 ? Number(t.cond) : 1)) * (Number(cond) > 0 ? Number(cond) : 1);
};
const prixAttendu = (t) => {
  if (t.pu === undefined) return "";
  if (Number(t.pu) > 0) return t.pu;
  const carton = prixCartonCdg(t.nom, t.cond);
  if (carton > 0) return carton;
  const base = PRIX_FAUX[norm(t.nom)] ?? 123456;
  return base > 0 ? base : 0;
};
// Un même nom peut apparaître deux fois chez le CDG (SANITIZER TABLETTE : L309 et L316) : la
// première occurrence fait foi, comme dans la feuille générée.
const TABLE = [];
const VUS = new Set();
INVENTAIRE_REFERENTIEL_CDG.forEach((t) => { const k = norm(t.nom); if (VUS.has(k)) return; VUS.add(k); TABLE.push(t); });
const articles = TABLE.map((t, i) => ({
  nom: t.nom, code: "CODE" + i, categorie: t.cat, fournisseur: t.frns,
  conditionnement: COLISAGES_FAUX[norm(t.nom)] ?? 1,
  qteInner: 0, unite: "Unité", pu_carton: PRIX_FAUX[norm(t.nom)] ?? 123456, pu_piece: 0,
}));
const wb = buildModelesWb(articles, [], "BK1", "Octobre 2026", "", ["BK1"], [], []);
const ws = wb.Sheets["Inventaire Initial"];
const byName = new Map(TABLE.map((t) => [norm(t.nom), t]));
const parNomFeuille = new Map();
let lignes = 0;
for (let R = 7; ws["C" + R]?.v; R++) {
  const t = byName.get(norm(ws["C" + R].v));
  if (!t) continue;
  lignes++;
  parNomFeuille.set(norm(t.nom), { R, cond: ws["D" + R], inner: ws["E" + R], unite: ws["J" + R], pu: ws["K" + R] });
}
check(lignes === TABLE.length, `les ${TABLE.length} articles du référentiel figurent dans la feuille`);

const cel = (x) => (x === undefined ? "" : x.v === undefined ? "" : x.v);
let condKO = [], innerKO = [], uniteKO = [], puKO = [];
TABLE.forEach((t) => {
  const g = parNomFeuille.get(norm(t.nom)); if (!g) return;
  const enFeuille = g.cond;
  const attendu = t.cond === undefined ? "" : t.cond;
  if (cel(enFeuille) !== attendu) condKO.push(`${t.nom} : attendu ${attendu || "(vide)"}, lu ${JSON.stringify(cel(enFeuille))}`);
  if (cel(g.inner) !== (t.inner === undefined ? "" : t.inner)) innerKO.push(`${t.nom} : attendu ${t.inner ?? "(vide)"}, lu ${JSON.stringify(cel(g.inner))}`);
  if (cel(g.unite) !== (t.unite ?? "")) uniteKO.push(`${t.nom} : attendu ${JSON.stringify(t.unite)}, lu ${JSON.stringify(cel(g.unite))}`);
  if (cel(g.pu) !== prixAttendu(t)) puKO.push(`${t.nom} : attendu ${prixAttendu(t) ?? "(vide)"}, lu ${JSON.stringify(cel(g.pu))}`);
});
check(condKO.length === 0, `COLISAGE = colonne E du CDG sur les ${lignes} lignes (écarts : ${condKO.slice(0, 4).join(" ; ")})`);
check(innerKO.length === 0, `« Nb articles / inner » = colonne F du CDG, vide quand le CDG ne le renseigne pas (écarts : ${innerKO.slice(0, 4).join(" ; ")})`);
check(uniteKO.length === 0, `unité affichée = colonne K du CDG (« Pack de 6 », « Kg », « Bidon 10 L »…) (écarts : ${uniteKO.slice(0, 4).join(" ; ")})`);
check(puKO.length === 0, `prix de valorisation = colonne L du CDG, décimales comprises (écarts : ${puKO.slice(0, 4).join(" ; ")})`);

// valeurs de contrôle, lues à la main dans le classeur du CDG
[["BOUTEILLE COCA COLA 50cL", 6, 1449.1525423728815, "Pack de 6"],
 ["EAU", 9, 724.57627118644075, "Pack de 9"],
 ["FRITES", 5, 17834.364927904764, "Carton"],
 ["MILO", 300, 105.93, "Sachet individuel"],
 ["CHILI CHEESE BITES", 300, 21864.231271111777, "Carton"]].forEach(([nom]) => {
  const t = byName.get(norm(nom));
  if (!t) return;
  const g = parNomFeuille.get(norm(t.nom));
  check(g && cel(g.cond) === (t.cond ?? "") && cel(g.pu) === (t.pu ?? "") && cel(g.unite) === (t.unite ?? ""),
    `${nom} : colisage ${t.cond ?? "(vide)"}, prix ${t.pu ?? "(vide)"}, unité ${JSON.stringify(t.unite ?? "(vide)")} du CDG (le modèle transmis mentait)`);
});
const peses = TABLE.filter((t) => t.cond === undefined);
check(peses.length > 0 && peses.every((t) => cel(parNomFeuille.get(norm(t.nom))?.cond) === ""),
  `les ${peses.length} lignes sans colisage chez le CDG (produits pesés) restent vides, aucune valeur inventée`);

const zero = TABLE.filter((t) => Number(t.pu) === 0);
const zeroSansSource = zero.filter((t) => prixAttendu(t) === 0);
const zeroAvecSource = zero.filter((t) => prixAttendu(t) > 0);
check(zeroAvecSource.every((t) => cel(parNomFeuille.get(norm(t.nom))?.pu) === prixAttendu(t)),
  `les ${zeroAvecSource.length} lignes à 0 chez le CDG prennent le prix carton du CDG ou le prix de base connu (${zeroAvecSource.map((t) => t.nom).join(", ")})`);
check(zeroSansSource.every((t) => cel(parNomFeuille.get(norm(t.nom))?.pu) === 0),
  `les ${zeroSansSource.length} lignes sans aucune source restent à 0 (${zeroSansSource.map((t) => t.nom).join(", ") || "aucune"})`);
check(Math.abs(cel(parNomFeuille.get(norm("BOUTEILLE COCA COLA 1.5L"))?.pu) - 3686) < 0.01,
  `BOUTEILLE COCA COLA 1.5L : prix CARTON du CDG 3 686 F le pack de 6, pas le prix pièce de la base (lu ${JSON.stringify(cel(parNomFeuille.get(norm("BOUTEILLE COCA COLA 1.5L"))?.pu))})`);

// la feuille Inventaire Final reprend le même référentiel
const wf = wb.Sheets["Inventaire Final"];
let finalKO = 0;
TABLE.forEach((t) => {
  for (let R = 7; wf["C" + R]?.v; R++) {
    if (norm(wf["C" + R].v) !== norm(t.nom)) continue;
    if (cel(wf["D" + R]) !== (t.cond ?? "") || cel(wf["K" + R]) !== prixAttendu(t)) finalKO++;
    break;
  }
});
check(finalKO === 0, "Inventaire Final publie le même référentiel que Inventaire Initial");

// géométrie inchangée : formules Nombre / Valeur / Report Omega, TOTAL, récap
const premiere = TABLE[0], lastR = 6 + lignes;
const g0 = parNomFeuille.get(norm(premiere.nom));
check(ws["I" + g0.R]?.f === `F${g0.R}+IF(D${g0.R}>0,G${g0.R}*E${g0.R}/D${g0.R},0)+IF(D${g0.R}>0,H${g0.R}/D${g0.R},0)`, `Nombre en I${g0.R} = cartons + inner×taille÷colisage + unités÷colisage`);
check(ws["L" + g0.R]?.f === `I${g0.R}*K${g0.R}`, `Valeur stock en L${g0.R} = Nombre × prix`);
check(ws["O" + g0.R]?.f === `F${g0.R}*D${g0.R}+G${g0.R}*E${g0.R}+H${g0.R}`, `Report Omega en O${g0.R} = quantité d'unités d'inventaire`);
check(ws["L" + (lastR + 1)]?.f === `SUM(L7:L${lastR})`, `TOTAL STOCK en L${lastR + 1} somme les ${lignes} lignes`);
check(ws["C" + (lastR + 3)]?.v === "Boissons" && /^SUMIF\(\$A\$7:\$A\$/, String(ws["D" + (lastR + 3)]?.f ?? ""), "le récapitulatif par catégorie suit le TOTAL");

// écrit sur disque : les valeurs du CDG survivent au XML
const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
const zx = await JSZip.loadAsync(buf);
const xml = await zx.file("xl/worksheets/sheet1.xml").async("string");
["BOUTEILLE COCA COLA 50cL", "EAU", "FRITES"].forEach((nom) => {
  const t = byName.get(norm(nom)); const g = parNomFeuille.get(norm(nom));
  const val = (x) => String(x).replace(/\./g, "\\.");
  const dOK = new RegExp(`<c r="D${g.R}"[^>]*>\\s*<v>${val(t.cond)}</v>`).test(xml);
  const kOK = new RegExp(`<c r="K${g.R}"[^>]*>\\s*<v>${val(t.pu)}</v>`).test(xml);
  check(dOK && kOK, `XML : D${g.R}=${t.cond} et K${g.R}=${t.pu} écrits pour ${nom}`);
});
const pes = parNomFeuille.get(norm("OIGNONS NON EPLUCHES"));
check(pes && !new RegExp(`<c r="D${pes.R}"[^>]*>\\s*<v>`).test(xml), `XML : D${pes?.R} reste vide (oignons, sans colisage chez le CDG)`);

console.log(`\n${ok + ko} vérifications · ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
