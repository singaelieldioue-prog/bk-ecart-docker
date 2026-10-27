// SUITE DURABLE — C-10 / C-12 : une seule source de prix, et tout écart est signalé.
// Un prix saisi dans le classeur qui diverge du référentiel ne doit être ni écrasé en silence
// (Inventaire) ni masqué (Pertes) : l'écart est conservé et signalé (sens, montant, %).
// Une ligne sans aucun prix (référentiel 0, saisie 0) est une valorisation BLOQUÉE : elle ne
// peut pas valoir 0 F sans le dire.
// Exécution : node tests/prix-source-unique.mjs
import XLSX from "xlsx-js-style";
import { buildModelesWb, exportExcel } from "../src/utils/excelExporter.js";
import { parseSuivisStock } from "../src/utils/parsers.js";
import { calculer } from "../src/utils/calculators.js";
import { norm } from "../src/utils/formatters.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};
const pres = (a, b) => Math.abs(Number(a) - Number(b)) <= 0.01;

const PU_REF = 4576;      // prix carton du référentiel
const PU_SAISI = 1530;    // prix carton saisi dans le classeur (divergent, ne doit pas être perdu)
const COND = 12.5;

const ARTICLES = [
  { nom: "FRITES", code: "FRITES", categorie: "Nourriture - Surgelé", conditionnement: COND, qteInner: 0, unite: "Carton", pu_carton: PU_REF, pu_piece: PU_REF / COND },
  // Publiée sans prix : ni le référentiel local ni la saisie ne la cote.
  { nom: "SALADE ICEBERG - Boule (YG)", code: "TEST-SALADE", categorie: "Nourriture - Frais", conditionnement: 10, qteInner: 0, unite: "Carton", pu_carton: 0, pu_piece: 0 },
];
const RATIOS_VIDES = { waLandedCost: {}, waByCode: {}, pmpByIng: {}, byPlu: {}, byNom: {} };
const LOCAUX = { [norm("FRITES")]: { puPiece: PU_REF / COND, pmpCarton: PU_REF, cdt: COND } };

const wb = buildModelesWb(ARTICLES, [], "BK1", "Octobre 2026", "", ["BK1"], [], []);

// ── Inventaire initial : le classeur porte un prix saisi de 1 530 F ─────────────
const wsInv = wb.Sheets["Inventaire Initial"];
let rInv = 0;
for (let R = 7; wsInv["C" + R]; R++) { if (norm(wsInv["C" + R].v) === norm("FRITES")) { rInv = R; break; } }
check(rInv > 0, "FRITES publiée dans l'Inventaire initial");
wsInv["I" + rInv] = { t: "n", v: 1 };            // 1 carton en stock
wsInv["K" + rInv] = { t: "n", v: PU_SAISI };     // prix saisi, divergent
wsInv["L" + rInv] = { t: "n", v: PU_SAISI };     // valeur écrite par le classeur

// ── Pertes : le classeur porte le même prix saisi ───────────────────────────────
const wsP = wb.Sheets["Perte_Q1 2026"] || wb.Sheets["Pertes"];
let rP = 0;
for (let R = 5; wsP["B" + R]; R++) { if (norm(wsP["B" + R].v) === norm("FRITES")) { rP = R; break; } }
check(rP > 0, "FRITES publiée dans la feuille Pertes");
wsP["D" + rP] = { t: "n", v: PU_SAISI };
wsP["E" + rP] = { t: "n", v: PU_SAISI / COND };
wsP["G" + rP] = { t: "n", v: 2 };                 // 2 pièces perdues

// ── Ligne sans aucun prix : référentiel muet et classeur vide ───────────────────
const AUTRE = "SALADE ICEBERG - Boule (YG)";
let rSans = 0;
for (let R = 7; wsInv["C" + R]; R++) { if (norm(wsInv["C" + R].v) === norm(AUTRE)) { rSans = R; break; } }
check(rSans > 0, `${AUTRE} publiée dans l'Inventaire initial`);
if (rSans > 0) {
  wsInv["I" + rSans] = { t: "n", v: 1 };
  delete wsInv["K" + rSans];
  delete wsInv["L" + rSans];
}

// Aller-retour disque : c'est le fichier relu qui est vérifié.
const back = XLSX.read(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }), { type: "buffer" });
const parsed = parseSuivisStock(back, {}, RATIOS_VIDES, LOCAUX);
const inv = parsed.invIni[norm("FRITES")];

