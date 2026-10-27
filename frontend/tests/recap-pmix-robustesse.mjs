// Récap PMIX insensible aux saisies en erreur — capture CDG du 25/10 (« RECAP PMIX
// INCONHERENT ») : TOTAL CA (FCFA) et CA moyen / couvert affichent #VALUE!.
// Mécanisme : la garde du 23/10 ne teste ISNUMBER que sur le PRIX (D), jamais sur la
// QUANTITÉ saisie (C). Une quantité stockée en texte rend C*D = #VALUE!, que le SUM du
// récap propage. Exécution : node tests/recap-pmix-robustesse.mjs
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

const readWb = (rel) => XLSX.read(fs.readFileSync(new URL(rel, import.meta.url)), { type: "buffer" });

const ratios = parseRatios(readWb("../../sample_data/RATIOS BURGER KING ABJ Q3 2026.xlsx"));
const baseArt = parseBaseArticle(readWb("../../sample_data/BASE ARTICLE SIA.xlsx"));
const corr = parseCorrespondance(readWb("../../sample_data/RATIOS BURGER KING ABJ Q3 2026.xlsx"));
const built = buildArtListFromReferentiel(baseArt, corr, ratios.waLandedCost, ratios.waByCode, null);
const pmixComplement = parseBaseComplementairePmix(readWb("../../sample_data/Base complementaire PMIX.xlsx"));

const articles = built.artList.map((a) => ({
  ref: a.ref, nom: a.nom, code: a.code, unite: a.unite, categorie: a.categorie,
  conditionnement: a.conditionnement, puCarton: a.puCarton, puPiece: a.puPiece,
  corresponRatio: a.corresponRatio, statut: a.statut, actif: true,
}));
const wb = buildModelesWb(articles, ratios.allProducts, "BK1", "Octobre 2026", "", [], pmixComplement);
const ws = wb.Sheets["PMIX"];
if (!ws) { console.log("FAIL - feuille PMIX absente"); process.exit(1); }

const f = (addr) => (ws[addr] && ws[addr].f) || "";
const cell = (addr) => (ws[addr] && ws[addr].v) || "";

let failed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${ok ? "" : "\n         trouvé : " + detail}`);
  if (!ok) failed++;
};

const amount = f("E3");
check(
  "Montant = Qty x Prix exige un nombre sur les DEUX opérandes (C et D)",
  /ISNUMBER\(\$?C3\$?\)?/.test(amount.replace(/\s/g, "")) && /ISNUMBER\(D3\)/.test(amount),
  amount
);

const coutMoyen = f("I7");
check(
  "Coût moyen / article vendu ne peut plus diviser par une cellule non numérique",
  /IFERROR|ISNUMBER\(\$I\$5\)/.test(coutMoyen),
  coutMoyen
);

const recapLabels = [];
for (let r = 1; r <= 12; r++) if (cell("H" + r)) recapLabels.push(cell("H" + r));
check(
  "Le récap signale les lignes de saisie non chiffrables au lieu de les perdre en silence",
  recapLabels.some((l) => /non chiffrable|non num/i.test(l)),
  recapLabels.join(" | ")
);
const compteurs = ["I3", "I4", "I5", "I6", "I7", "I8"].map((a) => ({ a, f: f(a) })).filter((x) => /ISNUMBER\(\$C\$3/.test(x.f));
check(
  "Un compteur d'indicateur compte les quantités texte sur toute la zone de saisie",
  compteurs.length > 0,
  ["I3","I4","I5","I6","I7","I8"].map((a) => a + "=" + f(a)).join(" | ")
);

check(
  "TOTAL COUVERTS et TOTAL COÛT MATIÈRE restent des SUM sur les bonnes plages",
  /^SUM\(\$C\$3:\$C\$\d+\)$/.test(f("I5")) && /^SUM\(\$E\$3:\$E\$\d+\)$/.test(f("I6")),
  "I5=" + f("I5") + " | I6=" + f("I6")
);

console.log(failed ? `\n${failed} point(s) en échec` : "\ntous les points passent");
process.exit(failed ? 1 : 0);
