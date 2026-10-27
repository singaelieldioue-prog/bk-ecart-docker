// SUITE DURABLE — A-07 : salades iceberg sans colisage cohérent (boule / kg).
// Le Ratio cote « ICEBERG SALAD (kg) » au kilogramme. Convertir ce prix en prix carton exige
// une masse de carton validée (cdtKg) : le nombre de boules n'est PAS une masse. Sans masse,
// l'application ne choisit aucun prix — elle signale la ligne pour arbitrage du CDG, dans
// l'inventaire comme dans les pertes. Quand la masse est connue, la conversion validée
// (prix kg × masse, cf. regressions-cdg) s'applique.
// Exécution : node tests/iceberg-unite.mjs
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

// Prix Ratio au kg : 6 019,9935 F/kg (ICEBERG SALAD, ligne locale du Ratio).
const PU_KG = 6019.9935;
const RATIOS = {
  waLandedCost: {
    [norm("ICEBERG SALAD (kg)")]: {
      designation: "ICEBERG SALAD (kg)", puPiece: PU_KG, pmpCarton: null, qteCdt: null, parKg: true,
    },
  },
  waByCode: {}, pmpByIng: {}, byPlu: {}, byNom: {},
};
const BASE = {
  [norm("SALADE ICEBERG - Boule (YG)")]: {
    designation: "SALADE ICEBERG - Boule (YG)", unite: "Carton", cdt: 10, cdtKg: null,
    corresponRatio: "ICEBERG SALAD (kg)", categorie: "Nourriture - Frais",
  },
  [norm("SALADE ICEBERG - Boule")]: {
    designation: "SALADE ICEBERG - Boule", unite: "Kg", cdt: 10, cdtKg: 6.5,
    corresponRatio: "ICEBERG SALAD (kg)", categorie: "Nourriture - Frais",
  },
};

// ── Inventaire (format courant, offset 1) ─────────────────────────────────────
const wb = XLSX.utils.book_new();
const rows = [];
rows[0] = ["INVENTAIRE INITIAL"];
rows[1] = ["", ""];
rows[2] = ["", "", "", "BK1"];
rows[3] = ["Saisir uniquement les colonnes vertes"];
rows[4] = ["CATEGORIE", "Frns", "ARTICLE", "COLISAGE"];
rows[5] = ["", "", "", "Nb articles / carton"];
const inv = (cat, nom, cond, nb, prix, code) => {
  const r = [];
  r[0] = cat; r[2] = nom; r[3] = cond; r[8] = nb; r[10] = prix; r[13] = code;
  rows.push(r);
};
inv("Nourriture - Frais", "SALADE ICEBERG - Boule (YG)", 10, 2, null, "ICE-YG"); // masse inconnue
inv("Nourriture - Frais", "SALADE ICEBERG - Boule", 10, 2, null, "ICE-STD");      // masse 6,5 kg validée
inv("Nourriture - Sec", "POMME DE TERRE", 1, 5, 1000, "PDT");                     // témoin
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Inventaire Initial");

// ── Pertes (offset 1 : en-tête en ligne 4) ────────────────────────────────────
const p = [];
p[0] = ["PERTES"];
p[1] = [""];
p[2] = [""];
p[3] = ["Catégorie", "Nom article", "Cond.", "Prix carton", "Prix pièce", "Unité", "Quantité"];
const perte = (cat, nom, cond, puPiece, qte) => {
  const r = [];
  r[0] = cat; r[1] = nom; r[2] = cond; r[3] = null; r[4] = puPiece; r[5] = "kg"; r[6] = qte;
  p.push(r);
};
perte("Nourriture - Frais", "SALADE ICEBERG - Boule (YG)", 7, 122.4, 3);
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(p), "Pertes");

const back = XLSX.read(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }), { type: "buffer" });
const parsed = parseSuivisStock(back, BASE, RATIOS, {});
const items = parsed.invIni;
const item = (nom) => Object.values(items).find((a) => norm(a.nom) === norm(nom));

