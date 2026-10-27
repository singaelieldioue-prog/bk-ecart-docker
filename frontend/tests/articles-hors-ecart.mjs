// SUITE DURABLE — A-02 / C-11 : articles non-matière hors du calcul d'écart.
// Les catégories PMC, IFB et PACKAGING (y compris la variante de casse « Packaging ») sont
// exclues du calcul d'écart par un PARAMÈTRE DE CONFIGURATION validé (CATEGORIES_HORS_ECART),
// jamais par une liste en dur dans le code de calcul. Leur trace reste visible, mais elles ne
// comptent plus dans les « articles sans prix » (double comptage des PMC à 0 F).
// Exécution : node tests/articles-hors-ecart.mjs
import XLSX from "xlsx-js-style";
import { exportExcel } from "../src/utils/excelExporter.js";
import { parseSuivisStock } from "../src/utils/parsers.js";
import { calculer } from "../src/utils/calculators.js";
import { norm } from "../src/utils/formatters.js";
import { CATEGORIES_HORS_ECART, estCategorieHorsEcart } from "../src/constants.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};

const RATIOS_VIDES = { waLandedCost: {}, waByCode: {}, pmpByIng: {}, byPlu: {}, byNom: {} };

// ── Paramètre de configuration ────────────────────────────────────────────────
const liste = (CATEGORIES_HORS_ECART || []).map((c) => String(c).trim().toUpperCase());
check(["PMC", "IFB", "PACKAGING"].every((c) => liste.includes(c)),
  `CATEGORIES_HORS_ECART contient PMC, IFB, PACKAGING (lu ${JSON.stringify(CATEGORIES_HORS_ECART)})`);
check(estCategorieHorsEcart("PMC") === true && estCategorieHorsEcart("ifb") === true,
  "PMC et ifb (casse libre) reconnus comme hors écart");
check(estCategorieHorsEcart("Packaging") === true && estCategorieHorsEcart(" PACKAGING ") === true,
  "Packaging et PACKAGING (doublon de casse et espaces) reconnus comme hors écart");
check(estCategorieHorsEcart("Nourriture - Sec") === false && estCategorieHorsEcart("") === false,
  "une catégorie matière (Nourriture - Sec) et une catégorie vide restent dans l'écart");

// ── Classeur au format courant (tableau en A, offset 1) ───────────────────────
const ARTICLES = [
  { cat: "Nourriture - Surgelé", nom: "WHOPPER PATTY", cond: 1, nb: 100, prix: 1000, code: "P001" },
  { cat: "Nourriture - Sec", nom: "PAIN BURGER", cond: 1, nb: 20, prix: 500, code: "P002" },
  { cat: "PMC", nom: "GANT NITRILE", cond: 1, nb: 10, prix: 0, code: "PMC01" },
  { cat: "PMC", nom: "SAVON LIQUIDE", cond: 1, nb: 4, prix: null, code: "PMC02" },
  { cat: "Packaging", nom: "BOITE ENFANT", cond: 1, nb: 2, prix: 5000, code: "PK01" },
  { cat: "PACKAGING", nom: "GOBELET 25 CL", cond: 1, nb: 3, prix: 4000, code: "PK02" },
  { cat: "IFB", nom: "SACHET IFB", cond: 1, nb: 5, prix: 0, code: "IFB01" },
];

const feuille = (titre) => {
  const rows = [];
  rows[0] = [titre];
  rows[1] = ["", ""];
  rows[2] = ["", "", "", "BK1"];
  rows[3] = ["Saisir uniquement les colonnes vertes"];
  rows[4] = ["CATEGORIE", "Frns", "ARTICLE", "COLISAGE"];
  rows[5] = ["", "", "", "Nb articles / carton"];
  ARTICLES.forEach(({ cat, nom, cond, nb, prix, code }) => {
    const r = [];
    r[0] = cat; r[2] = nom; r[3] = cond; r[8] = nb; r[10] = prix; r[13] = code;
    rows.push(r);
  });
  return rows;
};

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(feuille("INVENTAIRE INITIAL")), "Inventaire Initial");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(feuille("INVENTAIRE FINAL")), "Inventaire Final");
const back = XLSX.read(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }), { type: "buffer" });
const parsed = parseSuivisStock(back, {}, RATIOS_VIDES, {});
const calc = calculer(parsed, [], RATIOS_VIDES, {}, {});

const nomsEcart = (c) => (c.articlesEcart || []).map((a) => norm(a.nom));
const nomsHors = (c) => (c.articlesHorsEcart || []).map((a) => norm(a.nom));

