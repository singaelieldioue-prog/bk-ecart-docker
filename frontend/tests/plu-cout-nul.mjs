// SUITE DURABLE — C-09 / C-13 : un PLU vendu à coût 0 ne peut jamais avoir le statut « OK ».
// Le statut bloquant « COÛT NUL » est calculé dans le rapport et écrit dans le modèle PMIX ;
// la feuille Anomalies liste les PLU, leur quantité, leur part des ventes et le coût moyen
// avec / sans eux. Les PLU à coût nul du référentiel sont distingués de ceux du PMIX.
// Exécution : node tests/plu-cout-nul.mjs
import XLSX from "xlsx-js-style";
import { calculer } from "../src/utils/calculators.js";
import { buildModelesWb, exportExcel } from "../src/utils/excelExporter.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};
const proche = (a, b, tol = 0.01) => Math.abs(Number(a) - Number(b)) <= tol;

const fiche = (plu, nom, coutTheo) => ({ plu, nom, coutTheo, coutParIng: [], categorie: "SANDWICH" });
const ratios = {
  byPlu: {
    110: fiche("110", "WHOPPER", 1000),
    111: fiche("111", "PRODUIT SANS COUT", 0),
    112: fiche("112", "FRITES", 500),
  },
  byNom: {},
};
const pmixList = [{
  restaurant: "BK1",
  items: [
    { plu: "110", nom: "WHOPPER", qty: 10, price: 0, amount: 0 },
    { plu: "110", nom: "WHOPPER", qty: 5, price: 0, amount: 0 },   // doublon de PLU
    { plu: "111", nom: "PRODUIT SANS COUT", qty: 20, price: 0, amount: 0 },
    { plu: "112", nom: "FRITES", qty: 30, price: 0, amount: 0 },
  ],
}];
const stockData = { invIni: {}, invFin: {}, sorties: [], pertes: [], offerts: {} };

const calc = calculer(stockData, pmixList, ratios, {}, {});

// 1. Statut par PLU : « COÛT NUL » pour le PLU à coût 0, « OK » pour les autres.
const statuts = Object.fromEntries(calc.pmixTheo.map((p) => [String(p.plu), p.statut]));
check(statuts["111"] === "COÛT NUL", `PLU 111 à coût 0 → statut « COÛT NUL » (lu « ${statuts["111"]} »)`);
check(statuts["110"] === "OK" && statuts["112"] === "OK",
  `PLU 110 et 112 cotés → statut « OK » (lu « ${statuts["110"]} » / « ${statuts["112"]} »)`);
check(calc.pmixTheo.filter((p) => String(p.plu) === "111").every((p) => p.statut !== "OK"),
  "aucune ligne du PLU à coût 0 n'est marquée « OK »");

// 2. Liste exploitable : quantité vendue et part des ventes.
check((calc.pluCoutNul || []).length === 1, `1 PLU à coût nul listé (lu ${(calc.pluCoutNul || []).length})`);
const z = (calc.pluCoutNul || [])[0] || {};
check(String(z.plu) === "111" && proche(z.qty, 20), `PLU 111, 20 pièces vendues (lu ${z.plu}, ${z.qty})`);
check(proche(z.partVentes, 20 / 65), `part des ventes = 20/65 (lu ${z.partVentes})`);

// 3. Coût moyen par couvert, avec et sans les PLU à coût nul.
check(proche(calc.coutMoyenAvec, 30000 / 65), `coût moyen avec = 461,54 F (lu ${calc.coutMoyenAvec})`);
check(proche(calc.coutMoyenSans, 30000 / 45), `coût moyen sans = 666,67 F (lu ${calc.coutMoyenSans})`);

// 4. Doublons de PLU signalés.
check((calc.pmixDoublons || []).some((d) => String(d.plu) === "110"),
  "PLU 110 vendu sur 2 lignes → doublon signalé", JSON.stringify(calc.pmixDoublons));

