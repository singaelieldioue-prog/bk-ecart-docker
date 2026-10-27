// SUITE DURABLE — Doublons et intégrité des lignes d'inventaire.
// Une désignation répétée ou un code partagé ne doit JAMAIS fusionner deux lignes en silence :
// les lignes restent distinctes et le conflit est signalé. Les défauts de saisie qui changent
// la valorisation (colisage vide, unité du libellé incohérente avec le Cond., prix absent)
// remontent eux aussi dans la feuille Anomalies.
// Exécution : node tests/doublons-integrite.mjs
import XLSX from "xlsx-js-style";
import { exportExcel } from "../src/utils/excelExporter.js";
import { parseSuivisStock } from "../src/utils/parsers.js";
import { calculer } from "../src/utils/calculators.js";
import { norm } from "../src/utils/formatters.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};

const RATIOS_VIDES = { waLandedCost: {}, waByCode: {}, pmpByIng: {}, byPlu: {}, byNom: {} };

// ── Classeur d'inventaire au format courant (tableau en A, offset 1) ───────────
const wb = XLSX.utils.book_new();
const rows = [];
rows[0] = ["INVENTAIRE INITIAL"];
rows[1] = ["", ""];
rows[2] = ["", "", "", "BK1"];                          // site
rows[3] = ["Saisir uniquement les colonnes vertes"];
rows[4] = ["CATEGORIE", "Frns", "ARTICLE", "COLISAGE"];
rows[5] = ["", "", "", "Nb articles / carton"];         // marque l'offset 1

const ajoute = ({ cat = "Boissons", nom, cond = null, code = "", nb = 1, prix = 1000 }) => {
  const r = [];
  r[0] = cat; r[2] = nom; r[3] = cond; r[8] = nb; r[10] = prix; r[13] = code;
  rows.push(r);
};

// 314 lignes uniques
for (let i = 1; i <= 314; i++) ajoute({ nom: `ARTICLE ${String(i).padStart(3, "0")}`, cond: 12, code: `A${i}` });
// Même désignation, deux colisages → deux lignes distinctes, jamais fusionnées.
ajoute({ nom: "SANITIZER TABLETTE", cond: 24, code: "SANITIZER", nb: 2, prix: 1200 });
ajoute({ nom: "SANITIZER TABLETTE", cond: 25, code: "SANITIZER", nb: 1, prix: 1250 });
// Code partagé par deux désignations différentes (cas SSM30700).
ajoute({ nom: "PRODUIT SSM A", cond: 6, code: "SSM30700" });
ajoute({ nom: "PRODUIT SSM B", cond: 6, code: "SSM30700" });
check(rows.length - 6 === 318, `le classeur porte 318 lignes saisies (lu ${rows.length - 6})`);

// Défauts d'intégrité insérés dans les lignes uniques.
const L = (nom) => rows.find((r) => r && r[2] === nom);
L("ARTICLE 001")[3] = null;                                  // colisage vide
const pack = L("ARTICLE 002");
pack[2] = "PACK DE 25 SERVIETTES";                           // libellé 25…
pack[3] = 24;                                                // …mais Cond. 24
L("ARTICLE 004")[10] = 0;                                    // prix zéro
L("ARTICLE 005")[10] = null;                                 // prix absent

XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Inventaire Initial");
const back = XLSX.read(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }), { type: "buffer" });
const parsed = parseSuivisStock(back, {}, RATIOS_VIDES, {});
const items = parsed.invIni;

// 1. Aucune ligne perdue, aucune fusion silencieuse.
check(Object.keys(items).length === 318,
  `318 lignes saisies = 318 lignes traitées (lues ${Object.keys(items).length})`);
const sanitizer = Object.values(items).filter((a) => norm(a.nom) === norm("SANITIZER TABLETTE"));
check(sanitizer.length === 2, `SANITIZER TABLETTE conservé sur 2 lignes (lu ${sanitizer.length})`);
check(sanitizer.length === 2 && new Set(sanitizer.map((a) => a.qteCdt)).size === 2,
  "les deux colisages (24 et 25) restent distincts",
  sanitizer.map((a) => a.qteCdt).join(" / "));

// 2. Les conflits sont signalés.
const doublons = parsed.doublonsInventaire || [];
const dDes = doublons.find((d) => d.type === "designation" && norm(d.nom) === norm("SANITIZER TABLETTE"));
check(!!dDes && dDes.lignes === 2, "doublon de désignation signalé (2 lignes)", JSON.stringify(dDes));
const dCode = doublons.find((d) => d.type === "code" && d.code === "SSM30700");
check(!!dCode && (dCode.noms || []).length === 2, "code SSM30700 partagé par 2 articles signalé", JSON.stringify(dCode));

// 3. Défauts d'intégrité.
const integ = parsed.anomaliesIntegrite || [];
const aType = (t) => integ.filter((a) => a.type === t);
check(aType("Colisage vide").some((a) => norm(a.nom) === norm("ARTICLE 001")), "colisage vide signalé");
check(aType("Unité incohérente").some((a) => norm(a.nom) === norm("PACK DE 25 SERVIETTES")),
  "unité incohérente signalée (Pack de 25 vs Cond. 24)", JSON.stringify(aType("Unité incohérente")));
check(aType("Prix nul").some((a) => norm(a.nom) === norm("ARTICLE 004")), "prix nul signalé");
check(aType("Prix absent").some((a) => norm(a.nom) === norm("ARTICLE 005")), "prix absent signalé");

// 4. Le calcul et la feuille Anomalies reprennent ces signaux.
const calc = calculer(parsed, [], RATIOS_VIDES, {}, {});
check((calc.doublonsInventaire || []).length >= 2, `le calcul remonte ${(calc.doublonsInventaire || []).length} doublon(s)`);
check((calc.anomaliesIntegrite || []).length >= 4, `le calcul remonte ${(calc.anomaliesIntegrite || []).length} anomalie(s) d'intégrité`);

let blob = null;
globalThis.document = { createElement: () => ({ click() {} }) };
URL.createObjectURL = (b) => { blob = b; return "blob:test"; };
URL.revokeObjectURL = () => {};
await exportExcel({
  titre: "Test doublons", status: "draft", history: [],
  data: { calc, stockData: { pertes: [], douane: [], douaneTotal: 0, offerts: {} }, ratiosMeta: { label: "test" } },
});
const out = XLSX.read(Buffer.from(await blob.arrayBuffer()), { type: "buffer" });
const an = XLSX.utils.sheet_to_json(out.Sheets["Anomalies"], { header: 1, defval: null }).map((r) => String(r[0] || "").toUpperCase());
check(an.some((t) => t.includes("DOUBLON")), "feuille Anomalies : ligne de doublon");
check(an.some((t) => t.includes("COLISAGE VIDE")), "feuille Anomalies : ligne « Colisage vide »");
check(an.some((t) => t.includes("UNITÉ INCOHÉRENTE") || t.includes("UNITE INCOHERENTE")), "feuille Anomalies : ligne d'unité incohérente");

console.log(`\n${ok} PASS / ${ko} FAIL`);
process.exit(ko ? 1 : 0);
