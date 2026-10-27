// SUITE DURABLE — prix absents sur les feuilles générées : un 0 du référentiel du CDG n'est pas
// un prix, il ne doit pas masquer un prix connu ; et le CODE ARTICLE relie deux désignations du
// même article (« BOUTEILLE COCA COLA 1.5L » côté modèle d'inventaire, « BTL-COCA 1.5L » ou
// « BTL COCA 1 5L » côté base) — demande du 26/10/2026 : « on peut regarder les codes article
// pour faire correspondre certains prix absents sur les inventaires, transferts, douane et pertes ».
//
// Règle du 26/10 (retour : « le prix du carton doit primer ici ») : quand le CDG laisse sa ligne
// d'Inventaire à 0, c'est son PRIX CARTON (table des pertes, même désignation et même colisage)
// qui prime sur le prix pièce de la base. BOUTEILLE COCA COLA 1.5L : 3 686 F le pack de 6
// (614,33 F pièce), et non les 127,47 F pièce que la base donne pour un colisage de 1.
// La même règle alimente le Référentiel Articles (masqué), que lisent Transferts (colonne I) et
// P.Douane (colonne G) par VLOOKUP : un transfert saisi sur BTL-COCA 1.5L sort donc à 3 686 F.
// Exécution : node tests/prix-code-absent.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { parseBaseArticleLocal } from "../src/utils/parsers.js";
import { INVENTAIRE_REFERENTIEL_CDG } from "../src/utils/inventaireReferentielCdg.js";
import { PERTES_REFERENTIEL_CDG } from "../src/utils/pertesReferentielCdg.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};
const norm = (s) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const cel = (x) => (x === undefined ? "" : x.v === undefined ? "" : x.v);

// ── 1. Inventaire : le prix CARTON du CDG prime sur le prix pièce de la base -------------------
const articles = [
  // ligne du modèle d'inventaire (le CDG laisse son prix à 0) + son jumeau de base, qui ne donne
  // qu'un prix PIÈCE de 127,47 F (colisage 1) : il ne doit pas devenir le prix carton du pack de 6
  { nom: "BOUTEILLE COCA COLA 1.5L", code: "BTL-COCA 1.5L", categorie: "Boissons", fournisseur: "SIA", conditionnement: 6, unite: "Pack de 6", pu_carton: 0, pu_piece: 0 },
  { nom: "BTL-COCA 1.5L", code: "BTL COCA 1 5L", categorie: "Boissons", fournisseur: "SIA", conditionnement: 1, unite: "", pu_carton: 127.47, pu_piece: 127.47 },
  // prix pièce de la base sur la ligne elle-même, CDG à 0 : le carton du CDG (3 686) prime
  { nom: "BOUTEILLE FANTA 1.5L", code: "BTL-FANTA 1.5L", categorie: "Boissons", fournisseur: "SIA", conditionnement: 6, unite: "Pack de 6", pu_carton: 525, pu_piece: 87.5 },
  // prix CDG positif : il fait foi, même si la base dit autre chose
  { nom: "BOUTEILLE SPRITE 50cL", code: "BTL-SPRITE 50CL", categorie: "Boissons", fournisseur: "SIA", conditionnement: 6, unite: "Pack de 6", pu_carton: 339, pu_piece: 56.5 },
  // CDG à 0 mais coté par sa table des pertes : son prix carton prime
  { nom: "BOUTEILLE SPRITE 1.5L", code: "BTL-SPRITE 1.5L", categorie: "Boissons", fournisseur: "SIA", conditionnement: 6, unite: "Pack de 6", pu_carton: 0, pu_piece: 0 },
  // CDG à 0 et aucune source nulle part : reste 0
  { nom: "BOITE ENFANT", code: "BOITE ENFANT", categorie: "Packaging", fournisseur: "SIA", conditionnement: 180, unite: "Carton", pu_carton: 0, pu_piece: 0 },
];
const wb = buildModelesWb(articles, [], "BK1", "Octobre 2026", "", ["BK1"], [], articles);
const ws = wb.Sheets["Inventaire Initial"];
const ligneInv = (nom) => {
  for (let R = 7; ws["C" + R]?.v; R++) if (norm(ws["C" + R].v) === norm(nom)) return R;
  return null;
};
const R_COCA = ligneInv("BOUTEILLE COCA COLA 1.5L");
const R_FANTA = ligneInv("BOUTEILLE FANTA 1.5L");
const R_SPRITE50 = ligneInv("BOUTEILLE SPRITE 50cL");
const R_SPRITE15 = ligneInv("BOUTEILLE SPRITE 1.5L");
const R_BOITE = ligneInv("BOITE ENFANT");
check(R_COCA && R_FANTA && R_SPRITE50 && R_SPRITE15 && R_BOITE, "les 5 lignes d'essai figurent dans l'Inventaire");
// « Prix carton » de la table des pertes du CDG pour les bouteilles 1,5L (Pack de 6)
const CARTON_CDG = 3686;
check(cel(ws["K" + R_COCA]) === CARTON_CDG, `COCA 1.5L : prix carton du CDG (K = ${JSON.stringify(cel(ws["K" + R_COCA]))}, attendu 3686) — le prix pièce 127,47 de la base ne prime pas`);
check(cel(ws["K" + R_FANTA]) === CARTON_CDG, `FANTA 1.5L : prix carton du CDG 3686 prime sur le prix pièce 525 de la base (K = ${JSON.stringify(cel(ws["K" + R_FANTA]))})`);
check(cel(ws["K" + R_SPRITE50]) === 1524, `SPRITE 50cL : un prix CDG positif reste prioritaire sur la base 339 (K = ${JSON.stringify(cel(ws["K" + R_SPRITE50]))})`);
check(cel(ws["K" + R_SPRITE15]) === CARTON_CDG, `SPRITE 1.5L : prix carton du CDG, même sans base (K = ${JSON.stringify(cel(ws["K" + R_SPRITE15]))})`);
check(cel(ws["K" + R_BOITE]) === 0, `BOITE ENFANT : aucune source dans les tables du CDG, 0 publié (K = ${JSON.stringify(cel(ws["K" + R_BOITE]))})`);
check([R_COCA, R_FANTA, R_SPRITE15].every((R) => Math.abs(cel(ws["K" + R]) / cel(ws["D" + R]) - 3686 / 6) < 0.01),
  "les 3 bouteilles 1,5L publient le prix pièce du CDG (3 686 ÷ 6 = 614,33 F), pas 127,47 ni 525");
