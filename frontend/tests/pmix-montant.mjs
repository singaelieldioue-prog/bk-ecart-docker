// SUITE DURABLE — PMIX : le montant (colonne E « Amount ») doit survivre à la relecture
// d'un classeur généré par l'application, malgré le récapitulatif H/I qui contient « INDICATEUR ».
// Exécution : node tests/pmix-montant.mjs
import XLSX from "xlsx-js-style";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { extractPmixFromWorkbook } from "../src/utils/parsers.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};

const PRODUITS = [
  { plu: 110, nom: "WHOPPER", coutTheo: 1186.67, pvTtc: 5500 },
  { plu: 111, nom: "WHOPPER CHEESE", coutTheo: 1300, pvTtc: 6000 },
  { plu: 705, nom: "FRITES", coutTheo: 500, pvTtc: 2000 },
  { plu: 720, nom: "COCA", coutTheo: 300, pvTtc: 1500 },
  { plu: 730, nom: "SUNDAE", coutTheo: 400, pvTtc: 1800 },
];

const wb = buildModelesWb([], PRODUITS, "BK1", "Octobre 2026", "", ["BK1"], [], []);
const ws = wb.Sheets["PMIX"];
check(!!ws, "feuille PMIX générée");
check(String(ws?.["H2"]?.v ?? "") === "INDICATEUR", `récap H2 = « INDICATEUR » (lu « ${ws?.["H2"]?.v ?? ""} »)`);
check(String(ws?.["A2"]?.v ?? "") === "Item PLU" && String(ws?.["E2"]?.v ?? "") === "Amount",
  `en-têtes ligne 2 : Item PLU / Amount (A2 « ${ws?.["A2"]?.v ?? ""} », E2 « ${ws?.["E2"]?.v ?? ""} »)`);

// Saisie telle qu'Excel la sauvegarde : quantités et montants recalculés (valeurs en cache).
const MONTANT = 115049.41;
for (let i = 0; i < PRODUITS.length; i++) {
  const r = 3 + i;
  const p = PRODUITS[i];
  ws[`A${r}`] = { t: "n", v: p.plu };
  ws[`B${r}`] = { t: "s", v: p.nom };
  ws[`C${r}`] = { t: "n", v: 100, f: `C${r}` };
  ws[`D${r}`] = { t: "n", v: +(MONTANT / 100).toFixed(4), f: `D${r}` };
  ws[`E${r}`] = { t: "n", v: MONTANT, f: `C${r}*D${r}` };
}

// Round-trip disque : c'est le fichier réellement importé par l'application.
const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
const back = XLSX.read(buf, { type: "buffer" });

const items = extractPmixFromWorkbook(back, "BK1");
check(items.length === 5, `5 lignes PMIX relues (lu ${items.length})`, JSON.stringify(items));

const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
const totalAttendu = +(MONTANT * PRODUITS.length).toFixed(2);
check(Math.abs(total - totalAttendu) < 0.005,
  `total des montants = ${totalAttendu.toFixed(2)} F (lu ${total.toFixed(2)} F)`);
check(items.every((it) => (Number(it.amount) || 0) > 0),
  "chaque ligne relue porte un montant > 0", items.map((it) => it.amount).join(", "));

// Le récapitulatif (H/I) ne doit ni créer de ligne PLU ni prendre la place du montant.
check(items.every((it) => String(it.nom) !== "INDICATEUR" && String(it.nom) !== "VALEUR"),
  "aucune ligne de récapitulatif n'est lue comme un article",
  items.map((it) => `${it.plu}:${it.nom}`).join(" | "));

console.log(`\n${ok} PASS / ${ko} FAIL`);
process.exit(ko ? 1 : 0);
