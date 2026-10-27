// SUITE DURABLE — Chaîne de prix PEPSI : base vivante → classeur Suivi Stock → saisie → réimport
// dans les conditions de production (ratios + base article + base locale de la base) → calcul.
// Objet : prouver que le prix de chaque ligne Pepsi arrive jusqu'à la valorisation de l'écart,
// et MESURER (sans les trancher) les divergences entre feuilles.
// Lecture seule de backend/data.db ; aucun fichier existant modifié.
// Exécution : node tests/prix-pepsi-chaine.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import XLSX from "xlsx-js-style";

import { buildModelesWb } from "../src/utils/excelExporter.js";
import { enrichirAvecBaseLocale, parseSuivisStock } from "../src/utils/parsers.js";
import { calculer } from "../src/utils/calculators.js";
import { norm } from "../src/utils/formatters.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};
const TOL_PRIX = 0.01;   // arrondi FCFA
const TOL_PIECE = 0.000001;

const normaliser = (v) =>
  String(v || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");

// ── 1. Base vivante (lecture seule) ─────────────────────────────────────────
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (cle) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(cle); return r ? JSON.parse(r.v) : null; };

const pepsi = db.prepare(
  "SELECT ref, nom, code, conditionnement, pu_carton, pu_piece, unite, actif, source FROM articles WHERE UPPER(nom) LIKE '%PEPSI%' ORDER BY nom"
).all();
const articlesBdd = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles WHERE actif = 1").all();
const ratios = charge("bk_sia_ratios_parsed_v1");
const baseArticle = charge("bk_sia_base_article_map_v1") || {};
const localArticles = charge("bk_sia_local_articles_v1") || {};
const pmixComplement = charge("bk_sia_pmix_complement_v1") || {};
const codesRestos = db.prepare("SELECT code FROM restaurants WHERE actif = 1").all().map((r) => r.code);
const produits = (ratios || {}).allProducts || [];

console.log("=== A. BASE — lignes PEPSI ===");
console.table(pepsi.map((p) => ({ ref: p.ref, nom: p.nom, code: p.code, cond: p.conditionnement, carton: p.pu_carton, piece: p.pu_piece, actif: p.actif })));

check(pepsi.length === 5, `5 lignes PEPSI en base (lu ${pepsi.length})`);
check(pepsi.every((p) => p.actif === 1), "toutes actives");
check(pepsi.every((p) => Number(p.pu_carton) > 0 && Number(p.pu_piece) > 0), "toutes cotées (carton > 0 et pièce > 0)",
  pepsi.filter((p) => !(p.pu_carton > 0 && p.pu_piece > 0)).map((p) => p.nom).join(" ; "));
{
  const ecarts = pepsi.map((p) => ({ nom: p.nom, ecart: Number(p.pu_piece) * Number(p.conditionnement) - Number(p.pu_carton) }));
  check(ecarts.every((e) => Math.abs(e.ecart) <= TOL_PRIX), "prix pièce × cond. = prix carton (± 0,01 F)",
    ecarts.filter((e) => Math.abs(e.ecart) > TOL_PRIX).map((e) => `${e.nom} : ${e.ecart}`).join(" ; "));
}
{
  const codes = pepsi.map((p) => p.code);
  check(new Set(codes).size === codes.length, "aucun code Pepsi partagé par deux lignes");
}
const zero15 = pepsi.find((p) => normaliser(p.nom) === "BOUTEILLEPEPSIZERO15L");
check(!!zero15 && zero15.code === "BTL-PEPSI 1,5L" && zero15.conditionnement === 6 && zero15.pu_carton === 3150,
  "BOUTEILLE PEPSI ZERO 1,5L = code BTL-PEPSI 1,5L, cond. 6, 3 150 F (ligne montrée par le CDG)");

// ── 2. Génération du classeur (chaîne BaseArticlesTab) ──────────────────────
function ordonnerSelonExemple(articles) {
  const wbRef = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wbRef.Sheets.inventaire, { header: 1, defval: null });
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

const ordered = enrichirAvecBaseLocale(ordonnerSelonExemple(articlesBdd), localArticles);
const wb = buildModelesWb(ordered, produits, "BK1", "Octobre 2026", "", codesRestos, pmixComplement, articlesBdd);

