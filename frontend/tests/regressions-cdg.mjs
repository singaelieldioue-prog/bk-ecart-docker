// Régressions du retour CDG (séance du 23/10) — vérifie les 4 corrections prouvées sur
// les fichiers réels de sample_data. Exécution : node tests/regressions-cdg.mjs
// Sortie : une ligne PASS/FAIL par point, code de sortie 1 si une régression subsiste.
import * as XLSX from "xlsx";
import fs from "node:fs";

import {
  parseRatios,
  parseBaseArticle,
  parseCorrespondance,
  parseBaseComplementairePmix,
  buildArtListFromReferentiel,
} from "../src/utils/parsers.js";
import { buildModelesWb } from "../src/utils/excelExporter.js";

const readWb = (rel) =>
  XLSX.read(fs.readFileSync(new URL(rel, import.meta.url)), { type: "buffer" });

const sheetOf = (wb, re) => {
  const hit = Object.entries(wb.Sheets).find(([name]) => re.test(name));
  return hit ? hit[1] : null;
};
const grid = (ws) => XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

const ratioWb = readWb("../../sample_data/RATIOS BURGER KING ABJ Q3 2026.xlsx");
const baseWb = readWb("../../sample_data/BASE ARTICLE SIA.xlsx");
const compWb = readWb("../../sample_data/Base complementaire PMIX.xlsx");

const ratios = parseRatios(ratioWb);
const baseArt = parseBaseArticle(baseWb);
const corr = parseCorrespondance(ratioWb);
const built = buildArtListFromReferentiel(baseArt, corr, ratios.waLandedCost, ratios.waByCode, null);
const pmixComplement = parseBaseComplementairePmix(compWb);

const articlesSnake = built.artList.map((a) => ({
  ref: a.ref,
  nom: a.nom,
  code: a.code,
  unite: a.unite,
  categorie: a.categorie,
  conditionnement: a.conditionnement,
  pu_carton: a.puCarton,
  pu_piece: a.puPiece,
  corresp: a.corresp,
  statut: a.statut,
  actif: a.actif,
  ordre_affichage: a.ordre_affichage,
}));

const wb = buildModelesWb(articlesSnake, ratios.allProducts, "BK1", "Octobre 2026", "", [], pmixComplement);
const pmixSheet = sheetOf(wb, /^PMIX$/);
const refRows = grid(sheetOf(wb, /^Référentiel PMIX$/));
const refByPlu = new Map(refRows.slice(1).map((r) => [String(r[0]).trim(), r]));

const near = (a, b, tol = 0.01) => typeof a === "number" && Math.abs(a - b) <= tol;

// Lit une cellule brute d'une feuille source ( preuve « cellule par cellule » du retour CDG ).
const cellOf = (book, sheetName, addr) => {
  const ws = Object.entries(book.Sheets).find((pair) => sheetName.test(pair[0]));
  if (!ws) return "(feuille absente)";
  const cell = Object.entries(ws[1]).find((pair) => pair[0] === addr);
  return cell ? String(cell[1].v) : "(vide)";
};

const evidence = [];
const check = (name, fn) => {
  try {
    fn();
    evidence.push("PASS " + name);
  } catch (e) {
    evidence.push("FAIL " + name + " — " + (e && e.message ? e.message : e));
  }
};

// Preuve de référence : Whopper PLU 110, feuille Ratios, PV TTC en C5 et COÛT en D5.
const ratiosSheet = sheetOf(ratioWb, /^Ratios$/);
const pvC5 = ratiosSheet && ratiosSheet["C5"] ? ratiosSheet["C5"].v : null;
const coutD5 = ratiosSheet && ratiosSheet["D5"] ? ratiosSheet["D5"].v : null;
const whopper = ratios.byPlu[110];

// 1 — Récap PMIX : Amount ne doit pas multiplier une Price textuelle (« #VALUE! »).
check("Amount E3 garde les prix non numériques hors du calcul", () => {
  const f = pmixSheet["E3"].f;
  if (!/ISNUMBER\(D3\)/.test(f)) throw new Error("formule sans garde numérique : =" + f);
});

