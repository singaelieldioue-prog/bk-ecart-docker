// Sonde lecture seule — E-DERIVE : round-trip génération → réimport sur le même classeur.
// Variante A : E tel que généré (dérivé). Variante B : E remis à 0 (état avant correctif).
import * as XLSX from "xlsx";
import fs from "node:fs";

import { parseRatios, parseBaseArticle, parseCorrespondance, parseSuivisStock, buildArtListFromReferentiel } from "../src/utils/parsers.js";
import { buildModelesWb } from "../src/utils/excelExporter.js";

const readWb = (rel) => XLSX.read(fs.readFileSync(new URL(rel, import.meta.url)), { type: "buffer" });
const ratioWb = readWb("../../sample_data/RATIOS BURGER KING ABJ Q3 2026.xlsx");
const baseWb = readWb("../../sample_data/BASE ARTICLE SIA.xlsx");
const ratios = parseRatios(ratioWb);
const baseArt = parseBaseArticle(baseWb);
const corr = parseCorrespondance(ratioWb);
const built = buildArtListFromReferentiel(baseArt, corr, ratios.waLandedCost, ratios.waByCode, null);
const prixParCode = new Map(built.artList.map((a) => [String(a.code).trim(), a]));

const exempleWb = readWb("../public/exemple inventaire.xlsx");
const rows = XLSX.utils.sheet_to_json(exempleWb.Sheets["inventaire"], { header: 1, defval: null });
const referenceRows = rows
  .slice(6)
  .filter((row) => row[3] && row[14])
  .map((row) => ({
    nom: row[3],
    code: row[14],
    categorie: row[1] || "",
    conditionnement: typeof row[4] === "number" ? row[4] : 1,
    qteInner: typeof row[5] === "number" ? row[5] : 0,
    unite: row[10] || "",
  }));

// Lignes Pepsi/frites qui étaient annihilées (E vide, D > 1).
const cibles = referenceRows.filter((r) => /PEPSI|FRITES/.test(String(r.nom)) && !(r.qteInner > 0) && r.conditionnement > 1);
console.log("lignes cibles :", cibles.map((c) => c.nom + " (D=" + c.conditionnement + ")").join(" | "));

const articles = referenceRows.map((r) => {
  const p = prixParCode.get(String(r.code).trim());
  return { ...r, fournisseur: "SIA", pu_carton: p ? p.puCarton : 0 };
});
const wb = buildModelesWb(articles, [], "BK1", "Octobre 2026", "", [], {});
const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

// Repère les lignes de l'inventaire final à partir du nom (colonne C, index 2).
const ligneDe = (book, nom) => {
  const ws = book.Sheets["Inventaire Final"];
  const g = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const i = g.findIndex((r, idx) => idx >= 6 && String(r[2]).trim() === String(nom).trim());
  return { ws, row: i + 1 }; // 1-based
};

const remplir = (book) => {
  cibles.forEach((c) => {
    const { ws, row } = ligneDe(book, c.nom);
    ws[`F${row}`] = { t: "n", v: 0 };   // Carton saisi
    ws[`G${row}`] = { t: "n", v: 11 };  // Inner saisi (le cas mesuré COCODY FRITES fin)
    ws[`H${row}`] = { t: "n", v: 0 };   // Unités saisies
  });
  return book;
};

const analyse = (etiquette, modifE) => {
  const book = remplir(XLSX.read(buffer, { type: "buffer" }));
  if (modifE !== undefined) {
    cibles.forEach((c) => {
      const { ws, row } = ligneDe(book, c.nom);
      ws[`E${row}`] = { t: "n", v: modifE };
    });
  }
  const parsed = parseSuivisStock(book, baseArt, ratios, {});
  const inv = parsed.invFin;
  // `inv` est indexé par norm(nom) : on retrouve la ligne par son libellé restitué.
  const trouver = (nom) => Object.values(inv).find((it) => String(it.nom).trim() === String(nom).trim()) || {};
  return cibles.map((c) => {
    const it = trouver(c.nom);
    return {
      nom: c.nom, D: c.conditionnement, E: modifE === undefined ? "généré" : modifE,
      nombre: it.nbCartons, inner: it.inner, qtePieces: it.qtePieces, puCarton: it.puCarton, valeur: it.valeur,
    };
  });
};

const apres = analyse("après", undefined);
const avant = analyse("avant", 0);
console.log("\n— après correctif (E dérivé) —");
apres.forEach((r) => console.log(JSON.stringify(r)));
console.log("\n— avant correctif (E = 0) —");
avant.forEach((r) => console.log(JSON.stringify(r)));
const qte = (list) => list.reduce((s, r) => s + (r.qtePieces || 0), 0);
const val = (list) => list.reduce((s, r) => s + (r.valeur || 0), 0);
console.log("\ntotal pièces : avant", qte(avant), "→ après", qte(apres));
console.log("total valeur : avant", Math.round(qte(avant) ? val(avant) : 0), "→ après", Math.round(val(apres)));
