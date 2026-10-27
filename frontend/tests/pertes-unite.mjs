// Test durable — colonne « Unité de perte » de la feuille Pertes.
// Historique : la colonne décrivait le colisage de la base (« Pack de 12 », « Carton de 24 »),
// parce qu'une unité lue « Pack » ou « Carton » seule ne permet pas de compter une perte (retour
// CDG du 25/10). Depuis l'alignement sur le classeur de référence du CDG (26/10), l'unité de perte
// est celle que le CDG pratique lui-même : un jeton de pesée — pièce, g, kg ou litre — et le Cond.
// indique combien de ces unités contient un carton. Le colisage de la base ne doit donc plus
// contaminer la colonne.
// Exécution : node tests/pertes-unite.mjs
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { PERTES_REFERENTIEL_CDG as T } from "../src/utils/pertesReferentielCdg.js";

// La base transmitted ment exprès sur l'unité et le colisage : la colonne F doit rester le jeton du CDG.
const articles = [
  { nom: "BOUTEILLE FANTA 30cL", code: "FANTA30", unite: "Pack", categorie: "Boissons", conditionnement: 999, pu_carton: 1, actif: true },
  { nom: "CONCOMBRE", code: "CONCO", unite: "Carton", categorie: "Nourriture - Frais", conditionnement: 7, pu_carton: 2, actif: true },
  { nom: "FRITES", code: "FRITES", unite: "Pièce", categorie: "Nourriture - Surgelé", conditionnement: 3, pu_carton: 3, actif: true },
];

const wb = buildModelesWb(articles, [], "BK1", "Octobre 2026", "", [], [], []);
const ws = wb.Sheets["Pertes"];
if (!ws) { console.log("FAIL - feuille Pertes absente"); process.exit(1); }

const ligneDe = (nom) => {
  const cle = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  for (let r = 5; r < 400; r++) if (cle(String(ws[`B${r}`]?.v || "")) === cle(nom)) return r;
  return 0;
};

let failed = 0;
const check = (libelle, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} - ${libelle}${ok || !detail ? "" : `\n         ${detail}`}`);
  if (!ok) failed++;
};

// ── 1. les trois jetons du CDG sont publiés tels quels ─────────────────────
[["BOUTEILLE FANTA 30cL", "pièce"], ["CONCOMBRE", "g"], ["FRITES", "kg"], ["TOMATES PFI", "kg"], ["HUILE AYA 25 L", "litre"]]
  .forEach(([nom, unite]) => {
    const R = ligneDe(nom);
    const trouve = R ? String(ws[`F${R}`]?.v || "") : "(ligne absente)";
    const cond = R ? Number(ws[`C${R}`]?.v) : 0;
    const t = T.find((x) => x.nom === nom);
    check(`${nom} : unité « ${unite} » et Cond. ${t.cond} de la référence (colisage de la base ignoré)`,
      trouve === unite && cond === t.cond, `trouvé : unité ${JSON.stringify(trouve)}, Cond. ${JSON.stringify(cond)}`);
  });

// ── 2. plus aucun libellé de colisage dans la colonne ─────────────────────
const jetons = new Set(["pièce", "g", "kg", "litre"]);
const horsJeton = T.filter((t, i) => !jetons.has(String(ws[`F${5 + i}`]?.v || "")));
check(`les ${T.length} lignes portent un jeton de pesée (pièce, g, kg, litre)`,
  horsJeton.length === 0, horsJeton.slice(0, 5).map((t) => `${t.nom} → ${JSON.stringify(ws[`F${5 + T.indexOf(t)}`]?.v)}`).join(" | "));
const avecColisage = T.filter((t, i) => /pack de|carton de/i.test(String(ws[`F${5 + i}`]?.v || "")));
check("aucune unité ne recopie un colisage de la base (« Pack de … », « Carton de … »)",
  avecColisage.length === 0, avecColisage.map((t) => t.nom).join(" | "));

// ── 3. le prix pièce rendu par la formule reste le prix de l'unité de perte ─
const R = ligneDe("CONCOMBRE");
check(`Cond. × prix pièce = prix carton (${T.find((x) => x.nom === "CONCOMBRE").cond} g pour 500 F, soit 0,5 F le gramme)`,
  Number(ws[`C${R}`]?.v) * (Number(ws[`D${R}`]?.v) / Number(ws[`C${R}`]?.v)) === 500,
  `C=${JSON.stringify(ws[`C${R}`]?.v)} D=${JSON.stringify(ws[`D${R}`]?.v)} E=${JSON.stringify(ws[`E${R}`]?.f)}`);

console.log(failed ? `\n${failed} point(s) en échec` : "\ntous les points passent");
process.exit(failed ? 1 : 0);