// 2 — Référentiel PMIX : le prix affiché est le COÛT, pas le PV TTC.
check("Référentiel PMIX : PLU 110 = coût 1 186,67 (et non 5 500)", () => {
  const row = refByPlu.get("110");
  if (!row) throw new Error("PLU 110 absent du référentiel");
  if (row[2] === pvC5) throw new Error("le PV TTC " + pvC5 + " est encore écrit");
  if (!near(row[2], 1186.6721)) throw new Error("valeur " + row[2] + " ≠ 1 186,67");
});

// 3 — Référentiel PMIX : les PLU sans fiche Ratio sont valorisés par la base complémentaire.
check("Référentiel PMIX : coûts du complément injectés (713 / 715 / 400265)", () => {
  const attendus = new Map([
    ["713", 242.4316],
    ["715", 435],
    ["400265", 127.4718],
  ]);
  const ko = [];
  attendus.forEach((beau, plu) => {
    const row = refByPlu.get(plu);
    if (!row) return ko.push(plu + " absent");
    if (!near(row[2], beau, 0.01)) ko.push(plu + " = " + row[2] + " ≠ " + beau);
  });
  if (ko.length) throw new Error(ko.join(" ; "));
});

// 4 — Base articles : conditionnement textuel et prix au kg.
check("SALADE ICEBERG - Boule : cond. 10, carton ≈ 39 130 F, boule ≈ 3 913 F", () => {
  const a = built.artList.find((x) => x.nom === "SALADE ICEBERG - Boule");
  if (!a) throw new Error("article absent de la base");
  if (a.conditionnement !== 10) throw new Error("conditionnement = " + a.conditionnement + " ≠ 10");
  if (!near(a.puCarton, 39129.9576, 0.02)) throw new Error("puCarton = " + a.puCarton + " ≠ 39 129,96");
  if (!near(a.puPiece, 3912.9958, 0.02)) throw new Error("puPiece = " + a.puPiece + " ≠ 3 913");
  if (a.unite !== "Carton") throw new Error("unite = " + a.unite);
});

check("SALADE ICEBERG - Boule ( HOREB) : poids carton inconnu → prix non dérivé", () => {
  const a = built.artList.find((x) => x.nom === "SALADE ICEBERG - Boule ( HOREB)");
  if (!a) throw new Error("article absent de la base");
  if (a.puCarton != null) throw new Error("puCarton dérivé à tort : " + a.puCarton);
});

// 5 — Colisage exprimé en grammes : SIA!H53 « Gramme » + SIA!I53 1000 = carton de 1 kg,
//     et SIA!E53 rattache la trévise à « ICEBERG SALAD (kg) » → prix du carton au kilogramme.
check("SALADE TREVISE - Boule : colisage en grammes lu comme une masse (1 kg)", () => {
  const a = built.artList.find((x) => x.nom === "SALADE TREVISE - Boule");
  if (!a) throw new Error("article absent de la base");
  if (a.conditionnement !== 1000) throw new Error("conditionnement = " + a.conditionnement);
  if (!near(a.puCarton, 6019.9935, 0.01)) throw new Error("puCarton = " + a.puCarton + " ≠ 6 019,99 (SIA!D53 → ICEBERG SALAD au kg)");
  if (!near(a.puPiece, 6.0199935, 0.001)) throw new Error("puPiece = " + a.puPiece + " ≠ 6,02 F le gramme");
});

console.log(
  [
    "— preuves —",
    "Ratios!C5 (PV TTC WHOPPER) = " + pvC5,
    "Ratios!D5 (COÛT WHOPPER) = " + coutD5,
    "parseRatios().byPlu[110].coutTheo = " + (whopper ? whopper.coutTheo : "produit absent"),
    "articles construits = " + built.artList.length + ", avec prix = " + built.nbPrix,
    "lignes du référentiel PMIX = " + (refRows.length - 1),
    "SIA!D51/E51/H51/I51 = " + ["D51", "E51", "H51", "I51"].map((addr) => cellOf(baseWb, /^base article/i, addr)).join(" | "),
    "SIA!D53/E53/H53/I53 = " + ["D53", "E53", "H53", "I53"].map((addr) => cellOf(baseWb, /^base article/i, addr)).join(" | "),
  ].join("\n")
);
console.log(evidence.join("\n"));
process.exit(evidence.some((l) => l.startsWith("FAIL")) ? 1 : 0);