// 1. Masse inconnue : aucun prix choisi, ni carton ni pièce.
const yg = item("SALADE ICEBERG - Boule (YG)");
check(!!yg, "ligne iceberg sans masse lue");
check(yg && yg.puCarton === 0 && yg.puPiece === 0 && yg.valeur === 0,
  `prix non choisi pour l'iceberg sans masse de carton (lu pu carton ${yg?.puCarton}, pièce ${yg?.puPiece}, valeur ${yg?.valeur})`);
check(yg && yg.valorisationBloquee === true, "la ligne est marquée non valorisable");

// 2. Masse validée : conversion prix kg × masse, jamais × nombre de boules.
const std = item("SALADE ICEBERG - Boule");
check(std && Math.abs(std.puCarton - PU_KG * 6.5) < 0.02,
  `iceberg à masse connue : carton = 6 019,9935 × 6,5 kg = ${(PU_KG * 6.5).toFixed(2)} F (lu ${std?.puCarton})`);

// 3. Signalement des deux origines, sans arbitrage.
const icebergAnos = (parsed.anomaliesIntegrite || []).filter((a) => a.type === "Iceberg sans colisage cohérent");
check(icebergAnos.some((a) => a.origine === "Inventaire initial" && norm(a.nom) === norm("SALADE ICEBERG - Boule (YG)")),
  "anomalie signalée pour l'inventaire (masse inconnue)", JSON.stringify(icebergAnos));
check(icebergAnos.some((a) => a.origine === "Pertes" && norm(a.nom) === norm("SALADE ICEBERG - Boule (YG)")),
  "anomalie signalée pour les pertes", JSON.stringify(icebergAnos));
check(!icebergAnos.some((a) => norm(a.nom) === norm("SALADE ICEBERG - Boule")),
  "aucune anomalie quand la masse du carton est validée");

// 4. Les pertes gardent le prix du fichier : la détection ne réécrit rien.
const perteIce = (parsed.pertes || []).find((x) => norm(x.nom) === norm("SALADE ICEBERG - Boule (YG)"));
check(perteIce && Math.abs(perteIce.puPiece - 122.4) < 0.001 && Math.abs(perteIce.valeur - 367.2) < 0.01,
  `pertes : prix du fichier conservé (122,4 F pièce × 3 = 367,20 F, lu ${perteIce?.puPiece} / ${perteIce?.valeur})`);

// 5. Le calcul et la feuille Anomalies reprennent le signal.
const calc = calculer(parsed, [], RATIOS, BASE, {});
const calcIce = (calc.anomaliesIntegrite || []).filter((a) => a.type === "Iceberg sans colisage cohérent");
check(calcIce.length === 2, `le calcul remonte les 2 signalements (lu ${calcIce.length})`);
check((calc.valorisationsBloquees || []).some((v) => norm(v.nom) === norm("SALADE ICEBERG - Boule (YG)")),
  "l'iceberg sans masse figure parmi les valorisations bloquées");

let blob = null;
globalThis.document = { createElement: () => ({ click() {} }) };
URL.createObjectURL = (b) => { blob = b; return "blob:test"; };
URL.revokeObjectURL = () => {};
await exportExcel({
  titre: "Test iceberg", status: "draft", history: [],
  data: { calc, stockData: { ...parsed, douane: [], douaneTotal: 0, offerts: {} }, ratiosMeta: { label: "test" } },
});
const out = XLSX.read(Buffer.from(await blob.arrayBuffer()), { type: "buffer" });
const an = XLSX.utils.sheet_to_json(out.Sheets["Anomalies"], { header: 1, defval: null });
check(an.some((r) => String(r[0] || "") === "Iceberg sans colisage cohérent"),
  "feuille Anomalies : ligne « Iceberg sans colisage cohérent »",
  an.map((r) => r[0]).join(" | "));

console.log(`\n${ok} PASS / ${ko} FAIL`);
process.exit(ko ? 1 : 0);
