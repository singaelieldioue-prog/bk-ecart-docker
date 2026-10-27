// PERTES-CA-HT — la ligne 1 « CA HT du jour » doit EXISTER dans le classeur écrit.
// Modèle du CDG (PERTE JULLET.xlsx, feuilles BK1..BK9) : I1 « CA HT » puis J1..AN1 saisis
// jour par jour (BK1 : 1 299 215 … , somme 44 856 753 F = le CA Réalisé de CA JUILLET 2026.xlsx
// !CA!C4), AO2 = SUBTOTAL(9,$J$2:$AN$2) ; BK8 ajoute AO1 = +SUM(J1:AN1) et le ratio global.
// Le générateur écrivait ces 31 cellules sans valeur : SheetJS ne publie pas une cellule
// `{t:"n"}` sans `v` ni `f` → les 31 cellules disparaissaient du XML (P0 de verif_suivi_stock.md).
// La vérification se fait donc dans le XML réellement écrit (xlsx-js-style ne rend aucun cache).
// Exécution : node tests/pertes-ca-ht.mjs
import assert from "node:assert/strict";

import JSZip from "jszip";
import XLSX from "xlsx-js-style";

import { buildModelesWb } from "../src/utils/excelExporter.js";

const check = (libelle, fn) => {
  try {
    fn();
    console.log(`PASS - ${libelle}`);
    return true;
  } catch (e) {
    console.log(`FAIL - ${libelle} → ${e.message.split("\n")[0]}`);
    return false;
  }
};

// Deux articles (un matière avec colisage+prix, un produit fini) et un PLU du Ratio.
const ARTICLES = [
  { nom: "BIERE BOCK 33cl", code: "BB33", categorie: "Boissons", unite: "pièce", conditionnement: 24, pu_carton: 12000, actif: 1 },
  { nom: "FRITES", code: "FRT", categorie: "Nourriture - Surgelé", unite: "carton", conditionnement: 6, pu_carton: 9000, actif: 1 },
];
const PRODUITS = [{ plu: "706", nom: "SMALL FRIES", categorie: "SANDWICHS", coutTheo: 229.7356 }];

const wb = buildModelesWb(ARTICLES, PRODUITS, "BK1", "Octobre 2026", "", [], {}, []);
const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
const zip = await JSZip.loadAsync(buf);
const nomFeuille = wb.SheetNames.indexOf("Pertes");
const xml = await zip.file(`xl/worksheets/sheet${nomFeuille + 1}.xml`).async("string");

// Décodage des lignes OOXML : { ligne: { col: {v, f, t, s} } }
const decode = (s) =>
  String(s ?? "")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const lignes = {};
