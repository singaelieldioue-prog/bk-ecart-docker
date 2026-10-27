// SUITE DURABLE — Feuille Offert : table de saisie vivante + colonne Total + ligne TOTAL,
// comme la feuille Offert du classeur de référence du CDG (dimension B1:I13 : en-têtes ligne 2,
// une ligne par BK dès la ligne 3, TOTAL en dernière ligne).
// Exécution : node tests/offert-total.mjs
import XLSX from "xlsx-js-style";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { parseSuivisStock } from "../src/utils/parsers.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};

const RATIOS_VIDES = { waLandedCost: {}, waByCode: {}, pmpByIng: {}, byPlu: {}, byNom: {} };
const HEAD = ["BK", "Staff Meal", "Manager Meal", "GT", "Offer", "HO", "Discount CJ", "Total"];

const wb = buildModelesWb([], [], "BK1", "Octobre 2026", "", ["BK1"], [], []);
const ws = wb.Sheets["Offert"];

// 1. Géométrie : titre ligne 1, en-têtes ligne 2, saisie ligne 3, TOTAL ligne 4.
check(ws && ws["!ref"] === "A1:H4", `dimension A1:H4 (lue ${ws?.["!ref"]})`);

// 2. Le titre porte le site et la période (PRD l.106/l.108), comme les autres feuilles.
const titre = String(ws?.["B1"]?.v ?? "");
check(titre.includes("BK1") && titre.includes("Octobre 2026"),
  `titre avec site et période (« ${titre} »)`);

// 3. En-têtes identiques à la référence (ligne 2).
const head = HEAD.map((_, i) => String(ws?.[XLSX.utils.encode_cell({ r: 1, c: i })]?.v ?? ""));
check(head.every((h, i) => h === HEAD[i]), "en-têtes ligne 2 : BK · Staff Meal · Manager Meal · GT · Offer · HO · Discount CJ · Total",
  head.join(" | "));

// 4. Ligne de saisie : le BK est un libellé (pas une date), les 6 montants sont des cellules
//    numériques publiées, le Total est calculé.
check(ws?.["A3"]?.v === "BK1" && ws?.["A3"]?.t === "s", `A3 = « BK1 » en texte (t=${ws?.["A3"]?.t})`);
const montants = ["B3", "C3", "D3", "E3", "F3", "G3"];
const muets = montants.filter((a) => !ws?.[a] || ws[a].t !== "n" || ws[a].v !== 0);
check(muets.length === 0, "B3..G3 présentes et numériques à 0 (la table n'est plus vide)", muets.join(", "));
check(String(ws?.H3?.f ?? "").toUpperCase() === "SUM(B3:G3)", `H3 = SUM(B3:G3) (lue « ${ws?.H3?.f ?? ""} »)`);

// 5. Ligne TOTAL : libellé + une somme par colonne, comme les autres feuilles.
check(ws?.["A4"]?.v === "TOTAL", `A4 = « TOTAL » (lu « ${ws?.["A4"]?.v ?? ""} »)`);
const tot = ["B4", "C4", "D4", "E4", "F4", "G4", "H4"];
const mauvais = tot.filter((a, i) => String(ws?.[a]?.f ?? "").toUpperCase() !== `SUM(${tot[i][0]}3:${tot[i][0]}3)`);
check(mauvais.length === 0, "B4..H4 = SUM(colonne 3) sur chaque colonne", mauvais.map((a) => `${a}:${ws?.[a]?.f ?? "absent"}`).join(", "));

// 6. Round-trip : après saisie (valeurs + Total calculé par Excel), le parseur relit le BK
//    et son total, et n'avale pas la ligne TOTAL comme un BK.
const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
const back = XLSX.read(buf, { type: "buffer" });
{
  const o = back.Sheets["Offert"];
  ["B3", "C3", "D3", "E3", "F3", "G3"].forEach((a, i) => {
    o[a] = { t: "n", v: [100, 50, 10, 5, 2, 3][i] };
  });
  o.H3 = { t: "n", v: 170, f: "SUM(B3:G3)" };
}
const parsed = parseSuivisStock(back, {}, RATIOS_VIDES, {});
const bk = parsed.offerts?.BK1;
check(bk && bk.staffM === 100 && bk.discountCJ === 3 && bk.total === 170,
  `réimport : BK1 relu (staff ${bk?.staffM}, discount ${bk?.discountCJ}, total ${bk?.total})`);
check(!parsed.offerts?.TOTAL, "réimport : la ligne TOTAL n'est pas lue comme un BK",
  Object.keys(parsed.offerts || {}).join(", "));

// 7. Un autre site : le titre et la ligne de saisie suivent le site généré.
const wb3 = buildModelesWb([], [], "BK3", "Octobre 2026", "", ["BK3"], [], []);
check(String(wb3.Sheets["Offert"]?.["B1"]?.v ?? "").includes("BK3") && wb3.Sheets["Offert"]?.["A3"]?.v === "BK3",
  "site BK3 : titre et colonne BK suivent le site");

console.log(`\n${ok} PASS / ${ko} FAIL`);
process.exit(ko ? 1 : 0);
