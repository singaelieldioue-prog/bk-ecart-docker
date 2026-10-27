// RECAP-INVENTAIRE — le récapitulatif par catégorie des feuilles Inventaire, reproduit cellule
// pour cellule du bloc du CDG (exemple inventaire.xlsx, feuille inventaire, lignes 330-336) :
// 7 lignes (6 libellés + TOTAL, pas de ligne « AUTRES »), libellé centré en C (colonne ARTICLE),
// montant en D, sous-total « Nourriture » fusionné en E sur les 3 lignes, teintes du modèle,
// contour medium et séparations thin, TOTAL jaune, cellule de contrôle sans fond ni bordure.
// Exécution : node tests/recap-inventaire-categorie.mjs
// Sortie : une ligne PASS/FAIL par point, code de sortie 1 si une régression subsiste.
import * as XLSX from "xlsx";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildModelesWb } from "../src/utils/excelExporter.js";
import { parseSuivisStock } from "../src/utils/parsers.js";

const results = [];
const check = async (name, fn) => {
  try {
    const note = await fn();
    results.push("PASS " + name + (typeof note === "string" ? note : ""));
  } catch (e) {
    results.push("FAIL " + name + " — " + (e && e.message ? e.message : e));
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const addr = (c, r) => XLSX.utils.encode_cell({ r: r - 1, c }); // r = numéro de ligne Excel

// 15 articles réels du référentiel, tous présents dans CUSTOM_ARTICLES_ORDER (sinon l'exporter
// les filtre et la feuille serait vide). Les 2 « Nourriture » sans suffixe et l'« IFB » sont
// hors des 6 libellés du CDG : c'est ce qui doit ressortir dans la cellule de contrôle.
const ARTICLES = [
  { nom: "BIERE BEAUFORT 33cl", code: "BKCI-BIERE 33CL", categorie: "Boissons", unite: "Carton", conditionnement: 24, pu_carton: 7950 },
  { nom: "BOUTEILLE ORANGINA 50cL", code: "BTL-ORANGINA 50CL", categorie: "Boissons", unite: "Carton", conditionnement: 6, pu_carton: 2034 },
  { nom: "4,5' Bun - Delico", code: "BKFR28-DF", categorie: "Nourriture - Surgelé", unite: "Carton", conditionnement: 72, pu_carton: 14028 },
  { nom: "4' Bun - Delico", code: "BKFR25-DF", categorie: "Nourriture - Surgelé", unite: "Carton", conditionnement: 120, pu_carton: 16396 },
  { nom: "CONCOMBRE", code: "CONCOM", categorie: "Nourriture - Frais", unite: "Pièce", conditionnement: 1, pu_carton: 13 },
  { nom: "FROMAGE TRANCHE", code: "69740", categorie: "Nourriture - Frais", unite: "Carton", conditionnement: 1056, pu_carton: 65659 },
  { nom: "BARBECUE SACHET 10 ML SIPRO", code: "SIPROBBQ", categorie: "Nourriture - Sec", unite: "Carton", conditionnement: 1, pu_carton: 4026 },
  { nom: "CONE GLACE - Frosty Boy", code: "ASC224", categorie: "Nourriture - Sec", unite: "Carton", conditionnement: 224, pu_carton: 6496 },
  { nom: "BOL A SALADE NEW 200", code: "BSN200", categorie: "Packaging", unite: "Carton", conditionnement: 200, pu_carton: 26971 },
  { nom: "COFFRET A FRITE", code: "CAF", categorie: "Packaging", unite: "Carton", conditionnement: 1000, pu_carton: 50000 },
  { nom: "ACTIGEL", code: "1000147", categorie: "Produits de Nettoyage", unite: "Carton", conditionnement: 1, pu_carton: 16213 },
  { nom: "AMH FOAM", code: "1000803", categorie: "Produits de Nettoyage", unite: "Carton", conditionnement: 1, pu_carton: 57477 },
  { nom: "CHILI CHEESE BITES CONWAY", code: "BKFR22CNW", categorie: "Nourriture", unite: "Carton", conditionnement: 452, pu_carton: 20329 },
  { nom: "CONE GLACE 100", code: "CG-MEHDI002", categorie: "Nourriture", unite: "Carton", conditionnement: 250, pu_carton: 26753 },
  { nom: "AUTOCOLLANT LIVRAISON IMPRISUD BIS", code: "IFAABIS", categorie: "IFB", unite: "Carton", conditionnement: 1, pu_carton: 33432 },
];

const LIBELLES = [
  "Boissons",
  "Nourriture - Surgelé",
  "Nourriture - Frais",
  "Nourriture - Sec",
  "Packaging",
  "Produits de Nettoyage",
];
// Teintes lues dans le XML du modèle du CDG (fills 9, 11, 24, 19, 25 des lignes 330-336).
const FONDS = {
  "Boissons": "F7CAAC",
  "Nourriture - Surgelé": "BED7EE",
  "Nourriture - Frais": "BED7EE",
  "Nourriture - Sec": "BED7EE",
  "Packaging": "FFD1D1",
  "Produits de Nettoyage": "E2EFD9",
  "TOTAL": "FFFF00",
};
const C = 2, D = 3, E = 4; // colonnes du bloc : libellé, montant, sous-total / contrôle

const wb = buildModelesWb(ARTICLES, [], "BK1", "Octobre 2026", "", [], {});

// Le bloc est repéré par son premier libellé, lu dans la colonne C sous la ligne de total.
const localiser = (ws) => {
  const lastData = 6 + ARTICLES.length;      // données de la ligne 7 à la ligne 6 + n
  const totalRow = lastData + 1;             // « TOTAL STOCK » en B
  const start = totalRow + 2;                // une ligne vide de tampon
  const cell = ws[addr(C, start)];
  if (!cell || cell.v !== LIBELLES[0]) {
    const vu = [];
    for (let r = totalRow; r <= start + 8; r++) if (ws[addr(C, r)]) vu.push(`C${r}=${JSON.stringify(ws[addr(C, r)].v)}`);
    throw new Error(`bloc attendu en C${start} (« ${LIBELLES[0]} ») — lu : ${vu.join(" ") || "rien"}`);
  }
  return { lastData, totalRow, start, fin: start + 6 }; // 6 libellés + TOTAL
};

const wsIni = wb.Sheets["Inventaire Initial"];
const wsFin = wb.Sheets["Inventaire Final"];
const { lastData, totalRow, start, fin } = localiser(wsIni);

await check("Le tableau compte bien les 15 articles du jeu", () => {
  let n = 0;
  for (let r = 7; r <= lastData; r++) {
    const c = wsIni[addr(C, r)];
    if (c && typeof c.v === "string" && c.v.trim()) n++;
  }
  assert(n === ARTICLES.length, `${n} lignes d'articles lues sur ${ARTICLES.length}`);
});

await check("7 lignes comme la capture : les 6 libellés du CDG puis TOTAL, sans ligne « AUTRES »", () => {
  const attendu = [...LIBELLES, "TOTAL"];
  const lu = attendu.map((_, i) => wsIni[addr(C, start + i)]?.v);
  assert(JSON.stringify(lu) === JSON.stringify(attendu), `lu en C : ${JSON.stringify(lu)}`);
  assert(fin - start === 6, `le bloc fait ${fin - start + 1} lignes, attendu 7`);
  // Le bloc tient en C/D/E : rien ne déborde en F.
  for (let r = start; r <= fin; r++) {
    assert(!wsIni[addr(5, r)], `cellule écrite en F${r}, le bloc doit tenir en C/D/E`);
  }
});

await check("D = SUMIF par catégorie sur la colonne A et les valeurs L du tableau", () => {
  LIBELLES.forEach((lib, i) => {
    const r = start + i;
    const c = wsIni[addr(D, r)];
    const attendu = `SUMIF($A$7:$A$${lastData},C${r},$L$7:$L$${lastData})`;
    assert(c && c.f === attendu, `${lib} → D${r} = ${c ? c.f : "absente"}, attendu ${attendu}`);
  });
});

await check("Sous-total « Nourriture » fusionné en E sur les 3 lignes", () => {
  const c = wsIni[addr(E, start + 1)];
  assert(c && c.f === `SUM(D${start + 1}:D${start + 3})`, `E${start + 1} = ${c ? c.f : "absente"}`);
  const merges = wsIni["!merges"] || [];
  const m = merges.find((x) => x.s.c === E && x.s.r === start); // 0-based : ligne Excel start+1
  assert(m && m.e.r === start + 2, `fusion E${start + 1}:E${start + 3} absente — ${JSON.stringify(m || null)}`);
  assert(!wsIni[addr(E, start + 2)]?.f && !wsIni[addr(E, start + 3)]?.f, "formule recopiée hors de la fusion");
});

// Excel ne dessine une bordure que là où la cellule la porte : sans style sur les cellules
// basse de la fusion, le bloc « Nourriture » apparaît ouvert en bas et à droite.
await check("La fusion « Nourriture » est bordée sur ses 3 cellules", () => {
  for (let r = start + 1; r <= start + 3; r++) {
    const c = wsIni[addr(E, r)];
    const b = c?.s?.border;
    assert(b, `E${r} sans style de bordure (${c ? "cellule présente" : "cellule absente"}) — la fusion n'aurait pas de cadre`);
    // Comme b40/b41/b42 du modèle : medium à gauche et à droite sur les 3 lignes, haut sur la
    // première seulement, bas sur la dernière seulement — c'est ce qui ferme le cadre.
    const attendu = r === start + 1 ? ["left", "right", "top"] : r === start + 3 ? ["left", "right", "bottom"] : ["left", "right"];
    for (const edge of attendu) {
      assert(b[edge]?.style === "medium", `E${r} : bordure ${edge} = ${b[edge]?.style}, attendu medium`);
    }
    assert(c.s.fill?.fgColor?.rgb === FONDS["Nourriture - Surgelé"], `E${r} fond = ${c.s.fill?.fgColor?.rgb}`);
  }
});

await check("TOTAL = somme des 6 libellés, comme E336 du modèle", () => {
  const c = wsIni[addr(D, fin)];
  assert(c && c.f === `SUM(D${start}:D${start + 5})`, `D${fin} = ${c ? c.f : "absente"}`);
});

await check("Cellule de contrôle E = TOTAL STOCK − TOTAL récap, hors cadre comme dans le modèle", () => {
  const c = wsIni[addr(E, fin)];
  assert(c && c.f === `L${totalRow}-D${fin}`, `E${fin} = ${c ? c.f : "absente"}`);
  assert(!c.s?.fill && !c.s?.border, `E${fin} porte un fond ou une bordure : ${JSON.stringify(Object.keys(c.s || {}))}`);
});

await check("Montant nul affiché « - » (masque comptable, comme la capture)", () => {
  for (let r = start; r <= fin; r++) {
    const c = wsIni[addr(D, r)];
    assert(c?.z && c.z.includes('"-"'), `D${r} sans masque à tiret : z=${c?.z}`);
  }
  const box = wsIni[addr(E, start + 1)];
  assert(box?.z && box.z.includes('"-"'), `E${start + 1} sans masque à tiret : z=${box?.z}`);
});

await check("Libellé centré sur une ligne, en gras 12 pt, comme le modèle", () => {
  for (let r = start; r <= fin; r++) {
    const c = wsIni[addr(C, r)];
    assert(c?.s?.alignment?.horizontal === "center", `C${r} horizontal = ${c?.s?.alignment?.horizontal}`);
    assert(!c?.s?.alignment?.wrapText, `C${r} renvoyé à la ligne : le libellé doit tenir sur une ligne`);
    assert(c?.s?.font?.bold === true && c?.s?.font?.sz === 12, `C${r} police = ${c?.s?.font?.sz}pt gras=${c?.s?.font?.bold}`);
  }
});

await check("Fond de chaque ligne du bloc = teinte du CDG pour la catégorie", () => {
  const lu = [...LIBELLES, "TOTAL"].map((lib, i) => [lib, wsIni[addr(C, start + i)]?.s?.fill?.fgColor?.rgb]);
  const faux = lu.filter(([lib, rgb]) => rgb !== FONDS[lib]);
  assert(faux.length === 0, `teintes divergentes : ${faux.map(([l, r]) => `${l}=${r}`).join(" ")}`);
});

// Le contour du bloc est en medium, les séparations internes en thin (bordures 8/11/25/30/43/44
// du modèle). Le cadre de la fusion est medium sur ses 4 côtés.
await check("Contour du bloc en medium, séparations internes en thin", () => {
  const h = (c) => c?.s?.border;
  assert(h(wsIni[addr(C, start)])?.left?.style === "medium", `C${start} gauche = ${h(wsIni[addr(C, start)])?.left?.style}`);
  assert(h(wsIni[addr(D, start)])?.right?.style === "medium", `D${start} droite = ${h(wsIni[addr(D, start)])?.right?.style}`);
  assert(h(wsIni[addr(C, start)])?.top?.style === "medium", `C${start} haut = ${h(wsIni[addr(C, start)])?.top?.style}`);
  assert(h(wsIni[addr(C, fin)])?.bottom?.style === "medium", `C${fin} bas = ${h(wsIni[addr(C, fin)])?.bottom?.style}`);
  assert(h(wsIni[addr(C, start + 1)])?.top?.style === "thin", `C${start + 1} haut = ${h(wsIni[addr(C, start + 1)])?.top?.style}`);
  assert(h(wsIni[addr(C, start + 1)])?.right?.style === "thin", `C${start + 1} droite = ${h(wsIni[addr(C, start + 1)])?.right?.style}`);
});

await check("Le même bloc figure sur Inventaire Final", () => {
  const b = localiser(wsFin);
  assert(b.start === start, `bloc Final en C${b.start}, attendu C${start}`);
  assert(wsFin[addr(D, b.start)]?.f === `SUMIF($A$7:$A$${b.lastData},C${b.start},$L$7:$L$${b.lastData})`, `D${b.start} sur Final = ${wsFin[addr(D, b.start)]?.f}`);
  assert(wsFin[addr(C, b.fin)]?.v === "TOTAL", `dernière ligne Final = ${wsFin[addr(C, b.fin)]?.v}`);
});

// Le bloc est écrit SOUS le tableau : le relire ne doit jamais inventer un article « Boissons »,
// alors même que ses libellés tombent dans la colonne de désignation (C).
// Écriture avec xlsx-js-style, le sérialiseur de l'application (BaseArticlesTab.jsx:161) :
// « xlsx » standard écrit les formules mais jette les styles.
const XLSXStyle = (await import("xlsx-js-style")).default;
const buffer = XLSXStyle.write(wb, { type: "buffer", bookType: "xlsx" });
const sortie = path.join(os.tmpdir(), `recap_inventaire_${process.pid}.xlsx`);
fs.writeFileSync(sortie, buffer);
const wbRelu = XLSXStyle.read(fs.readFileSync(sortie), { cellNF: true, cellStyles: true });

await check("Écrit sur disque : formules, masque et fusion survivent à l'écriture", () => {
  const ws = wbRelu.Sheets["Inventaire Initial"];
  const e = ws[addr(D, start)];
  assert(e?.f === `SUMIF($A$7:$A$${lastData},C${start},$L$7:$L$${lastData})`, `D${start} relu = ${e?.f}`);
  assert(e?.z && e.z.includes('"-"'), `masque perdu à l'écriture : z=${e?.z}`);
  const m = (ws["!merges"] || []).find((x) => x.s.c === E && x.s.r === start);
  assert(m && m.e.r === start + 2, "fusion E perdue à l'écriture");
});

// Le style ne se contrôle pas dans le lecteur (xlsx-js-style n'écrit que ce qu'il lit) :
// c'est le XML du classeur qui fait foi, puisque c'est lui qu'Excel ouvre.
// Découpage par élément complet : un `<xf/>` ou un `<border/>` auto-fermé n'a pas de balise
// fermante, découper sur « </xf> » décalerait tous les indices et ferait lire un mauvais style.
const elements = (xml, balise) =>
  [...xml.matchAll(new RegExp(`<${balise}\\b[^>]*?(?:/>|>[\\s\\S]*?<\\/${balise}>)`, "g"))].map((m) => m[0]);
const bloc = (xml, balise) => new RegExp(`<${balise}\\b[^>]*>([\\s\\S]*?)</${balise}>`).exec(xml)[1];

const JSZip = (await import("jszip")).default;
const zip = await JSZip.loadAsync(buffer);
const wbXml = await zip.file("xl/workbook.xml").async("string");
const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
const feuille = /<sheet[^>]*name="Inventaire Initial"[^>]*r:id="(rId\d+)"/.exec(wbXml);
const cible = new RegExp(`Id="${feuille[1]}"[^>]*Target="([^"]+)"`).exec(rels)[1];
const sheetXml = await zip.file("xl/" + cible.replace(/^\.?\//, "")).async("string");
const stylesXml = await zip.file("xl/styles.xml").async("string");
const borders = elements(bloc(stylesXml, "borders"), "border");
const fills = elements(bloc(stylesXml, "fills"), "fill");
const xfs = elements(bloc(stylesXml, "cellXfs"), "xf");
const styleDe = (ref) => {
  const cellule = new RegExp(`<c r="${ref}"[^>]*?(?:/>|>)`).exec(sheetXml);
  assert(cellule, `aucune cellule ${ref} écrite dans le XML`);
  const s = Number(/ s="(\d+)"/.exec(cellule[0])?.[1]);
  assert(!Number.isNaN(s), `${ref} écrite sans index de style`);
  const xf = xfs[s] || "";
  const borderId = Number(/borderId="(\d+)"/.exec(xf)?.[1] ?? -1);
  const fillId = Number(/fillId="(\d+)"/.exec(xf)?.[1] ?? 0);
  return { s, xf, border: borders[borderId] || "", fill: fills[fillId] || "" };
};
const trait = (b, edge) => new RegExp(`<${edge}\\b[^>]*style="(\\w+)"`).exec(b)?.[1];

await check("Écrit sur disque : la fusion « Nourriture » est cerclée en medium dans le XML", () => {
  const cadre = [];
  for (let r = start + 1; r <= start + 3; r++) {
    const { s, xf, border } = styleDe(`E${r}`);
    assert(/borderId="\d+"/.test(xf), `E${r} → xf ${s} sans borderId : ${xf}`);
    const attendu = r === start + 1 ? ["left", "right", "top"] : r === start + 3 ? ["left", "right", "bottom"] : ["left", "right"];
    const manquantes = attendu.filter((edge) => !/medium/.test(trait(border, edge) || ""));
    assert(manquantes.length === 0, `E${r} → xf ${s} : ${(manquantes.join("/") || "aucune")} sans trait medium — ${border}`);
    cadre.push(`E${r} ${attendu.map((e) => `${e[0]}=${trait(border, e)}`).join(" ")}`);
  }
  return ` (${cadre.join(" | ")})`;
});

await check("Écrit sur disque : contour medium et teintes du CDG dans le XML", () => {
  const { border: hb, fill: hf, s: hs } = styleDe(`C${start}`);
  assert(trait(hb, "left") === "medium" && trait(hb, "top") === "medium", `C${start} contour = ${trait(hb, "left")}/${trait(hb, "top")} (xf ${hs})`);
  const { border: bb } = styleDe(`D${fin}`);
  assert(trait(bb, "right") === "medium" && trait(bb, "bottom") === "medium", `D${fin} contour = ${trait(bb, "right")}/${trait(bb, "bottom")}`);
  const teintes = [...LIBELLES, "TOTAL"].map((lib, i) => [lib, /rgb="FF([0-9A-F]{6})"/.exec(styleDe(`C${start + i}`).fill)?.[1]]);
  const fausses = teintes.filter(([lib, rgb]) => rgb !== FONDS[lib]);
  assert(fausses.length === 0, `teintes XML : ${fausses.map(([l, r]) => `${l}=${r}`).join(" ")}`);
  return ` (${teintes.map(([, r]) => r).join(" ")})`;
});

await check("Écrit sur disque : libellé sur une ligne, hauteur de bloc 16,5 pt", () => {
  for (let r = start; r <= fin; r++) {
    const { s, xf } = styleDe(`C${r}`);
    assert(!/wrapText="(1|true)"/.test(xf), `C${r} → xf ${s} porte wrapText : ${xf}`);
    const ligne = new RegExp(`<row r="${r}"[^>]*>`).exec(sheetXml);
    assert(/ht="16\.5" customHeight="1"/.test(ligne?.[0] || ""), `ligne ${r} sans hauteur 16,5 pt : ${ligne?.[0] || "absente"}`);
  }
  const ligne7 = new RegExp(`<row r="7"[^>]*>`).exec(sheetXml)?.[0] || "absente";
  assert(!/customHeight/.test(ligne7), `ligne 7 du tableau a reçu une hauteur : ${ligne7}`);
  return ` (C${start}→C${fin} ht=16.5, ${ligne7})`;
});

await check("Réimport : aucune ligne du récap avalée comme un article", () => {
  // Le point contrôlé est la lecture des lignes, pas la valorisation : ratios vide mais sous
  // forme du objet que resoudrePrix attend (waLandedCost/pmpByIng), sinon il lève sur le 1er nom.
  const { invFin } = parseSuivisStock(wbRelu, {}, { waLandedCost: {}, waByCode: {}, pmpByIng: {} }, {});
  const noms = Object.values(invFin || {}).map((i) => String(i.nom).trim());
  const fantomes = [...LIBELLES, "TOTAL"].filter((l) => noms.includes(l));
  assert(fantomes.length === 0, `fantômes importés : ${fantomes.join(", ")} — la ligne de total ne clôt pas le tableau lu`);
  assert(noms.length === ARTICLES.length, `${noms.length} articles importés sur ${ARTICLES.length}`);
});

console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} vérifications vertes`);
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