// 1. Le calcul d'écart exclut les trois catégories, y compris la variante « Packaging ».
check(!nomsEcart(calc).includes(norm("GANT NITRILE")) && !nomsEcart(calc).includes(norm("SAVON LIQUIDE")),
  "les PMC n'entrent pas dans l'écart par article", nomsEcart(calc).join(" | "));
check(!nomsEcart(calc).includes(norm("BOITE ENFANT")) && !nomsEcart(calc).includes(norm("GOBELET 25 CL")),
  "les deux casses PACKAGING/Packaging sont exclues", nomsEcart(calc).join(" | "));
check(!nomsEcart(calc).includes(norm("SACHET IFB")), "les IFB n'entrent pas dans l'écart par article");
check(nomsEcart(calc).includes(norm("WHOPPER PATTY")) && nomsEcart(calc).includes(norm("PAIN BURGER")),
  "les articles matière restent dans l'écart", nomsEcart(calc).join(" | "));

// 2. Leur trace est conservée pour le CDG.
check(nomsHors(calc).length === 5,
  `5 articles hors écart tracés (lu ${nomsHors(calc).length})`, (calc.articlesHorsEcart || []).map((a) => a.nom).join(" | "));
const hors = (c, nom) => (c.articlesHorsEcart || []).find((a) => norm(a.nom) === norm(nom));
check(hors(calc, "GANT NITRILE")?.categorie === "PMC" && hors(calc, "GANT NITRILE")?.iniPieces === 10,
  "trace PMC : catégorie et quantité initiale conservées", JSON.stringify(hors(calc, "GANT NITRILE")));
check(hors(calc, "BOITE ENFANT")?.iniPieces === 2 && hors(calc, "BOITE ENFANT")?.finPieces === 2,
  "trace Packaging : initial et final conservés", JSON.stringify(hors(calc, "BOITE ENFANT")));

// 3. Les PMC à 0 F ne gonflent plus les « articles sans prix ».
const sansPrix = (calc.articlesEcart || []).filter((a) => !a.puPiece || a.puPiece === 0);
check(sansPrix.length === 0,
  `aucun « article sans prix » issu des PMC/IFB/PACKAGING (lu ${sansPrix.length})`,
  sansPrix.map((a) => a.nom).join(" | "));

// 4. La valeur du stock reste complète : seule l'analyse d'écart est filtrée.
check(Math.abs(calc.totalValIni - 132000) < 0.01,
  `stock initial inchangé (100 000 + 10 000 + 10 000 + 12 000 = 132 000 F, lu ${calc.totalValIni})`);

// 5. La liste est bien lue à l'exécution depuis la configuration, pas figée dans le calcul.
CATEGORIES_HORS_ECART.push("Nourriture - Sec");
const calc2 = calculer(parsed, [], RATIOS_VIDES, {}, {});
check(!nomsEcart(calc2).includes(norm("PAIN BURGER")) && nomsHors(calc2).includes(norm("PAIN BURGER")),
  "une catégorie ajoutée à la configuration est exclue au calcul suivant (paramètre vivant, pas liste en dur)");
CATEGORIES_HORS_ECART.pop();

// 6. Feuille Anomalies : ligne dédiée, plus aucune ligne « Article PU = 0 » pour ces articles.
let blob = null;
globalThis.document = { createElement: () => ({ click() {} }) };
URL.createObjectURL = (b) => { blob = b; return "blob:test"; };
URL.revokeObjectURL = () => {};
await exportExcel({
  titre: "Test hors écart", status: "draft", history: [],
  data: { calc, stockData: { pertes: [], douane: [], douaneTotal: 0, offerts: {} }, ratiosMeta: { label: "test" } },
});
const out = XLSX.read(Buffer.from(await blob.arrayBuffer()), { type: "buffer" });
const rowsAn = XLSX.utils.sheet_to_json(out.Sheets["Anomalies"], { header: 1, defval: null });
const types = rowsAn.map((r) => String(r[0] || "").toUpperCase());
check(types.some((t) => t.includes("HORS ÉCART") || t.includes("HORS ECART")),
  "feuille Anomalies : ligne « Hors écart (catégorie) »");
check(!rowsAn.some((r) => String(r[0] || "") === "Article PU = 0"),
  "feuille Anomalies : plus de ligne « Article PU = 0 » pour les PMC/IFB/PACKAGING",
  rowsAn.filter((r) => String(r[0] || "") === "Article PU = 0").map((r) => r[2]).join(" | "));
const ligneGant = rowsAn.find((r) => String(r[2] || "").includes("GANT NITRILE"));
check(!!ligneGant && Number(ligneGant[3]) === 20,
  `la ligne hors écart porte la quantité (10 initial + 10 final = 20, lu ${ligneGant?.[3]})`);

console.log(`\n${ok} PASS / ${ko} FAIL`);
process.exit(ko ? 1 : 0);
