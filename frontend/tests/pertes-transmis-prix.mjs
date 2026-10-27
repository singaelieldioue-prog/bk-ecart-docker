// Test durable — feuille Pertes : les seules lignes dont le prix doit encore être trouvé sont les
// 5 que le classeur de référence du CDG laisse à 0 (son XLOOKUP ne trouve pas l'article) :
//   L24  BOUTEILLE PEPSI ZERO 1,5L      (Boissons, Cond. 6)
//   L137 H2 5' Bun                      (Surgelé,  Cond. 90)
//   L140 H3 7' Bun                      (Surgelé,  Cond. 108)
//   L143 H4 Corn dusted 4,5' Bun        (Surgelé,  Cond. 90)
//   L182 CHEESEBURGER JUNIOR            (Produit fini, Cond. 1)
//
// Règle (retour CDG du 25/10 « les prix existent bel et bien », appliqué au périmètre du 26/10) :
// le Cond. de la table fait foi, le prix de l'unité de perte vient de nos sources — d'abord la même
// ligne de l'Inventaire initial du CDG (même désignation, même colisage : ses 3 buns y sont cotés
// alors que sa table des pertes les laisse à 0), puis base complète par désignation exacte,
// référentiel PMIX (coût du Ratio prioritaire sur le complément), base complète par désignation
// approchante à candidat unique — et le Prix carton publié est ce prix d'unité recomposé sur le
// Cond. de la table. Aucun prix n'est inventé : sans source, la colonne reste vide pour le CDG.
//
// Valeurs relevées sur backend/data.db et sur la table Inventaire du CDG (lecture seule) :
//   BOUTEILLE PEPSI ZERO 1,5L · BTL-PEPSI 1,5L · Cond. 6 · 3 150 F carton · 525 F pièce
//   H2 5' Bun · BKFR02 · base Cond. 72 · 14 472 F carton — mais l'Inventaire du CDG cote 29 512,28
//   H3 7' Bun · BKFR03 · base Cond. 96 · 17 472 F carton — mais l'Inventaire du CDG cote 39 577,13
//   H4 Corn dusted 4,5' Bun · BKFR04 · base Cond. 72 · 15 048 F carton — mais l'Inventaire du CDG cote 17 946,27
//   CHEESEBURGER JUNIOR · PLU 815 du Ratio · coût théorique 1 455,41 F la pièce
// Exécution : node tests/pertes-transmis-prix.mjs
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { PERTES_REFERENTIEL_CDG as T } from "../src/utils/pertesReferentielCdg.js";

const REF = [
  { nom: "BOUTEILLE PEPSI 1.5L", code: "BTL-PEPSI 1,5L", categorie: "Boissons", conditionnement: 6, pu_carton: 3150, unite: "Pack", actif: true },
  { nom: "FRITES", code: "FRITES", categorie: "Nourriture - Surgelé", conditionnement: 12.5, pu_carton: 17834.36, unite: "Carton", actif: true },
];
const BASE = [
  { nom: "BOUTEILLE PEPSI ZERO 1,5L", code: "BTL-PEPSI 1,5L", categorie: "Boissons", conditionnement: 6, pu_carton: 3150, pu_piece: 525, unite: "Pack", actif: true },
  { nom: "H2 5' Bun", code: "BKFR02", categorie: "Nourriture", conditionnement: 72, pu_carton: 14472, pu_piece: 201, unite: "Carton", actif: true },
  { nom: "H3 7' Bun", code: "BKFR03", categorie: "Nourriture", conditionnement: 96, pu_carton: 17472, pu_piece: 182, unite: "Carton", actif: true },
  { nom: "H4 Corn dusted 4,5' Bun", code: "BKFR04", categorie: "Nourriture", conditionnement: 72, pu_carton: 15048, unite: "Carton", actif: true },
];
const PRODUITS = [{ plu: "815", nom: "CHEESEBURGER JUNIOR", categorie: "SANDWICHS", coutTheo: 1455.4080171716787, pvTtc: 0 }];
const COMPLEMENT = { "815": { nom: "CHEESEBURG JR", cout: 1500 } };   // le coût du Ratio reste prioritaire

const wb = buildModelesWb(REF, PRODUITS, "BK1", "Octobre 2026", "", [], COMPLEMENT, BASE);
const wbSansSource = buildModelesWb(REF, [], "BK1", "Octobre 2026", "", [], {}, []);
const ws = wb.Sheets["Pertes"], wsVide = wbSansSource.Sheets["Pertes"];
if (!ws || !wsVide) { console.log("FAIL - feuille Pertes absente"); process.exit(1); }

const cell = (w, ref) => w[ref];
const ligneDe = (nom, w = ws) => 5 + T.findIndex((t) => t.nom === nom);