// Relevé des prix publiés, par feuille, pour chaque code Pepsi.
const codesPepsi = new Set(pepsi.map((p) => String(p.code).trim()));
const scan = (nomFeuille, colTexte, colCode, colPrix) => {
  const ws = wb.Sheets[nomFeuille];
  if (!ws) return [];
  const rg = XLSX.utils.decode_range(ws["!ref"]);
  const out = [];
  for (let r = rg.s.r; r <= rg.e.r; r++) {
    const txt = ws[XLSX.utils.encode_cell({ r, c: colTexte })]?.v;
    const code = colCode == null ? null : ws[XLSX.utils.encode_cell({ r, c: colCode })]?.v;
    const prix = ws[XLSX.utils.encode_cell({ r, c: colPrix })]?.v;
    if (!/PEPSI/i.test(String(txt ?? ""))) continue;
    out.push({ ligne: r + 1, texte: String(txt).trim(), code: code == null ? "" : String(code).trim(), prix: Number(prix) || 0 });
  }
  return out;
};
const invLignes = scan("Inventaire Initial", 2, 13, 10);      // C désignation, N code, K prix carton
const refLignes = scan("Référentiel Articles", 1, 0, 5);      // B désignation, A clé, F prix carton
const pertesLignes = scan("Pertes", 1, null, 3);              // B nom, D prix carton (pas de code)

console.log("\n=== B. CLASSEUR GÉNÉRÉ — prix par feuille ===");
console.log("Inventaire Initial :", invLignes.map((l) => `L${l.ligne} ${l.texte}=${l.prix}`).join(" | "));
console.log("Référentiel Articles :", refLignes.map((l) => `L${l.ligne} clé «${l.code}» / ${l.texte}=${l.prix}`).join(" | "));
console.log("Pertes :", pertesLignes.map((l) => `L${l.ligne} ${l.texte}=${l.prix}`).join(" | "));

check(invLignes.length > 0 && invLignes.every((l) => l.prix > 0), "Inventaire : chaque ligne PEPSI publiée est cotée",
  invLignes.filter((l) => !(l.prix > 0)).map((l) => `L${l.ligne} ${l.texte}`).join(" ; "));
check(refLignes.every((l) => l.prix > 0), "Référentiel Articles : chaque ligne PEPSI est cotée",
  refLignes.filter((l) => !(l.prix > 0)).map((l) => `L${l.ligne} ${l.texte}`).join(" ; "));
check(pertesLignes.every((l) => l.prix > 0), "Pertes : chaque ligne PEPSI est cotée",
  pertesLignes.filter((l) => !(l.prix > 0)).map((l) => `L${l.ligne} ${l.texte}`).join(" ; "));

// Chaque code de la base doit trouver un prix dans le référentiel (clé du VLOOKUP de Transferts).
const refParCode = new Map(refLignes.map((l) => [normaliser(l.code), l.prix]));
const codesSansPrix = [...codesPepsi].filter((c) => !(refParCode.get(normaliser(c)) > 0));
check(codesSansPrix.length === 0, `les ${codesPepsi.size} codes Pepsi de la base sont valorisés dans le référentiel (VLOOKUP Transferts)`, codesSansPrix.join(" ; "));

// Mesures (aucune assertion : arbitrage CDG ouvert sur la source de prix)
const mesures = [];
for (const p of pepsi) {
  const inv = invLignes.find((l) => normaliser(l.code) === normaliser(p.code));
  const ref = refParCode.get(normaliser(p.code)) || 0;
  mesures.push({
    article: p.nom,
    base: Number(p.pu_carton),
    inventaire: inv ? inv.prix : null,
    referentiel: ref || null,
    ligneInventaire: inv ? `L${inv.ligne}` : "—",
    ecartInvBase: inv ? Number((inv.prix - p.pu_carton).toFixed(2)) : null,
    ecartRefBase: ref ? Number((ref - p.pu_carton).toFixed(2)) : null,
  });
}

// ── 3. Saisie + réimport dans les conditions de production ──────────────────
const QTE_INI = 10, QTE_FIN = 2;
const patch = (nomFeuille, qte) => {
  const ws = wb.Sheets[nomFeuille];
  const rg = XLSX.utils.decode_range(ws["!ref"]);
  const faits = [];
  for (let r = rg.s.r; r <= rg.e.r; r++) {
    const txt = ws[XLSX.utils.encode_cell({ r, c: 2 })]?.v;
    const code = ws[XLSX.utils.encode_cell({ r, c: 13 })]?.v;
    if (!/PEPSI/i.test(String(txt ?? ""))) continue;
    ws[XLSX.utils.encode_cell({ r, c: 5 })] = { t: "n", v: qte, z: "#,##0" };   // F = cartons
    faits.push({ ligne: r + 1, nom: String(txt).trim(), code: String(code ?? "").trim(),
      cond: Number(ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v) || 1 });
  }
  return faits;
};
const lignesIni = patch("Inventaire Initial", QTE_INI);
const lignesFin = patch("Inventaire Final", QTE_FIN);

const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
const relu = XLSX.read(buf, { type: "buffer" });
const stockData = parseSuivisStock(relu, baseArticle, ratios, localArticles);
const calc = calculer(stockData, [], ratios, baseArticle, pmixComplement);

