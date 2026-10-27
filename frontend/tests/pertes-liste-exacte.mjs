// Test durable — la feuille Pertes reproduit À L'IDENTIQUE la table « Perte_Q1 2026 » du classeur
// de référence du CDG (exact/suivis stock BK 1.xlsx, feuille Perte_Q1 2026, lignes 5→195).
//
// Demande du 26/10 : « ya un fichier suivi de stock, je produit tout pareil pour notre fichier
// suivi de stock, conditionnement pareil et tout ». La liste des articles suivis en pertes, leur
// catégorie, leur ordre, leur Cond. et leur Unité de perte viennent donc de cette table (module
// src/utils/pertesReferentielCdg.js, extrait cellule par cellule), et plus du modèle d'inventaire.
//
// Conséquences vérifiées ici :
//   · 187 lignes, contiguës de 5 à 191, dans l ordre de la table (5 blocs : Boissons 39,
//     Nourriture - Frais 14, Nourriture - Sec 55, Nourriture - Surgelé 48, Produit fini 31) —
//     les 4 lignes thé / lait de la référence (L44→L47) ont été retirées le 26/10 sur demande ;
//   · la feuille ne dépend plus des articles transmis : deux jeux de données différents publient
//     les mêmes colonnes Catégorie / Nom / Cond. / Unité ;
//   · le Prix carton est celui de la référence, affiché avec ses décimales (la référence affiche
//     8 262,71 pour BIERE BOCK 50cl, pas 8 263) ;
//   · les 5 lignes où la référence est à 0 (son XLOOKUP ne trouve pas l article) gardent notre
//     résolution de prix : les 3 buns sont cotés par l Inventaire initial du CDG (même désignation,
//     même colisage), les 2 autres par la base / le Ratio ; aucun prix n est inventé.
// Exécution : node tests/pertes-liste-exacte.mjs
import fs from "node:fs";
import JSZip from "jszip";
import XLSX from "xlsx-js-style";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { PERTES_REFERENTIEL_CDG as T } from "../src/utils/pertesReferentielCdg.js";

