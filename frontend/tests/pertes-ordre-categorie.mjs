// Test durable — feuille Pertes rangée par catégorie (demande CDG du 26/10 : « fichier de perte
// rangé par catégorie, il y a la catégorie Boissons en haut, en voici une autre décalée, Boissons
// en bas, ici je ne comprends pas »), puis alignée sur le classeur de référence du CDG (demande
// du 26/10 après : « je produit tout pareil … conditionnement pareil et tout »).
//
// L'ordre des blocs n'est plus déduit du modèle d'inventaire : c'est celui de la table
// « Perte_Q1 2026 » (src/utils/pertesReferentielCdg.js), donc fixé par le CDG lui-même. Le fixture
// transmite volontairement un modèle entrelacé et dans un ordre différent : la feuille publiée ne
// doit pas bouger pour autant.
// Exécution : node tests/pertes-ordre-categorie.mjs
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { PERTES_REFERENTIEL_CDG as T } from "../src/utils/pertesReferentielCdg.js";

// Désignations réelles de la table, transmises dans un ordre entrelacé (Boissons, Sec, Surgelé,
// Frais, puis de nouveau Boissons et Sec) : c'est le cas réel du 26/10.
const REF = [
  { nom: "BIERE BOCK 33cl", code: "BB33", categorie: "Boissons", conditionnement: 24, pu_carton: 7200, unite: "Carton", actif: true },
  { nom: "SAUCE KETCHUP", code: "SK1", categorie: "Nourriture - Sec", conditionnement: 15, pu_carton: 20469, unite: "Carton", actif: true },
  { nom: "FRITES", code: "FRITES", categorie: "Nourriture - Surgelé", conditionnement: 24, pu_carton: 9000, unite: "Carton", actif: true },
  { nom: "TOMATES PFI", code: "TP1", categorie: "Nourriture - Frais", conditionnement: 1, pu_carton: 1500, unite: "Carton", actif: true },
  { nom: "BOUTEILLE 7UP 30CL", code: "BTL-7UP 30CL", categorie: "Boissons", conditionnement: 12, pu_carton: 1288.14, unite: "Pack", actif: true },
  { nom: "HUILE AYA 25 L", code: "A25L", categorie: "Nourriture - Sec", conditionnement: 25, pu_carton: 65000, unite: "Carton", actif: true },
  { nom: "MILO", code: "MILO", categorie: "Boissons", conditionnement: 1, pu_carton: 105.93, unite: "Pièce", actif: true },
];
// Un second jeu, dans un ordre de catégories différent : la feuille doit être identique.
const REF_OTHER = [...REF].reverse();
const PRODUITS = [{ plu: "330", nom: "TENDERCRISP", categorie: "SANDWICHS", coutTheo: 1041.31, pvTtc: 0 }];

const wb = buildModelesWb(REF, PRODUITS, "BK1", "Octobre 2026", "", [], {}, []);
const wbAutre = buildModelesWb(REF_OTHER, PRODUITS, "BK1", "Octobre 2026", "", [], {}, []);
const ws = wb.Sheets["Pertes"];
if (!ws) { console.log("FAIL - feuille Pertes absente"); process.exit(1); }
const cel = (w, ref) => w[ref];
const val = (ref) => { const c = cel(ws, ref); if (!c) return ""; return c.v !== undefined ? c.v : (c.f !== undefined ? `=${c.f}` : ""); };
const valAutre = (ref) => { const c = cel(wbAutre.Sheets["Pertes"], ref); if (!c) return ""; return c.v !== undefined ? c.v : (c.f !== undefined ? `=${c.f}` : ""); };
const cle = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