check(ws["L" + R_COCA]?.f === `I${R_COCA}*K${R_COCA}`, "la valeur de stock reste Nombre × prix (formule inchangée)");

// ── 2. Référentiel Articles : c'est lui que lisent Transferts (I) et P.Douane (G) -------------
const ref = XLSX.utils.sheet_to_json(wb.Sheets["Référentiel Articles"], { header: 1, defval: null });
// VLOOKUP compare la clé à l'identique (FALSE) : la carte de contrôle fait de même, sans
// normalisation — « BTL-COCA 1.5L » et « BTL COCA 1 5L » sont deux clés différentes.
const refParCle = new Map(ref.slice(1).filter((l) => l && l[0]).map((l) => [String(l[0]).trim(), l]));
check(Number(refParCle.get("BTL-COCA 1.5L")?.[5]) === CARTON_CDG,
  "référentiel, clé code « BTL-COCA 1.5L » : 3 686 publiés — c'est ce que lisent Transferts (I) et P.Douane (G)");
check(Number(refParCle.get("BOUTEILLE COCA COLA 1.5L")?.[5]) === CARTON_CDG,
  "référentiel, clé désignation « BOUTEILLE COCA COLA 1.5L » : même prix carton (saisie par nom possible)");
check(Number(refParCle.get("BOUTEILLE FANTA 1.5L")?.[5]) === CARTON_CDG,
  "référentiel, FANTA 1.5L : le prix carton du CDG prime aussi sur le prix pièce 525 de la base");
check(Number(refParCle.get("BTL-SPRITE 1.5L")?.[5]) === CARTON_CDG,
  "référentiel, SPRITE 1.5L : cotée par la table des pertes du CDG, elle publie 3 686 et non 0");
check(Number(refParCle.get("BTL COCA 1 5L")?.[5]) === 127.47,
  "référentiel, clé « BTL COCA 1 5L » : la ligne de base seule n'est pas re-tarifée (127,47 conservés)");
check(Number(refParCle.get("BOUTEILLE SPRITE 50cL")?.[5]) === 339,
  "référentiel, SPRITE 50cL : les lignes que le CDG cote gardent le prix de la ligne (339), pas de re-tarification");
check(Number(refParCle.get("BOITE ENFANT")?.[5]) === 0,
  "référentiel, BOITE ENFANT : aucune source dans les tables du CDG, 0 publié, rien n'est inventé");
check(String(wb.Sheets["Transferts"]["I5"]?.f ?? "").includes("'Référentiel Articles'") && String(wb.Sheets["P.Douane"]["G5"]?.f ?? "").includes("'Référentiel Articles'"),
  "Transferts I et P.Douane G lisent toujours le référentiel par code (VLOOKUP colonne 6)");