let failed = 0;
const check = (libelle, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} - ${libelle}${ok || !detail ? "" : `\n         ${detail}`}`);
  if (!ok) failed++;
};

// Deux jeux de données volontairement différents : la feuille Pertes doit être identique.
const JOINT_A = [
  { nom: "BIERE BEAUFORT 33cl", code: "BBB33", categorie: "Boissons", conditionnement: 24, pu_carton: 1, unite: "Carton", actif: true },
  { nom: "H2 5' Bun", code: "H2B", categorie: "Nourriture - Surgelé", conditionnement: 90, pu_carton: 15600, unite: "Carton", actif: true },
];
const PRODUITS_A = [{ plu: "110", nom: "WHOPPER", categorie: "SANDWICHS", coutTheo: 999, pvTtc: 0 }];
const BASE_A = [{ nom: "CHEESEBURGER JUNIOR", code: "CBJ", categorie: "Nourriture", conditionnement: 132, pu_carton: 26400, unite: "Carton", actif: true }];
const JOINT_B = [{ nom: "FRITES", code: "FRT", categorie: "Nourriture - Surgelé", conditionnement: 6, pu_carton: 2222, unite: "Carton", actif: true }];

const wbA = buildModelesWb(JOINT_A, PRODUITS_A, "BK1", "Octobre 2026", "", [], {}, BASE_A);
const wbB = buildModelesWb(JOINT_B, [], "BK1", "Octobre 2026", "", [], {}, []);
const wsA = wbA.Sheets["Pertes"], wsB = wbB.Sheets["Pertes"];
if (!wsA || !wsB) { console.log("FAIL - feuille Pertes absente"); process.exit(1); }

const cel = (ws, ref) => ws[ref];
const v = (ws, ref) => { const c = cel(ws, ref); return c === undefined ? undefined : c.v; };

// ── 1. énumération : lignes de la table, contiguës, sans ligne vide, Total juste après ────
const lignes = [];
for (let r = 5; r < 400; r++) {
  const nom = v(wsA, `B${r}`);
  if (String(nom ?? "").trim() === "") break;   // le TOTAL PERTES est en colonne F, pas en B
  lignes.push({ r, nom });
}
check(`${T.length} lignes de données, contiguës de 5 à ${5 + T.length - 1}`,
  lignes.length === T.length && lignes[lignes.length - 1].r === 5 + T.length - 1 && lignes.every((l) => String(l.nom ?? "") !== ""),
  `trouvé : ${lignes.length} lignes, dernière ${lignes[lignes.length - 1]?.r}`);
check("TOTAL PERTES juste après la dernière ligne de données",
  String(v(wsA, `F${5 + T.length}`) ?? "") === "TOTAL PERTES",
  `F${5 + T.length} = ${JSON.stringify(v(wsA, `F${5 + T.length}`))}`);

// ── 2. ligne à ligne : Catégorie / Nom / Cond. / Unité identiques à la table ────────
const ecarts = [];
T.forEach((t, i) => {
  const r = 5 + i;
  const a = String(v(wsA, `A${r}`) ?? ""), b = String(v(wsA, `B${r}`) ?? "");
  const c = v(wsA, `C${r}`), f = v(wsA, `F${r}`), d = v(wsA, `D${r}`);
  if (a !== t.cat) ecarts.push(`L${r} catégorie : ${JSON.stringify(a)} ≠ ${JSON.stringify(t.cat)}`);
  if (b !== t.nom) ecarts.push(`L${r} nom : ${JSON.stringify(b)} ≠ ${JSON.stringify(t.nom)}`);
  if (Number(c) !== t.cond) ecarts.push(`L${t.ligne ?? r} ${t.nom} Cond. : ${JSON.stringify(c)} ≠ ${t.cond}`);
  if (f !== t.unite) ecarts.push(`L${r} ${t.nom} Unité : ${JSON.stringify(f)} ≠ ${JSON.stringify(t.unite)}`);
  if (t.pu !== undefined && Math.abs(Number(d) - t.pu) > 1e-9) ecarts.push(`L${r} ${t.nom} Prix carton : ${JSON.stringify(d)} ≠ ${t.pu}`);
});
check("chaque ligne porte la catégorie, la désignation, le Cond. et l'Unité de perte de la table",
  ecarts.length === 0, ecarts.slice(0, 12).join(" | "));

// ── 3. blocs : 5, dans l'ordre de la table, avec les comptes du CDG ─────────────────
const blocs = [];
lignes.forEach((l, i) => {
  const c = String(v(wsA, `A${l.r}`) ?? "");
  if (!blocs.length || blocs[blocs.length - 1].c !== c) blocs.push({ c, debut: l.r, fin: l.r, n: 1 });
  else { blocs[blocs.length - 1].fin = l.r; blocs[blocs.length - 1].n++; }
});
const ordreAttendu = [];
T.forEach((t) => { if (!ordreAttendu.length || ordreAttendu[ordreAttendu.length - 1].c !== t.cat) ordreAttendu.push({ c: t.cat, n: 1 }); else ordreAttendu[ordreAttendu.length - 1].n++; });
check(`${ordreAttendu.length} blocs dans l'ordre de la table (${ordreAttendu.map((b) => `${b.c} ${b.n}`).join(" → ")})`,
  blocs.length === ordreAttendu.length && blocs.every((b, i) => b.c === ordreAttendu[i].c && b.n === ordreAttendu[i].n),
  blocs.map((b) => `${b.c} ${b.n} (L${b.debut}→${b.fin})`).join(" → "));