for (const m of xml.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const cells = {};
  for (const c of m[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const body = c[3] || "";
    cells[c[1]] = {
      f: decode((body.match(/<f[^>]*>([\s\S]*?)<\/f>/) || [])[1]),
      v: decode((body.match(/<v[^>]*>([\s\S]*?)<\/v>/) || [])[1]),
      attrs: c[2],
    };
  }
  lignes[Number(m[1])] = cells;
}

// xl/styles.xml : un indice cellXfs peut désigner un style visuellement identique à un autre
// (xlsx-js-style ne déduplique pas), donc le contrôle d'aspect passe par la résolution
// indice → xf → fill, pas par l'égalité des indices.
const stylesXml = await zip.file("xl/styles.xml").async("string");
const fillsXml = [...stylesXml.matchAll(/<fill>(?:(?!<fill>)[\s\S])*?<\/fill>/g)].map((m) => m[0]);
const xfsXml = [...stylesXml.match(/<cellXfs[\s\S]*?<\/cellXfs>/)[0].matchAll(/<xf\b[\s\S]*?(?:\/>|<\/xf>)/g)].map((m) => m[0]);
const attrsOf = (tag, re) => decode((tag.match(re) || [])[1]);
const styleDe = (attrs) => {
  const idx = Number((attrs.match(/s="(\d+)"/) || [])[1]);
  const xf = xfsXml[idx] || "";
  const fillTag = fillsXml[Number((xf.match(/fillId="(\d+)"/) || [])[1])] || "";
  return {
    idx,
    rgb: attrsOf(fillTag, /fgColor rgb="([0-9A-F]+)"/),
    numFmtId: (xf.match(/numFmtId="(\d+)"/) || [])[1],
    align: attrsOf(xf, /horizontal="([a-z]+)"/),
  };
};

const JOURS = Array.from({ length: 31 }, (_, i) => XLSX.utils.encode_col(9 + i)); // J..AN
const failures = [];
const run = (libelle, fn) => { if (!check(libelle, fn)) failures.push(libelle); };

// ── 1. Les 31 cellules de saisie du CA HT existent dans le XML, en zone de saisie ──
run("les 31 cellules J1..AN1 existent dans le XML écrit", () => {
  const ecrites = JOURS.filter((c) => lignes[1]?.[c]);
  assert.equal(ecrites.length, 31, `${ecrites.length}/31 (${JOURS.filter((c) => !lignes[1]?.[c]).join(",")})`);
});
run("J1..AN1 sont numériques, vides de formule, pré-remplies 0 comme les colonnes jour", () => {
  JOURS.forEach((c) => {
    const cell = lignes[1][c];
    assert.ok(!cell.f, `${c}1 porte une formule`);
    assert.equal(cell.v, "0", `${c}1 = ${JSON.stringify(cell.v)}`);
  });
});
run("J1..AN1 portent le style de saisie vert et le format nombre", () => {
  JOURS.forEach((c) => {
    const st = styleDe(lignes[1][c].attrs);
    assert.equal(st.rgb, "FFE8F5E9", `${c}1 remplissage ${st.rgb} (attendu FFE8F5E9, vert de saisie)`);
    assert.equal(st.numFmtId, "3", `${c}1 format ${st.numFmtId} (attendu 3 = « #,##0 »)`);
    assert.equal(st.align, "right", `${c}1 alignement ${st.align}`);
    assert.ok(!/t="s"/.test(lignes[1][c].attrs), `${c}1 est du texte`);
  });
});
run("I1 reste le libellé « CA HT »", () => {
  assert.match(String(lignes[1].I.v), /CA HT/);
});

// ── 2. Total du CA et ratio global, comme BK8 du fichier du CDG ────────────────
run("AO1 = somme des 31 jours de CA", () => {
  assert.equal(lignes[1].AO.f, "SUM(J1:AN1)");
});
run("AO3 = ratio global perte / CA, gardé contre AO1 = 0", () => {
  assert.equal(lignes[3].AO.f, 'IF(AO1=0,"",AO2/AO1)');
});
run("AO2 (total des valeurs perdues) conserve SUBTOTAL(9,$J$2:$AN$2)", () => {
  assert.equal(lignes[2].AO.f, "SUBTOTAL(9,$J$2:$AN$2)");
});

// ── 3. Les indicateurs jour existants ne bougent pas ───────────────────────────
run("J2 et J3 sont intacts (SOMMEPROD borné à la dernière ligne, ratio IF(J1=0,…))", () => {
  const derniere = Math.max(...Object.keys(lignes).map(Number)) - 1; // ligne du TOTAL PERTES
  assert.equal(lignes[2].J.f, `SUMPRODUCT(J$5:J$${derniere},$E$5:$E$${derniere})`);
  assert.equal(lignes[3].J.f, 'IF(J1=0,"",J2/J1)');
});

// ── 4. Aller-retour : la ligne 1 n'est pas lue par l'import ────────────────────
// parseSuivisStock parcourt Pertes à partir de rows[3] (ligne 4 = en-têtes) et écarte
// toute ligne sans quantité perdue (parsers.js:691) : un modèle neuf, CA HT à 0 partout,
// doit donc remonter 0 perte.
const { parseSuivisStock } = await import("../src/utils/parsers.js");
const { norm } = await import("../src/utils/formatters.js");
// L'import consomme des maps indexées sur norm(désignation), pas la liste d'articles
// du générateur : BIERE BOCK 33cl y a un colisage (cdt) et un prix pièce de 500 F.
const BASE_IMPORT = { [norm("BIERE BOCK 33cl")]: { cdt: 24, corresponRatio: null } };
const LOCAUX = { [norm("BIERE BOCK 33cl")]: { nom: "BIERE BOCK 33cl", code: "BB33", cdt: 24, puPiece: 500, pmpCarton: 12000 } };
const RATIOS = { waLandedCost: {}, waByCode: {}, pmpByIng: {} };
const relu = () =>
  XLSX.read(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }), { type: "buffer", cellFormula: true });

run("réimport du modèle neuf : aucune perte (le CA HT ne crée pas de ligne fantôme)", () => {
  const sd = parseSuivisStock(relu(), BASE_IMPORT, RATIOS, LOCAUX);
  assert.equal((sd.pertes || []).length, 0, JSON.stringify(sd.pertes));
});
run("réimport : le CA HT n'est pas pris pour une quantité perdue", () => {
  const sd = parseSuivisStock(relu(), BASE_IMPORT, RATIOS, LOCAUX);
  assert.ok(!(sd.pertes || []).some((p) => /CA HT/i.test(String(p.nom))), 'une ligne « CA HT » est importée comme perte');
});
run("saisie réelle : 2 pièces sur la ligne de BIERE BOCK 33cl = 1 perte valorisée au prix pièce", () => {
  const r = relu();
  const ws = r.Sheets["Pertes"];
  // La feuille est pilotée par la table du CDG : BIERE BOCK 33cl y est la 2e ligne de données.
  let R = 0;
  for (let i = 5; i < 300 && !R; i++) if (String(ws[`B${i}`]?.v || "").trim() === "BIERE BOCK 33cl") R = i;
  assert.ok(R > 0, "BIERE BOCK 33cl n a pas de ligne de données");
  ws[`J${R}`] = { v: 2, t: "n" }; // G (Σ jours) et E (prix pièce) restent des formules sans cache
  const sd = parseSuivisStock(r, BASE_IMPORT, RATIOS, LOCAUX);
  const pertes = sd.pertes || [];
  assert.equal(pertes.length, 1, JSON.stringify(pertes.map((p) => p.nom)));
  assert.match(pertes[0].nom, /BIERE BOCK 33cl/i);
  assert.equal(pertes[0].qtePieces, 2, `quantité ${pertes[0].qtePieces}`);
  assert.equal(pertes[0].puPiece, 500, `prix pièce ${pertes[0].puPiece} (12 000 F / 24)`);
  assert.equal(pertes[0].valeur, 1000, `valeur ${pertes[0].valeur}`);
});

console.log(failures.length ? `\n${failures.length} point(s) en échec` : "\ntous les points passent");
process.exit(failures.length ? 1 : 0);