console.log("\n=== C. RÉIMPORT PRODUCTION + CALCUL (ini 10 cartons, fin 2 cartons) ===");
const parNomEcart = new Map(calc.articlesEcart.map((a) => [normaliser(a.nom), a]));
const resultats = [];
for (const l of lignesIni) {
  const itemIni = stockData.invIni[norm(l.nom)];
  const itemFin = stockData.invFin[norm(l.nom)];
  const art = parNomEcart.get(normaliser(l.nom));
  resultats.push({
    nom: l.nom,
    ligne: `L${l.ligne}`,
    cond: l.cond,
    puPiece: itemIni ? itemIni.puPiece : null,
    source: itemIni ? itemIni.prixSource : null,
    iniPieces: art ? art.iniPieces : null,
    finPieces: art ? art.finPieces : null,
    ecartPieces: art ? art.ecartPieces : null,
    ecartVal: art ? art.ecartVal : null,
    attenduPieces: `${QTE_INI}×${l.cond} − ${QTE_FIN}×${l.cond}`,
  });
}
console.table(resultats);

check(resultats.every((r) => r.puPiece > 0), "réimport : prix pièce résolu pour chaque ligne PEPSI",
  resultats.filter((r) => !(r.puPiece > 0)).map((r) => r.nom).join(" ; "));
check(resultats.every((r) => r.iniPieces === QTE_INI * r.cond && r.finPieces === QTE_FIN * r.cond),
  "réimport : quantités relues = cartons saisis × colisage",
  resultats.filter((r) => !(r.iniPieces === QTE_INI * r.cond && r.finPieces === QTE_FIN * r.cond))
    .map((r) => `${r.nom} : ini ${r.iniPieces}, fin ${r.finPieces}`).join(" ; "));
check(resultats.every((r) => r.ecartPieces === r.iniPieces - r.finPieces),
  "calcul : écart en pièces = stock initial − stock final (ni transfert ni perte)");
check(resultats.every((r) => Math.abs(r.ecartVal - r.ecartPieces * r.puPiece) <= TOL_PRIX * Math.max(1, r.ecartPieces)),
  "calcul : écart valorisé = pièces × prix pièce résolu",
  resultats.filter((r) => !(Math.abs(r.ecartVal - r.ecartPieces * r.puPiece) <= TOL_PRIX * Math.max(1, r.ecartPieces)))
    .map((r) => `${r.nom} : ${r.ecartVal} ≠ ${r.ecartPieces * r.puPiece}`).join(" ; "));
{
  const varStock = calc.variationStock;
  check(Math.abs(calc.consoReelle - varStock) <= TOL_PRIX, "calcul : conso réelle = variation de stock (aucun transfert saisi)",
    `consoReelle ${calc.consoReelle} vs variation ${varStock}`);
}

// Mesures : prix pièce effectif au réimport vs prix pièce de la fiche du classeur.
const mesuresPiece = pepsi.map((p) => {
  const fig = invLignes.find((l) => normaliser(l.code) === normaliser(p.code));
  const ligne = resultats.find((r) => normaliser(r.nom) === normaliser(fig ? fig.texte : p.nom));
  const pieceFichier = fig ? fig.prix / (ligne ? ligne.cond : p.conditionnement) : null;
  return {
    article: p.nom,
    pieceBase: Number(p.pu_piece.toFixed(4)),
    pieceFichier: pieceFichier == null ? null : Number(pieceFichier.toFixed(4)),
    pieceReimport: ligne ? Number(ligne.puPiece.toFixed(4)) : null,
    sourceReimport: ligne ? ligne.source : null,
    ecartFichierReimport: ligne && pieceFichier != null ? Number((ligne.puPiece - pieceFichier).toFixed(4)) : null,
  };
});

