// VÉRIF-SUIVI — radiographie en lecture seule du classeur généré.
// Produit tmp_verif/inventory.json (et un résumé console) : pour chaque feuille, géométrie
// réelle écrite (ref, volets, largeurs, en-têtes, formules, formats, lignes de données) et,
// au niveau ZIP, la présence du logo et des relations.
// Exécution : node tests/tmp_verif_suivi_dump.mjs
import fs from "node:fs";

import * as XLSX from "xlsx";
import JSZip from "jszip";

const V = new URL("../../tmp_verif/", import.meta.url);
const FICHIER = new URL("Suivi_BK1_Octobre_2026.xlsx", V);
const buf = fs.readFileSync(FICHIER);

const wb = XLSX.read(buf, { type: "buffer", cellFormula: true, cellNF: true, cellDates: true });
const zip = await JSZip.loadAsync(buf);

const nomFeuille = (n) => n.replace(/[^\w.-]/g, "_");
const inventory = { fichier: decodeURIComponent(FICHIER.pathname.replace(/^\/([A-Za-z]:)/, "$1")), taille: buf.length, feuilles: {}, zip: {} };

// ── niveau ZIP : dessin/logo par feuille ────────────────────────────────────────
const feuillesXml = {};
for (const chemin of Object.keys(zip.files)) {
  if (/^xl\/worksheets\/sheet\d+\.xml$/.test(chemin)) feuillesXml[chemin] = await zip.file(chemin).async("string");
}
const relsChemin = (chemin) => "xl/worksheets/_rels/" + chemin.split("/").pop() + ".rels";
const media = Object.keys(zip.files).filter((f) => /^xl\/media\//.test(f));
inventory.zip = {
  media: media.map((m) => ({ chemin: m, octets: zip.files[m]._data.uncompressedSize ?? null })),
  drawingsParFeuille: {},
  feuillesTrouvees: Object.keys(feuillesXml).length,
};
for (const [chemin, xml] of Object.entries(feuillesXml)) {
  const r = zip.files[relsChemin(chemin)];
  const rels = r ? await r.async("string") : "";
  inventory.zip.drawingsParFeuille[chemin] = {
    drawing: /drawing\d+\.xml/.test(rels),
    dimension: (xml.match(/<dimension ref="([^"]+)"/) || [])[1] || null,
    pane: (xml.match(/<pane\b[^>]*\/>/) || [])[0] || null,
    mergeCells: (xml.match(/<mergeCell ref="[^"]+"/g) || []).length,
    frozenCol: xml.includes("xSplit"),
    imageAnchres: ((xml.match(/<xdr:twoCellAnchor/g) || []).length),
  };
}

// ── niveau feuille ──────────────────────────────────────────────────────────────
wb.SheetNames.forEach((name) => {
  const ws = wb.Sheets[name];
  const ref = ws["!ref"] || "A1";
  const range = XLSX.utils.decode_range(ref);
  const lignesMax = Math.max(range.e.r, 30);
  const cells = [];
  for (let r = 0; r <= Math.min(lignesMax, 12); r++) {
    const ligne = [];
    for (let c = 0; c <= Math.min(range.e.c, 20); c++) {
      const ad = XLSX.utils.encode_cell({ r, c });
      const cell = ws[ad];
      ligne.push(cell ? { a: ad, t: cell.t, v: cell.v, f: cell.f || null, z: cell.z || null, s: cell.s ? "stylée" : null } : null);
    }
    cells.push(ligne);
  }
  // formules et formats par colonne, sur la 1re ligne de données (repérée par une formule en I ou L)
  const formules = {};
  for (let c = 0; c <= range.e.c; c++) {
    for (let r = 0; r <= Math.min(lignesMax, 40); r++) {
      const ad = XLSX.utils.encode_cell({ r, c });
      if (ws[ad] && ws[ad].f) { formules[XLSX.utils.encode_col(c)] = { ligne: r + 1, f: ws[ad].f, z: ws[ad].z || null }; break; }
    }
  }
  // comptage des lignes de données : ligne où la colonne C (ou D) est une chaîne non vide après l'en-tête
  const nbLignes = (() => {
    let n = 0, premier = null, dernier = null;
    for (let r = 0; r <= range.e.r; r++) {
      for (const c of [2, 3, 1]) {
        const ad = XLSX.utils.encode_cell({ r, c });
        const v = ws[ad] && ws[ad].v;
        if (typeof v === "string" && v.trim() && !/^(article|d[ée]signation|nom|produit|plu)$/i.test(v.trim())) {
          n++; premier = premier || r + 1; dernier = r + 1; break;
        }
      }
    }
    return { n, premier, dernier };
  })();
  inventory.feuilles[nomFeuille(name)] = {
    nom: name,
    ref,
    dimensions: { lignes: range.e.r + 1, colonnes: range.e.c + 1 },
    volets: (ws["!views"] && ws["!views"][0] && ws["!views"][0].pane) || null,
    largeursColonnesPx: (ws["!cols"] || []).map((c) => (c && c.wpx != null ? c.wpx : c ? { wch: c.wch } : null)),
    sautsDePage: (ws["!pageBreaks"] || null),
    entetes12Lignes: cells,
    formulesParColonne: formules,
    lignesRelevees: nbLignes,
  };
});

fs.writeFileSync(new URL("inventory.json", V), JSON.stringify(inventory, null, 1));
console.log("fichier :", inventory.fichier, "|", (inventory.taille / 1e6).toFixed(1), "Mo");
console.log("media   :", JSON.stringify(inventory.zip.media));
Object.values(inventory.feuilles).forEach((f) => {
  console.log("─".repeat(70));
  console.log(`${f.nom} · ref ${f.ref} · ${f.dimensions.colonnes} colonnes × ${f.dimensions.lignes} lignes · lignes de données ${f.lignesRelevees.n} (à partir de ${f.lignesRelevees.premier})`);
  console.log("  volets :", JSON.stringify(f.volets), "| largeurs :", (f.largeursColonnesPx || []).map((w) => (typeof w === "number" ? w : JSON.stringify(w))).join(","));
  console.log("  formules :", Object.entries(f.formulesParColonne).map(([c, x]) => `${c}${x.ligne}=${x.f}${x.z ? " [z:" + x.z + "]" : ""}`).join(" | ").slice(0, 400));
});