check(!!inv, "FRITES relue à l'import");
check(inv && pres(inv.puCarton, PU_REF),
  `la valorisation garde le prix du référentiel (${inv ? inv.puCarton : "?"} F)`, String(inv && inv.puCarton));
check(inv && pres(inv.puSaisi, PU_SAISI),
  `le prix saisi est conservé, pas remplacé (${inv ? inv.puSaisi : "?"} F)`, String(inv && inv.puSaisi));
const eInv = inv && inv.ecartPrix;
check(!!eInv, "Inventaire : l'écart saisi/référentiel est signalé");
check(eInv && eInv.sens === "saisi < référentiel", `Inventaire : sens de l'écart (${eInv && eInv.sens})`);
check(eInv && pres(Math.abs(eInv.montant), PU_REF - PU_SAISI), `Inventaire : montant 3 046 F (${eInv && eInv.montant})`);
check(eInv && pres(Math.abs(eInv.pct) * 100, (PU_REF - PU_SAISI) / PU_REF * 100), `Inventaire : % de l'écart 66,6 % (${eInv && (eInv.pct * 100).toFixed(2)})`);

const ip = parsed.pertes.find((p) => norm(p.nom) === norm("FRITES"));
check(!!ip, "FRITES relue dans Pertes");
check(ip && pres(ip.puPiece, PU_SAISI / COND),
  `Pertes : le prix pièce du fichier reste la valorisation (${ip ? ip.puPiece : "?"} F)`, String(ip && ip.puPiece));
check(ip && !!ip.ecartPrix, "Pertes : l'écart saisi/référentiel est signalé",
  JSON.stringify(ip && ip.ecartPrix));
check(ip && ip.ecartPrix && ip.ecartPrix.sens === "saisi < référentiel", `Pertes : sens de l'écart (${ip && ip.ecartPrix && ip.ecartPrix.sens})`);

const sans = parsed.invIni[norm(AUTRE)];
check(sans && sans.valorisationBloquee === true,
  "prix référentiel 0 et saisie vide ⇒ valorisation bloquée (pas de 0 silencieux)",
  sans ? `puCarton=${sans.puCarton} bloquee=${sans.valorisationBloquee}` : "ligne absente");

// ── Calcul et feuille Anomalies ────────────────────────────────────────────────
const calc = calculer(parsed, [], RATIOS_VIDES, {}, {});
check(Array.isArray(calc.ecartsPrix) && calc.ecartsPrix.length >= 2,
  `le calcul remonte ${calc.ecartsPrix ? calc.ecartsPrix.length : "?"} écart(s) de prix saisis (≥ 2)`);
check(Array.isArray(calc.valorisationsBloquees) && calc.valorisationsBloquees.length >= 1,
  `le calcul remonte ${calc.valorisationsBloquees ? calc.valorisationsBloquees.length : "?"} valorisation(s) bloquée(s)`);
check(pres(calc.totalValIni, PU_REF), `le stock initial reste valorisé au référentiel (${calc.totalValIni} F)`);

let blob = null;
globalThis.document = { createElement: () => ({ click() {} }) };
URL.createObjectURL = (b) => { blob = b; return "blob:test"; };
URL.revokeObjectURL = () => {};
await exportExcel({
  titre: "Test source de prix", status: "draft", history: [],
  data: { calc, stockData: { pertes: [], douane: [], douaneTotal: 0, offerts: {} }, ratiosMeta: { label: "test" } },
});
const out = XLSX.read(Buffer.from(await blob.arrayBuffer()), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(out.Sheets["Anomalies"], { header: 1, defval: null });
const ligneEcart = rows.find((r) => String(r[0] || "").toUpperCase().includes("PRIX SAISI"));
check(!!ligneEcart, "feuille Anomalies : ligne « Prix saisi ≠ référentiel »");
check(ligneEcart && /3\s*046/.test(String(ligneEcart[4])) && /66[,.]6/.test(String(ligneEcart[4])),
  `ligne d'écart : montant et % lisibles (lu « ${ligneEcart && ligneEcart[4]} »)`);
const ligneBloquee = rows.find((r) => String(r[0] || "").toUpperCase().includes("VALORISATION BLOQU"));
check(!!ligneBloquee, "feuille Anomalies : ligne « Valorisation bloquée »");

console.log(`\n${ok} PASS / ${ko} FAIL`);
process.exit(ko ? 1 : 0);
