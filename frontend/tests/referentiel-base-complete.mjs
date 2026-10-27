// SUITE DURABLE — Référentiel Articles : la base active entière, pas seulement le modèle
// d'inventaire. Demande du 26/10/2026 : « Code article introuvable tu peux verifier ou m'en dire
// plus ?? » puis « ajouter les 484 clés du Référentiel ».
//
// Cause : l'app ne transmet au générateur que les lignes codées de public/exemple inventaire.xlsx
// (orderArticlesByInventoryExample, 318 lignes). Les 484 lignes de la base hors modèle — packaging,
// entretien, fournitures — n'avaient donc aucune clé dans le Référentiel, et les VLOOKUP de
// Transferts (Désignation/Catégorie/Unité/Cond./Prix carton) et de P.Douane (Article/Catégorie/
// Cond./Px carton) restaient vides sur ces codes.
//
// Règles vérifiées :
//  · le modèle garde la priorité et son ordre : le Référentiel d'avant est un préfixe exact du
//    nouveau, aucune clé existante ne bouge ;
//  · le prix publié reste celui de la ligne (pu_carton de la base), sans re-tarification : la
//    colonne G « Prix carton » du fichier de base ne fait pas foi (BUN 7'' NOUGATINE : 9 375 F le
//    colisage 75, conforme à la table des pertes du CDG, et non 703 125 F) ;
//  · la règle « prix carton du CDG » du 26/10 s'applique aux clés ajoutées comme aux autres
//    (BTL-COCA 1.5L reste à 3 686 F) ;
//  · les VLOOKUP de Transferts et P.Douane couvrent la nouvelle dernière ligne.
// Exécution : node tests/referentiel-base-complete.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { parseBaseArticleLocal, enrichirAvecBaseLocale } from "../src/utils/parsers.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};
const lire = (rel) => XLSX.read(fs.readFileSync(new URL(rel, import.meta.url)), { type: "buffer" });
const rows = (ws) => XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
const num = (v) => (typeof v === "number" && v > 0 ? v : 0);
const cleNorm = (s) => String(s ?? "").trim().toUpperCase().replace(/\s+/g, " ");

// ── 1. Les deux listes que l'app transmet réellement ------------------------------------------
// a) le modèle : public/exemple inventaire.xlsx, lignes codées seulement (ordreArticlesByInventoryExample)
const modeleWb = lire("../public/exemple inventaire.xlsx");
const modeleRows = rows(modeleWb.Sheets["inventaire"]).slice(6).filter((r) => r && r[3] && r[14]);
const brut = modeleRows.map((r) => ({
  nom: String(r[3]).trim(), categorie: r[1] || "", fournisseur: r[2] || "SIA",
  conditionnement: num(r[4]) || 1, qteInner: 0, unite: r[10] || "",
  code: String(r[14]).trim(), pu_carton: num(r[12]), pu_piece: 0,
}));
const local = parseBaseArticleLocal(lire("../../sample_data/Base articles finale 29092026.xlsx"));
const modele = enrichirAvecBaseLocale(brut, local);

// b) la base active : ce que porte l'API articles (pu_carton de la ligne, sans colonne G)
const baseWb = lire("../../sample_data/Base articles finale 29092026.xlsx");
const baseRows = rows(baseWb.Sheets["Base complete"]).slice(3).filter((r) => r && typeof r[1] === "string" && r[1].trim());
const baseArticles = baseRows.map((r) => ({
  nom: String(r[1]).trim(),
  code: r[2] != null ? String(r[2]).trim() : "",
  categorie: r[0] || "",
  unite: r[3] || "",
  conditionnement: num(r[4]) || 1,
  pu_carton: num(r[5]),
}));
check(modele.length === 318, `modèle d'inventaire : ${modele.length} lignes codées (attendu 318)`);
check(baseArticles.length === 902, `base « Base complete » : ${baseArticles.length} lignes (attendu 902)`);

// ── 2. Deux générations : avant (sans la base) et après (avec la base) ------------------------
const args = ["BK1", "Octobre 2026", "", ["BK1"], {}];
const wbAvant = buildModelesWb(modele, [], ...args, []);
const wbApres = buildModelesWb(modele, [], ...args, baseArticles);
const refRows = (wb) => rows(wb.Sheets["Référentiel Articles"]).slice(1).filter((l) => l && l[0] != null && String(l[0]).trim());
const avant = refRows(wbAvant);
const apres = refRows(wbApres);
const refParCle = new Map(apres.map((l) => [String(l[0]).trim(), l]));

// ── 3. Aucune clé existante ne bouge : le Référentiel d'avant est un préfixe exact -----------
const identiques = avant.every((l, i) => {
  const n = apres[i];
  return n && [0, 1, 2, 3, 4, 5].every((c) => String(l[c] ?? "") === String(n[c] ?? ""));
});
check(identiques, `les ${avant.length} lignes existantes gardent leur rang et leur contenu (préfixe exact)`,
  avant.map((l, i) => (apres[i] && String(l[0]) === String(apres[i][0]) ? null : `rang ${i + 2} : ${l[0]} → ${apres[i]?.[0]}`)).filter(Boolean).slice(0, 5).join(" ; "));
check(apres.length > avant.length, `le Référentiel grandit : ${avant.length} → ${apres.length} clés`);