let failed = 0;
const check = (libelle, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} - ${libelle}${ok || !detail ? "" : `\n         ${detail}`}`);
  if (!ok) failed++;
};

// ── inventaire des lignes de données (jusqu'au TOTAL PERTES) ───────────────
const lignes = [];
for (let r = 5; r < 400; r++) {
  const nom = String(val(`B${r}`) || "").trim();
  if (!nom) break;
  lignes.push({ r, categorie: String(val(`A${r}`) || "").trim(), nom });
}
const derniere = lignes.length ? lignes[lignes.length - 1].r : 0;
console.log(`lignes de données : ${lignes.length} (l${lignes[0]?.r}→l${derniere})`);
console.log(`   catégories : ${[...new Set(lignes.map((l) => l.categorie || "(vide)"))].join(" | ")}`);

// ── 1. un seul bloc par catégorie ──────────────────────────────────────────
const blocs = [];
lignes.forEach((l) => {
  const c = l.categorie || "(vide)";
  if (!blocs.length || blocs[blocs.length - 1].c !== c) blocs.push({ c, debut: l.r, fin: l.r, n: 1 });
  else { blocs[blocs.length - 1].fin = l.r; blocs[blocs.length - 1].n++; }
});
const distinctes = [...new Set(blocs.map((b) => b.c))];
console.log("\n── blocs publiés ──");
blocs.forEach((b) => console.log(`   ${String(b.debut).padStart(3)}→${String(b.fin).padEnd(3)} (${String(b.n).padStart(3)}) ${b.c}`));
check(`un seul bloc par catégorie (${distinctes.length} blocs pour ${distinctes.length} catégories)`,
  blocs.length === distinctes.length,
  blocs.filter((b, i) => blocs.slice(0, i).some((h) => h.c === b.c)).map((b) => `${b.c} revient en l${b.debut}`).join(" | "));

// ── 2. ordre des blocs = ordre de la table du CDG, pas celui du modèle transmis ──
const ordreTable = [];
T.forEach((t) => { if (!ordreTable.includes(t.cat)) ordreTable.push(t.cat); });
check(`les blocs suivent l'ordre des catégories de la table du CDG (${ordreTable.join(" → ")})`,
  blocs.map((b) => b.c).join("|") === ordreTable.join("|"),
  `trouvé : ${blocs.map((b) => b.c).join(" → ")}`);
check(`et l'ordre des lignes est celui de la table, ligne à ligne (${T.length} lignes)`,
  lignes.length === T.length && lignes.every((l, i) => cle(l.nom) === cle(T[i].nom)),
  lignes.slice(0, 3).map((l, i) => `l${l.r} ${JSON.stringify(l.nom)} vs table ${JSON.stringify(T[i]?.nom)}`).join(" | "));

// ── 3. le modèle transmis ne déplace rien ──────────────────────────────────
const pareil = lignes.every((l) => String(valAutre(`B${l.r}`) || "").trim() === l.nom);
check("un modèle transmis dans un autre ordre publie la même feuille (même désignation ligne à ligne)",
  pareil && lignes.length === T.length,
  lignes.filter((l) => String(valAutre(`B${l.r}`) || "").trim() !== l.nom).slice(0, 3).map((l) => `l${l.r} ${JSON.stringify(valAutre(`B${l.r}`))} ≠ ${JSON.stringify(l.nom)}`).join(" | "));

// ── 4. les articles du fixture gardent Cond. et Prix de la table ───────────
[["BIERE BOCK 33cl", 24, 6000], ["SAUCE KETCHUP", 15, 20468.7768], ["FRITES", 12.5, 17834.3649], ["TOMATES PFI", 1, 1850]]
  .forEach(([nom, cond, pu]) => {
    const l = lignes.find((x) => cle(x.nom) === cle(nom));
    if (!l) return check(`${nom} : ligne absente`, false);
    const C = val(`C${l.r}`), D = val(`D${l.r}`);
    check(`${nom} : Cond. ${C} et Prix carton ${D} repris de la référence (le prix du fixture est ignoré)`,
      Number(C) === cond && Math.abs(Number(D) - pu) < 0.001,
      `l${l.r} C=${JSON.stringify(C)} D=${JSON.stringify(D)}`);
  });

// ── 5. emprises des formules et volet figé conservés ───────────────────────
check("TOTAL PERTES juste après la dernière ligne de données",
  String(val(`F${derniere + 1}`)) === "TOTAL PERTES", `F${derniere + 1} = ${JSON.stringify(val(`F${derniere + 1}`))}`);
check(`le Total somme H5:H${derniere}`, String(val(`H${derniere + 1}`)) === `=SUM(H5:H${derniere})`,
  `H${derniere + 1} = ${JSON.stringify(val(`H${derniere + 1}`))}`);
check(`les indicateurs jour SOMMEPROD s'arrêtent à la ligne ${derniere}`,
  String(val("J2")).includes(`$E$5:$E$${derniere}`) && !String(val("J2")).includes(`$E$5:$E$${derniere + 1}`),
  `J2 = ${JSON.stringify(val("J2"))}`);
check("chaque ligne garde sa quantité perte SOMME des 31 jours sur sa propre ligne",
  lignes.every((l) => String(val(`G${l.r}`)) === `=SUM(J${l.r}:AN${l.r})`),
  lignes.filter((l) => String(val(`G${l.r}`)) !== `=SUM(J${l.r}:AN${l.r})`).slice(0, 3).map((l) => `G${l.r}=${JSON.stringify(val(`G${l.r}`))}`).join(" | "));

console.log(failed ? `\n${failed} point(s) en échec` : "\ntous les points passent");
process.exit(failed ? 1 : 0);
