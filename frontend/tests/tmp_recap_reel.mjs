// Sonde lecture seule : régénère le classeur BK1 réel, relit le bloc récap des Inventaires
// et liste les lignes de catégorie hors des 6 libellés du CDG (à transmettre au réimport).
// Exécution : node tests/tmp_recap_reel.mjs   (sortie : tmp_recap_reel.txt)
import fs from "node:fs";
import XLSX from "xlsx-js-style";

import { buildModelesWb } from "../src/utils/excelExporter.js";
import { enrichirAvecBaseLocale } from "../src/utils/parsers.js";

const V = new URL("../../tmp_verif/", import.meta.url);
const lire = (f) => JSON.parse(fs.readFileSync(new URL(f, V), "utf-8"));
const normaliser = (v) =>
  String(v || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");

function ordonnerSelonExemple(articles) {
  const wb = XLSX.read(fs.readFileSync(new URL("../frontend/public/exemple inventaire.xlsx", V)), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.inventaire, { header: 1, defval: null });
  const ref = rows.slice(6).filter((r) => r[3] && r[14]).map((r) => ({
    name: r[3], code: r[14], categorie: r[1] || "",
    conditionnement: typeof r[4] === "number" ? r[4] : 1,
    qteInner: typeof r[5] === "number" ? r[5] : 0,
    unite: r[10] || "",
  }));
  const byCode = new Map(), byName = new Map();
  articles.forEach((a) => { if (a.code) byCode.set(normaliser(a.code), a); if (a.nom) byName.set(normaliser(a.nom), a); });
  return ref.map((reference) => {
    const source = byCode.get(normaliser(reference.code)) || byName.get(normaliser(reference.name));
    return { ...(source || {}), nom: reference.name, code: reference.code, categorie: reference.categorie,
      conditionnement: reference.conditionnement, qteInner: reference.qteInner, unite: reference.unite || source?.unite || "" };
  });
}

const LIBELLES = ["Boissons", "Nourriture - Surgelé", "Nourriture - Frais", "Nourriture - Sec", "Packaging", "Produits de Nettoyage"];
const ordered = enrichirAvecBaseLocale(ordonnerSelonExemple(lire("articles.json")), lire("local_articles.json"));
const wb = buildModelesWb(ordered, lire("produits.json"), "BK1", "Octobre 2026", "", lire("resto_codes.json"), lire("pmix_complement.json"));

// Écriture puis relecture réelle : c'est le fichier tel que le CDG l'ouvrira.
const sortie = new URL("tmp_recap_reel.xlsx", import.meta.url);
fs.writeFileSync(sortie, XLSX.write(wb, { bookType: "xlsx", type: "buffer" }));
const relu = XLSX.read(fs.readFileSync(sortie), { cellNF: true, cellStyles: true });
fs.unlinkSync(sortie);

for (const nom of ["Inventaire Initial", "Inventaire Final"]) {
  const ws = relu.Sheets[nom];
  // Le bloc est repéré depuis la ligne « TOTAL STOCK » et sa formule SUM(L7:L<n>) : c'est la
  // géométrie réellement écrite, pas celle que la sonde devinerait depuis le jeu d'articles.
  let totalRow = 0, lastData = 0;
  for (const key of Object.keys(ws)) {
    if (key[0] === "!") continue;
    const c = ws[key];
    if (c.v === "TOTAL STOCK") totalRow = XLSX.utils.decode_cell(key).r + 1;
    if (totalRow && key === XLSX.utils.encode_cell({ r: totalRow - 1, c: 11 })) {
      lastData = Number(/SUM\(L7:L(\d+)\)/.exec(c.f)?.[1] || 0);
    }
  }
  const start = totalRow + 2;
  console.log(`\n═══ ${nom} ═══ plage ${ws["!ref"]} | tableau L7:L${lastData} (${lastData - 6} lignes retenues sur ${ordered.length} candidate(s)) | TOTAL STOCK ligne ${totalRow}`);
  for (let r = start; r < start + 7; r++) {
    const cel = (c) => ws[XLSX.utils.encode_cell({ r: r - 1, c })];
    const lab = cel(2), mt = cel(3), st = cel(4);
    console.log(`ligne ${r} | C=${lab ? JSON.stringify(lab.v) : "-"} | D=${mt ? mt.f ?? mt.v : "-"} | E=${st ? st.f ?? JSON.stringify(st.v) : "-"} | z=${mt?.z ?? "-"} | gras=${lab?.s?.font?.bold ? "oui" : "non"}/${lab?.s?.font?.sz ?? "?"}pt | wrap=${lab?.s?.alignment?.wrapText ? "oui" : "non"}`);
  }
  console.log("fusion E :", JSON.stringify((ws["!merges"] || []).filter((m) => m.s.c === 4)));
}

// Les lignes que les 6 libellés ne rattrapent pas → reprises par « AUTRES CATÉGORIES ».
// Périmètre : les lignes RÉELLEMENT ÉCRITES au tableau (l'exporter filtre sur
// CUSTOM_ARTICLES_ORDER), lues dans la feuille relue, pas dans le jeu candidate.
const lignesFeuille = [];
{
  const ws = relu.Sheets["Inventaire Initial"];
  let totalRow = 0, lastData = 0;
  for (const key of Object.keys(ws)) {
    if (key[0] === "!") continue;
    const c = ws[key];
    if (c.v === "TOTAL STOCK") totalRow = XLSX.utils.decode_cell(key).r + 1;
    if (totalRow && key === XLSX.utils.encode_cell({ r: totalRow - 1, c: 11 }))
      lastData = Number(/SUM\(L7:L(\d+)\)/.exec(c.f)?.[1] || 0);
  }
  const cell = (r, c) => ws[XLSX.utils.encode_cell({ r: r - 1, c })];
  for (let r = 7; r <= lastData; r++) {
    lignesFeuille.push({
      ligne: r,
      categorie: cell(r, 0)?.v ?? "",
      nom: cell(r, 2)?.v ?? "",
      valeur: cell(r, 11)?.f ?? cell(r, 11)?.v ?? "",
      code: cell(r, 13)?.v ?? "",
    });
  }
}
console.log(`\ntotal lignes du tableau relu : ${lignesFeuille.length}`);
const hors = lignesFeuille.filter((a) => !LIBELLES.includes(String(a.categorie)));
const CIBLES = [
  [/^\s*nourriture\s*$/i, "Nourriture - Surgelé / Frais / Sec (à préciser)"],
  [/^NOURRITURE_SEC$/, "Nourriture - Sec"],
  [/^IFB$/, "Packaging"],
];
const cat = (c) => (CIBLES.find(([re]) => re.test(c)) || [null, "à classer par le CDG"])[1];
const compte = {};
hors.forEach((a) => { compte[a.categorie] = (compte[a.categorie] || 0) + 1; });
console.log(`\n═══ ${hors.length} lignes hors des 6 libellés ═══`);
Object.entries(compte).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`${c || "(vide)"} : ${n} ligne(s) → ${cat(c)}`));
hors.forEach((a) => console.log(`${a.code}\t${a.nom}\t${a.categorie || "(vide)"}\t→ ${cat(a.categorie)}`));

const distinct = {};
lignesFeuille.forEach((l) => { const k = JSON.stringify(l.categorie); distinct[k] = (distinct[k] || 0) + 1; });
console.log("\n═══ catégories écrites en colonne A ═══");
Object.entries(distinct).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`${c} : ${n}`));