// ── 4. Les 484 lignes de la base hors modèle ont leur clé code et leur clé désignation -------
const clesAvant = new Set(avant.map((l) => cleNorm(l[0])));
const clesApres = new Set(apres.map((l) => cleNorm(l[0])));
const cleArticle = (a) => String(a.code || "").trim() || String(a.nom || "").trim();
const horsModele = baseArticles.filter((a) => !clesAvant.has(cleNorm(cleArticle(a))) && !clesAvant.has(cleNorm(a.nom)));
// 484 au rapprochement normalisé (ponctuation repliée) ; 486 en clés exactes, la mesure qui compte
// pour VLOOKUP : BOUTEILLE PEPSI 1.5L et BTL-PEPSI 1.5L ne doublonnent pas BOUTEILLE PEPSI 1,5L.
check(horsModele.length === 486, `lignes de base hors modèle : ${horsModele.length} clés exactes (attendu 486 ; 484 articles au rapprochement normalisé)`);
const codesManquants = horsModele.filter((a) => !clesApres.has(cleNorm(cleArticle(a))));
check(codesManquants.length === 0, `les ${horsModele.length} codes hors modèle sont des clés du Référentiel`,
  codesManquants.slice(0, 6).map((a) => a.code || a.nom).join(" ; "));
const nomsManquants = horsModele.filter((a) => !clesApres.has(cleNorm(a.nom)));
check(nomsManquants.length === 0, `et leur désignation aussi (saisie par nom possible)`,
  nomsManquants.slice(0, 6).map((a) => a.nom).join(" ; "));

// comptage exact : clés codes puis clés désignations, dans l'ordre de la base, sans doublon
const vues = new Set(clesAvant);
let attendues = avant.length;
baseArticles.forEach((a) => { const k = cleNorm(cleArticle(a)); if (k && !vues.has(k)) { vues.add(k); attendues++; } });
baseArticles.forEach((a) => { const k = cleNorm(a.nom); if (k && !vues.has(k)) { vues.add(k); attendues++; } });
check(apres.length === attendues, `nombre de clés attendu : ${attendues} (lu ${apres.length}) — ni doublon ni oubli`);

// ── 5. Prix et colisage des clés ajoutées ----------------------------------------------------
const attendus = {
  "BKCI-PMC050": [1, 40697], "IFB007": [12, 6120], "IFB013": [1, 1300], "IFB016A": [1, 1000],
  "LOCFRNO": [75, 9375],      // = prix de la table des pertes du CDG (9 375 F le colisage 75)
  "IFB008": [500, 30000],     "SGOBHT0270": [1, 22095], "SSM4000": [4000, 42266],
  "SFIMHT0650": [1, 3060],    "IFB002": [1, 3500],     "IFB003": [1, 5000],
  "743000103": [1, 4746],     "992132": [1, 3472],     "BKCI-PMC069": [1, 7855],
  "BKCI-PMC014": [1, 11765],  "BKCI-PMC074": [1, 4248], "BKCI-PMC086": [1, 76132],
  "993058": [1, 1331],        "718394783": [100, 78000], "BKCI-PMC018": [1, 316433],
  "10080029": [3, 5385],      "IFB001": [1, 3500],     "10021443": [1, 24353],
  "BKCI-EAUK12": [12, 966],   "10019367": [1, 39394],  "992130": [1, 5323],
};
Object.entries(attendus).forEach(([code, [cond, prix]]) => {
  const l = refParCle.get(code);
  check(l && Number(l[4]) === cond && Number(l[5]) === prix,
    `clé ${code} : Cond. ${cond} · prix carton ${prix} (lu ${l ? `${l[4]} · ${l[5]}` : "clé absente"})`);
});
const sansPrix = refParCle.get("BKCI-PMC111");
check(sansPrix && !(Number(sansPrix[5]) > 0), "BKCI-PMC111, sans prix dans la base : clé publiée, prix vide — rien n'est inventé");
["CHINA MARKER", "BUN 7'' NOUGATINE", "PAPIER TEFLON"].forEach((nom) => {
  const l = refParCle.get(nom);
  check(l && Number(l[5]) > 0, `clé désignation « ${nom} » publiée (prix ${l ? l[5] : "absent"})`);
});

// ── 6. La règle « prix carton du CDG » du 26/10 tient toujours -------------------------------
check(Number(refParCle.get("BTL-COCA 1.5L")?.[5]) === 3686, `BTL-COCA 1.5L reste à 3 686 F (lu ${refParCle.get("BTL-COCA 1.5L")?.[5]})`);
check(Number(refParCle.get("BOUTEILLE COCA COLA 1.5L")?.[5]) === 3686, "BOUTEILLE COCA COLA 1.5L reste à 3 686 F (clé désignation)");
const a3686 = apres.filter((l) => Number(l[5]) === 3686).map((l) => String(l[0]));
check(a3686.length === 6, `exactement 6 clés à 3 686 F (lu ${a3686.length} : ${a3686.join(" | ")})`);

// ── 7. Transferts et P.Douane lisent jusqu'à la nouvelle dernière ligne -----------------------
const derniere = apres.length + 1;
["Transferts", "P.Douane"].forEach((feuille) => {
  let f = "";
  for (let R = 5; R <= 9 && !f; R++) {
    for (const col of ["A", "B", "C", "D", "E", "G", "H", "I"]) {
      const c = wbApres.Sheets[feuille][col + R];
      if (c?.f && String(c.f).includes("Référentiel Articles")) { f = String(c.f); break; }
    }
  }
  check(f.includes(`$F$${derniere}`), `${feuille} : la plage du VLOOKUP va jusqu'à $F$${derniere}`, f.slice(0, 140) || "(aucune formule trouvée)");
});

console.log(`\n${ok + ko} vérifications · ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