// ── 3. Pertes : les 3 lignes laissées à 0 par la table du CDG, cotées par son Inventaire ------
const invCdg = new Map(INVENTAIRE_REFERENTIEL_CDG.map((t) => [norm(t.nom), t]));
const pertes = XLSX.utils.sheet_to_json(wb.Sheets["Pertes"], { header: 1, defval: null });
const lignePerte = (nom) => pertes.find((l) => l && norm(l[1]) === norm(nom));
const carte = (nom) => {
  const t = PERTES_REFERENTIEL_CDG.find((x) => norm(x.nom) === norm(nom));
  const i = invCdg.get(norm(nom));
  return { t, attendu: (Number(i.pu) / Number(i.cond)) * Number(t.cond) };
};
[["H2 5' Bun"], ["H3 7' Bun"], ["H4 Corn dusted 4,5' Bun"]].forEach(([nom]) => {
  const { attendu } = carte(nom);
  const l = lignePerte(nom);
  check(l && Math.abs(Number(l[3]) - attendu) < 0.01,
    `Pertes · ${nom} : prix de l'Inventaire du CDG (${attendu.toFixed(2)} F carton) — lu ${l ? l[3] : "absent"}`);
});
["BOUTEILLE PEPSI ZERO 1,5L", "CHEESEBURGER JUNIOR"].forEach((nom) => {
  const l = lignePerte(nom);
  check(l && (l[3] === null || l[3] === undefined || l[3] === ""),
    `Pertes · ${nom} : aucune source dans les tables du CDG, la cellule reste vide (lu ${JSON.stringify(l ? l[3] : "absent")})`);
});
// les 186 lignes déjà cotées par la table ne bougent pas
const bouge = PERTES_REFERENTIEL_CDG.filter((t) => Number(t.pu) > 0).filter((t) => {
  const l = lignePerte(t.nom);
  return !l || Math.abs(Number(l[3]) - Number(t.pu)) > 0.01;
});
check(bouge.length === 0, `Pertes : les ${PERTES_REFERENTIEL_CDG.filter((t) => Number(t.pu) > 0).length} lignes cotées par le CDG gardent son prix`, bouge.slice(0, 4).map((t) => t.nom).join(" ; "));

// ── 4. Données réelles : modèle d'inventaire du CDG + base consolidée -------------------------
const lire = (rel) => XLSX.read(fs.readFileSync(new URL(rel, import.meta.url)), { type: "buffer" });
const num = (v) => (typeof v === "number" && v > 0 ? v : 0);
const rows = (ws) => XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
const invSrc = rows(lire("../../sample_data/exemple inventaire.xlsx").Sheets["inventaire"]);
const brut = invSrc.slice(1).filter((r) => r && typeof r[3] === "string" && r[3].trim()).map((r) => ({
  nom: String(r[3]).trim(), categorie: r[1] || "", fournisseur: r[2] || "SIA",
  conditionnement: num(r[4]) || 1, qteInner: 0, unite: r[10] || "",
  code: r[14] != null ? String(r[14]).trim() : "", pu_carton: num(r[12]), pu_piece: 0,
}));
// la base locale est celle de l'app : enrichissement par nom puis par code avant génération
const { enrichirAvecBaseLocale } = await import("../src/utils/parsers.js");
const local = parseBaseArticleLocal(lire("../../sample_data/Base articles finale 29092026.xlsx"));
const pubs = enrichirAvecBaseLocale(brut, local);
const wb2 = buildModelesWb(pubs, [], "BK1", "Octobre 2026", "", ["BK1"], {}, brut);
const ws2 = wb2.Sheets["Inventaire Initial"];
const reel = (nom) => { for (let R = 7; ws2["C" + R]?.v; R++) if (norm(ws2["C" + R].v) === norm(nom)) return cel(ws2["K" + R]); return "absent"; };
[["BOUTEILLE COCA COLA 1.5L", 3686], ["BOUTEILLE FANTA 1.5L", 3686], ["BOUTEILLE SPRITE 1.5L", 3686]].forEach(([nom, attendu]) => {
  const lu = reel(nom);
  check(typeof lu === "number" && Math.abs(lu - attendu) < 0.01, `données réelles · ${nom} : prix carton du CDG K = ${attendu} (lu ${JSON.stringify(lu)})`);
});
[["BOITE ENFANT", 0], ["BOL A SALADE", 0], ["TOMATES BENEVA", 0]].forEach(([nom, attendu]) => {
  check(reel(nom) === attendu, `données réelles · ${nom} : aucune source, K reste 0 (lu ${JSON.stringify(reel(nom))})`);
});
const pertes2 = XLSX.utils.sheet_to_json(wb2.Sheets["Pertes"], { header: 1, defval: null });
[["H2 5' Bun", 29512.28110491956], ["H3 7' Bun", 39577.133985186745], ["H4 Corn dusted 4,5' Bun", 17946.268113449823]].forEach(([nom, attendu]) => {
  const l = pertes2.find((x) => x && norm(x[1]) === norm(nom));
  check(l && Math.abs(Number(l[3]) - attendu) < 0.01, `données réelles · Pertes ${nom} : D = ${attendu.toFixed(2)} (lu ${l ? l[3] : "absent"})`);
});

console.log(`\n${ok + ko} vérifications · ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