// ── 4. Transferts : un carton par code Pepsi, valorisé comme dans Excel ────
// Le classeur valorise I = Quantité × Prix carton (VLOOKUP sur le référentiel) ; au réimport
// (mêmes ratios/base article/base locale que la production), parsers.js refait ce prix par le code.
const wbT = buildModelesWb(ordered, produits, "BK1", "Octobre 2026", "", codesRestos, pmixComplement, articlesBdd);
{
  const wsT = wbT.Sheets["Transferts"];
  // Le modèle écrit C/D/F/I en formules sans valeur en cache ; SheetJS ne les relit pas.
  // On saisit donc la désignation comme le ferait Excel après recalcul, sinon le parseur
  // écarte la ligne (il exige une désignation en C).
  const nomParCode = new Map(ordered.map((a) => [normaliser(a.code), a.nom]));
  let r = 4;                    // ligne Excel 5 = première ligne de saisie
  for (const p of pepsi) {
    wsT[XLSX.utils.encode_cell({ r, c: 0 })] = { t: "s", v: "01/10/2026" };   // A date
    wsT[XLSX.utils.encode_cell({ r, c: 1 })] = { t: "s", v: "BK1" };          // B destinataire
    wsT[XLSX.utils.encode_cell({ r, c: 2 })] = { t: "s", v: nomParCode.get(normaliser(p.code)) || p.nom }; // C
    wsT[XLSX.utils.encode_cell({ r, c: 3 })] = { t: "s", v: "Boissons" };     // D catégorie
    wsT[XLSX.utils.encode_cell({ r, c: 4 })] = { t: "s", v: String(p.code).trim() }; // E clé
    wsT[XLSX.utils.encode_cell({ r, c: 5 })] = { t: "s", v: "Pack" };         // F unité
    wsT[XLSX.utils.encode_cell({ r, c: 6 })] = { t: "n", v: p.conditionnement, z: "#,##0" }; // G cond.
    wsT[XLSX.utils.encode_cell({ r, c: 7 })] = { t: "n", v: 5, z: "#,##0" };  // H quantité (cartons)
    r++;
  }
}
const bufT = XLSX.write(wbT, { bookType: "xlsx", type: "buffer" });
const reluT = XLSX.read(bufT, { type: "buffer" });
const stockT = parseSuivisStock(reluT, baseArticle, ratios, localArticles);

console.log("\n=== E. TRANSFERTS (5 cartons par code) — prix retenu au réimport ===");
const transferts = stockT.sorties.map((s) => ({
  code: s.codeBollore,
  designation: s.designation,
  qte: s.qte,
  cond: s.qteCdt,
  puCarton: Number((s.puUnite || 0).toFixed(2)),
  valeur: Number((s.valeur || 0).toFixed(2)),
  source: s.prixSource,
}));
console.table(transferts);
check(transferts.length === pepsi.length, `une ligne de transfert par code Pepsi relue (${transferts.length}/${pepsi.length})`);
check(transferts.every((t) => t.puCarton > 0), "chaque transfert Pepsi est valorisé (prix carton > 0)",
  transferts.filter((t) => !(t.puCarton > 0)).map((t) => t.code).join(" ; "));
check(transferts.every((t) => Math.abs(t.valeur - t.qte * t.puCarton) <= TOL_PRIX * Math.max(1, t.qte)),
  "valeur de transfert = quantité × prix carton retenu");
{
  const parCode = new Map(refLignes.map((l) => [normaliser(l.code), l.prix]));
  const desaccord = transferts.filter((t) => Math.abs(t.puCarton - (parCode.get(normaliser(t.code)) || 0)) > TOL_PRIX);
  check(desaccord.length === 0, "prix du transfert = prix publié dans le Référentiel Articles (VLOOKUP cohérent)",
    desaccord.map((t) => `${t.code} : transfert ${t.puCarton} vs référentiel ${parCode.get(normaliser(t.code))}`).join(" ; "));
}
{
  // `totalEntrees` n'existe que sur le résultat du calcul (calculators.js:49) : c'est là
  // qu'on vérifie que les transferts parsés arrivent bien dans la valorisation des entrées.
  const calcT = calculer(stockT, [], ratios, baseArticle, pmixComplement);
  const sommeSorties = stockT.sorties.reduce((s, x) => s + x.valeur, 0);
  const sommeAttendue = transferts.reduce((s, t) => s + t.valeur, 0);
  check(Math.abs(calcT.totalEntrees - sommeSorties) <= TOL_PRIX && Math.abs(calcT.totalEntrees - sommeAttendue) <= TOL_PRIX,
    "total des entrées de stock = somme des valeurs de transferts",
    `totalEntrees ${calcT.totalEntrees} / sorties ${sommeSorties} / attendu ${sommeAttendue}`);
  const parNom = new Map(calcT.articlesEcart.map((a) => [normaliser(a.nom), a]));
  const malRepris = transferts.filter((t) => {
    const a = parNom.get(normaliser(t.designation));
    return !(a && Math.abs(a.entreesPieces - 5 * t.cond) <= TOL_PIECE);
  });
  check(malRepris.length === 0, "chaque transfert Pepsi est repris en entrées pièces (5 cartons × colisage)",
    malRepris.map((t) => `${t.designation} : ${parNom.get(normaliser(t.designation))?.entreesPieces ?? "absent"} ≠ ${5 * t.cond}`).join(" ; "));
}

// ── 5. Verdict ──────────────────────────────────────────────────────────────
console.log("\n=== D. MESURES (à trancher côté CDG, non assertées) ===");
console.table(mesures);
console.table(mesuresPiece);

console.log(`\n${ok} PASS / ${ko} FAIL`);
process.exitCode = ko === 0 ? 0 : 1;