// ── 4. insensibilité aux données transmises ─────────────────────────────────────────
const memeColonne = (col) => T.every((t, i) => String(v(wsA, `${col}${5 + i}`) ?? "") === String(v(wsB, `${col}${5 + i}`) ?? ""));
check("le modèle d'inventaire transmis ne change ni la liste, ni l'ordre, ni les Cond. (A/B/C/F identiques sur un autre jeu)",
  memeColonne("A") && memeColonne("B") && memeColonne("C") && memeColonne("F"),
  `A=${memeColonne("A")} B=${memeColonne("B")} C=${memeColonne("C")} F=${memeColonne("F")}`);

// ── 5. prix carton : celui de la référence, avec ses décimales ──────────────────────
const sansPu = T.filter((t) => t.pu === undefined);
check(`${T.length - sansPu.length} Prix carton repris de la référence (champ pu présent)`,
  sansPu.length === 5, `lignes sans prix dans la référence : ${sansPu.length}`);
const z = cel(wsA, "D7")?.z;
check("le Prix carton s'affiche avec ses décimales (8 262,71 et non 8 263)",
  String(z ?? "").includes(".00"), `format D7 = ${JSON.stringify(z)}`);

// ── 6. les 5 lignes sans prix de la référence : résolution, jamais d'invention ──────
// « CHEESEBURGER JUNIOR » est connu de la base complète (132 pièces à 26 400 F le carton, soit
// 200 F la pièce) : le Cond. de la table (1, produit fini) reste la référence, le prix publié est
// donc celui de l'unité de perte recomposé dessus → 200 F.
const cbj = T.findIndex((t) => t.nom === "CHEESEBURGER JUNIOR") + 5;
check("CHEESEBURGER JUNIOR (0 dans la référence) : prix de la source recomposé sur le Cond. de la table",
  Number(v(wsA, `C${cbj}`)) === 1 && Math.abs(Number(v(wsA, `D${cbj}`)) - 200) < 1e-6,
  `L${cbj} C=${JSON.stringify(v(wsA, `C${cbj}`))} D=${JSON.stringify(v(wsA, `D${cbj}`))}`);
// Les 3 buns sont cotés par l'Inventaire initial du CDG (même désignation, même colisage), donc
// publiés au même prix dans les deux jeux de données — la base transmise ne les touche pas.
const CDG_INV = { "H2 5' Bun": 29512.28110491956, "H3 7' Bun": 39577.133985186745, "H4 Corn dusted 4,5' Bun": 17946.268113449823 };
const buns = Object.keys(CDG_INV).map((nom) => 5 + T.findIndex((t) => t.nom === nom));
check("les 3 buns (0 dans la référence) prennent le prix carton de l'Inventaire initial du CDG, dans les deux jeux",
  Object.keys(CDG_INV).every((nom) => {
    const r = 5 + T.findIndex((t) => t.nom === nom);
    return [wsA, wsB].every((w) => Number(v(w, `C${r}`)) === T[r - 5].cond && Math.abs(Number(v(w, `D${r}`)) - CDG_INV[nom]) < 0.01);
  }),
  buns.map((r) => `L${r} A=${JSON.stringify(v(wsA, `D${r}`))} B=${JSON.stringify(v(wsB, `D${r}`))}`).join(" | "));
// « BOUTEILLE PEPSI ZERO 1,5L » et « CHEESEBURGER JUNIOR » ne sont donnés à aucune source dans le
// jeu B (ni base, ni Ratio) : Cond. de la table conservé, prix laissé vide pour le CDG.
const vides = ["BOUTEILLE PEPSI ZERO 1,5L", "CHEESEBURGER JUNIOR"].map((nom) => 5 + T.findIndex((t) => t.nom === nom));
check("lignes sans prix nulle part : Cond. de la table gardé, Prix carton laissé vide pour le CDG",
  vides.every((r) => Number(v(wsB, `C${r}`)) === T[r - 5].cond && (v(wsB, `D${r}`) === undefined || v(wsB, `D${r}`) === "")),
  vides.map((r) => `L${r} C=${JSON.stringify(v(wsB, `C${r}`))} D=${JSON.stringify(v(wsB, `D${r}`))}`).join(" | "));