let failed = 0;
const check = (libelle, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} - ${libelle}${ok || !detail ? "" : `\n         ${detail}`}`);
  if (!ok) failed++;
};

console.log("── les 5 lignes sans prix de la référence, cotées sur son Cond. ──");
// H2/H3/H4 : le Cond. de Pertes (90 / 108 / 90) est celui de l'Inventaire initial du CDG, qui cote
// ces trois buns — son prix carton est repris tel quel, sans passer par la base (dont le colisage et
// le prix divergent). PEPSI ZERO et CHEESEBURGER JUNIOR : prix de l'unité de perte × Cond. de la table.
const CDG_INV = { "H2 5' Bun": 29512.28110491956, "H3 7' Bun": 39577.133985186745, "H4 Corn dusted 4,5' Bun": 17946.268113449823 };
[["BOUTEILLE PEPSI ZERO 1,5L", 6, 525 * 6], ["H2 5' Bun", 90, CDG_INV["H2 5' Bun"]],
  ["H3 7' Bun", 108, CDG_INV["H3 7' Bun"]], ["H4 Corn dusted 4,5' Bun", 90, CDG_INV["H4 Corn dusted 4,5' Bun"]],
  ["CHEESEBURGER JUNIOR", 1, 1455.4080171716787]]
  .forEach(([nom, cond, pu]) => {
    const R = ligneDe(nom);
    const C = cell(ws, `C${R}`)?.v, D = cell(ws, `D${R}`)?.v, E = String(cell(ws, `E${R}`)?.f || "");
    check(`${nom} : Cond. ${cond} de la table, Prix carton ${pu.toFixed(2)} (unité de perte × Cond.), prix pièce sans garde`,
      Number(C) === cond && Math.abs(Number(D) - pu) < 0.01 && !/ISNUMBER/.test(E),
      `l${R} C=${JSON.stringify(C)} D=${JSON.stringify(D)} E=${E}`);
  });

console.log("\n── aucune de ces lignes n'est cotée par la référence ──");
const sansPu = T.filter((t) => t.pu === undefined);
check(`la référence ne cote que ${sansPu.length} lignes (${sansPu.map((t) => t.nom).join(", ")})`,
  sansPu.length === 5, `trouvé : ${sansPu.length}`);

console.log("\n── sans base ni Ratio, aucun prix n'est inventé ──");
[["BOUTEILLE PEPSI ZERO 1,5L", 6], ["CHEESEBURGER JUNIOR", 1]]
  .forEach(([nom, cond]) => {
    const R = ligneDe(nom, wsVide);
    const C = cell(wsVide, `C${R}`)?.v, D = cell(wsVide, `D${R}`)?.v, E = String(cell(wsVide, `E${R}`)?.f || "");
    const vide = D === undefined || D === null || D === "";
    check(`${nom} : Cond. ${cond} conservé, Prix laissé vide, prix pièce gardé numérique`,
      Number(C) === cond && vide && /ISNUMBER/.test(E),
      `l${R} C=${JSON.stringify(C)} D=${JSON.stringify(D)} E=${E}`);
  });

console.log("\n── les 3 buns restent cotés par l'Inventaire initial du CDG, même sans base ──");
[["H2 5' Bun", 90], ["H3 7' Bun", 108], ["H4 Corn dusted 4,5' Bun", 90]]
  .forEach(([nom, cond]) => {
    const R = ligneDe(nom, wsVide);
    const C = cell(wsVide, `C${R}`)?.v, D = cell(wsVide, `D${R}`)?.v, E = String(cell(wsVide, `E${R}`)?.f || "");
    check(`${nom} : Cond. ${cond}, Prix carton ${CDG_INV[nom].toFixed(2)} de l'Inventaire du CDG, prix pièce numérique`,
      Number(C) === cond && Math.abs(Number(D) - CDG_INV[nom]) < 0.01 && !/ISNUMBER/.test(E),
      `l${R} C=${JSON.stringify(C)} D=${JSON.stringify(D)} E=${E}`);
  });

console.log("\n── les autres lignes gardent le prix du CDG, les sources ne les touchent pas ──");
const fr = ligneDe("FRITES");
check(`FRITES : Prix carton ${T[fr - 5].pu} de la référence (le fixture Transmission est ignoré)`,
  Math.abs(Number(cell(ws, `D${fr}`)?.v) - T[fr - 5].pu) < 1e-6 && Number(cell(ws, `C${fr}`)?.v) === T[fr - 5].cond,
  `l${fr} C=${JSON.stringify(cell(ws, `C${fr}`)?.v)} D=${JSON.stringify(cell(ws, `D${fr}`)?.v)}`);

console.log("\n── bandeaux retirés ──");
const bandeaux = Object.keys(ws).filter((ref) => /^!/.test(ref) === false)
  .map((ref) => ({ ref, v: String(ws[ref]?.v ?? "") }))
  .filter((x) => /^(ARTICLES TRANSMIS|PRODUITS FINIS)/.test(x.v));
check("aucune cellule « ARTICLES TRANSMIS… » ni « PRODUITS FINIS… »", bandeaux.length === 0,
  bandeaux.map((b) => `${b.ref} = ${b.v}`).join(" | "));

console.log("\n── emprises des formules ──");
const derniere = 5 + T.length - 1;
check("TOTAL PERTES juste après la dernière ligne de données",
  String(cell(ws, `F${derniere + 1}`)?.v ?? "") === "TOTAL PERTES",
  `F${derniere + 1} = ${JSON.stringify(cell(ws, `F${derniere + 1}`)?.v)}`);
check("le Total somme exactement les lignes de données",
  String(cell(ws, `H${derniere + 1}`)?.f ?? "") === `SUM(H5:H${derniere})`,
  `H${derniere + 1} = ${String(cell(ws, `H${derniere + 1}`)?.f ?? "")}`);
const indicateur = String(cell(ws, "J2")?.f ?? "");
check("les indicateurs jour SOMMEPROD s'arrêtent à la dernière ligne de données",
  indicateur.includes(`$E$5:$E$${derniere}`) && !indicateur.includes(`$E$5:$E$${derniere + 1}`),
  `J2 = ${indicateur}`);
check("aucune ligne vide entre la ligne 5 et le Total",
  (() => { for (let r = 5; r <= derniere; r++) if (!String(cell(ws, `B${r}`)?.v ?? "").trim()) return false; return true; })(),
  "une ligne de données n'a pas de désignation en colonne B");

console.log(`\nblocs publiés : ${derniere - 4} lignes de données`);
console.log(failed ? `\n${failed} point(s) en échec` : "\ntous les points passent");
process.exit(failed ? 1 : 0);