// 5. Référentiel : les PLU à coût nul sont comptés à part du PMIX.
check(calc.ratioCoutNulCount === 1, `1 PLU à coût nul dans le référentiel (lu ${calc.ratioCoutNulCount})`);
check(calc.ratioCoutNulVendus === 1, `dont 1 vendu (lu ${calc.ratioCoutNulVendus})`);

// 6. Modèle généré : la formule de statut porte la branche « COÛT NUL ».
const wb = buildModelesWb([], [
  { plu: 110, nom: "WHOPPER", coutTheo: 1000, pvTtc: 5500 },
  { plu: 111, nom: "PRODUIT SANS COUT", coutTheo: 0, pvTtc: 5500 },
  { plu: 112, nom: "FRITES", coutTheo: 500, pvTtc: 2000 },
], "BK1", "Octobre 2026", "", ["BK1"], [], []);
const ws = wb.Sheets["PMIX"];
const f3 = String(ws?.["F3"]?.f || "");
check(f3.includes("COÛT NUL"), `F3 contient la branche « COÛT NUL » (lu « ${f3} »)`);
const ref = wb.Sheets["Référentiel PMIX"];
const refRows = XLSX.utils.sheet_to_json(ref, { header: 1, defval: null }).slice(1);
const refParPlu = new Map(refRows.map((r) => [String(r[0]), r]));
check(String(ref?.["D1"]?.v || "").includes("Coût fiche"),
  `référentiel PMIX : en-tête D1 = coût de la fiche (lu « ${ref?.["D1"]?.v} »)`);
const refLastLue = Number((f3.match(/\$A\$2:\$D\$(\d+)/) || [])[1] || 0);
check(refLastLue === refRows.length + 1,
  `la plage des VLOOKUP couvre toutes les lignes du référentiel (lue ${refLastLue}, attendue ${refRows.length + 1})`);
check(Number(refParPlu.get("110")?.[3]) === 1000 && Number(refParPlu.get("111")?.[3]) === 0,
  "référentiel PMIX : colonne D = coût de la fiche (0 conservé, sans repli PV TTC)",
  `110 → ${refParPlu.get("110")?.[3]} ; 111 → ${refParPlu.get("111")?.[3]}`);

// 7. Feuille Anomalies : ligne « Coût nul » + synthèse du coût moyen.
let blob = null;
globalThis.document = { createElement: () => ({ click() {} }) };
URL.createObjectURL = (b) => { blob = b; return "blob:test"; };
URL.revokeObjectURL = () => {};
await exportExcel({
  titre: "Test coût nul", status: "draft", history: [],
  data: { calc, stockData: { pertes: [], douane: [], douaneTotal: 0, offerts: {} }, ratiosMeta: { label: "test" } },
});
const out = XLSX.read(Buffer.from(await blob.arrayBuffer()), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(out.Sheets["Anomalies"], { header: 1, defval: null });
const ligne = rows.find((r) => String(r[0] || "").toUpperCase().includes("COÛT NUL"));
check(!!ligne, "feuille Anomalies : ligne « Coût nul »");
check(ligne && String(ligne[1]) === "111" && Number(ligne[3]) === 20,
  `ligne : PLU 111, quantité 20 (lu ${ligne?.[1]}, ${ligne?.[3]})`);
check(ligne && /30,8\s*%/.test(String(ligne[4])),
  `ligne : part des ventes 30,8 % (lu « ${ligne?.[4]} »)`);
const avec = rows.find((r) => String(r[0] || "").includes("avec les PLU à coût nul"));
const sans = rows.find((r) => String(r[0] || "").includes("sans les PLU à coût nul"));
check(avec && proche(avec[2], 30000 / 65), `synthèse : coût moyen avec 461,54 F (lu ${avec?.[2]})`);
check(sans && proche(sans[2], 30000 / 45), `synthèse : coût moyen sans 666,67 F (lu ${sans?.[2]})`);

console.log(`\n${ok} PASS / ${ko} FAIL`);
process.exit(ko ? 1 : 0);