check("le prix pièce reste numérique sur une ligne sans prix (l'indicateur jour SOMMEPROD la colonne E)",
  vides.every((r) => /ISNUMBER/.test(String(cel(wsB, `E${r}`)?.f ?? ""))),
  vides.map((r) => `E${r} = ${cel(wsB, `E${r}`)?.f}`).join(" | "));

// ── 7. formules et géométrie conservées, bornées aux lignes de la table ──────────────
const derniere = 5 + T.length - 1;
check("Prix pièce = Prix carton ÷ Cond. sur sa propre ligne",
  String(cel(wsA, `E7`)?.f ?? "") === "IF(C7>0,D7/C7,D7)", `E7 = ${cel(wsA, "E7")?.f}`);
check("Quantité perte = SOMME des 31 jours sur sa propre ligne",
  String(cel(wsA, `G${derniere}`)?.f ?? "") === `SUM(J${derniere}:AN${derniere})`, `G${derniere} = ${cel(wsA, `G${derniere}`)?.f}`);
check("Valeur perte = Prix pièce × Quantité sur sa propre ligne",
  String(cel(wsA, `H${derniere}`)?.f ?? "") === `E${derniere}*G${derniere}`, `H${derniere} = ${cel(wsA, `H${derniere}`)?.f}`);
check(`TOTAL PERTES somme exactement les ${T.length} lignes`,
  String(cel(wsA, `H${derniere + 1}`)?.f ?? "") === `SUM(H5:H${derniere})`, `H${derniere + 1} = ${cel(wsA, `H${derniere + 1}`)?.f}`);
check("l'indicateur jour SOMMEPROD s'arrête à la dernière ligne de données",
  String(cel(wsA, "J2")?.f ?? "").includes(`$E$5:$E$${derniere}`) && !String(cel(wsA, "J2")?.f ?? "").includes(`$E$5:$E$${derniere + 1}`),
  `J2 = ${cel(wsA, "J2")?.f}`);
check(`la saisie journalière existe sur les ${T.length} lignes (31 cellules à 0 par ligne)`,
  T.every((_, i) => { const r = 5 + i; return cel(wsA, `J${r}`) !== undefined && cel(wsA, `AN${r}`) !== undefined; }),
  `J5 = ${JSON.stringify(cel(wsA, "J5"))}`);

// ── 8. preuve dans le XML réellement écrit (xlsx-js-style ne rend aucun cache) ──────
const buf = XLSX.write(wbA, { bookType: "xlsx", type: "array" });
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file(`xl/worksheets/sheet${wbA.SheetNames.indexOf("Pertes") + 1}.xml`).async("string");
const lignesXml = new Map();
for (const m of xml.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const cells = {};
  for (const c of m[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g))
    cells[c[1]] = ((c[3] || "").match(/<v[^>]*>([\s\S]*?)<\/v>/) || [])[1];
  lignesXml.set(Number(m[1]), cells);
}
const dansXml = T.filter((_, i) => String(lignesXml.get(5 + i)?.B ?? "") !== "");
check(`les ${T.length} lignes de la table sont écrites dans le XML (B = désignation)`,
  dansXml.length === T.length, `écrites : ${dansXml.length}`);
const condXml = T.filter((t, i) => Number(lignesXml.get(5 + i)?.C) === t.cond).length;
check(`Cond. écrits dans le XML sur ${T.length} lignes`, condXml === T.length, `écrits : ${condXml}`);
const nums = [...lignesXml.keys()];
console.log(`xml : lignes ${Math.min(...nums)}→${Math.max(...nums)}`);

console.log(failed ? `\n${failed} point(s) en échec` : "\ntous les points passent");
process.exit(failed ? 1 : 0);
