// REGEN-Q3 — JET D'ESSAI SANS ÉCRITURE.
// Recalcule `calc` des 2 rapports portant un ratiosMeta.label "Q2" avec le Ratio Q3
// actif en base (KV bk_sia_ratios_parsed_v1), en réutilisant le même chemin de calcul
// que l'application (App.jsx:541 : calculer(stockData, pmixList, ratios, baseArticle, pmixComplement)).
// Aucune écriture en base ici : ce script produit uniquement les chiffres avant/après.
// Exécution : node tests/tmp_regen_q3_dryrun.mjs
import fs from "node:fs";

import { calculer } from "../src/utils/calculators.js";

const R = new URL("../../tmp_regen/", import.meta.url);
const lire = (f) => JSON.parse(fs.readFileSync(new URL(f, R), "utf-8"));

const ratios = lire("bk_sia_ratios_parsed_v1.json");
const baseArticle = lire("bk_sia_base_article_map_v1.json");
const pmixComplement = lire("bk_sia_pmix_complement_v1.json");
const ratiosMemo = lire("bk_sia_ratios_v1.json");

const CIBLES = [
  ["110", 1186.6721, "Whopper"],
  ["706", 229.7356, "Small/Moyennes frites MN"],
  ["717", 411.0699, "Large fries"],
  ["400102", 124.035, "Pepsi Medium"],
];

const RAPPORTS = ["60198f93", "76b8d757"];
const somme = (arr, k) => arr.reduce((s, a) => s + (Number(a[k]) || 0), 0);

RAPPORTS.forEach((rid) => {
  const data = lire(`report_${rid}.json`);
  const avant = data.calc;
  const apres = calculer(data.stockData, data.pmixList, ratios, baseArticle, pmixComplement);

  const theoAvant = new Map(avant.pmixTheo.map((p) => [String(p.plu), p]));
  const theoApres = new Map(apres.pmixTheo.map((p) => [String(p.plu), p]));

  const diffs = [];
  theoApres.forEach((a, plu) => {
    const b = theoAvant.get(plu);
    if (!b) return diffs.push({ plu, nom: a.nom, qty: a.qty, avant: null, apres: a.coutUnit, source_avant: null, source_apres: a.source });
    if (Math.abs((b.coutUnit || 0) - (a.coutUnit || 0)) > 1e-9 || b.source !== a.source)
      diffs.push({ plu, nom: a.nom, qty: a.qty, avant: b.coutUnit, apres: a.coutUnit, source_avant: b.source, source_apres: a.source });
  });
  theoAvant.forEach((b, plu) => {
    if (!theoApres.has(plu)) diffs.push({ plu, nom: b.nom, qty: b.qty, avant: b.coutUnit, apres: null, source_avant: b.source, source_apres: null });
  });

  const lignes = {
    rapport: rid,
    site: data.site,
    label_avant: data.ratiosMeta?.label,
    label_apres: `${ratiosMemo.label} · Chargés le ${ratiosMemo.date}`,
    nb_ingredients_avant: data.ratiosMeta?.nbIngredients,
    nb_ingredients_apres: Object.keys(ratios.pmpByIng).length,
    nb_plu_avant: data.ratiosMeta?.nbProduits,
    nb_plu_apres: ratios.allProducts.length,
    couverts_avant: avant.couverts,
    couverts_apres: apres.couverts,
    consoTheo_avant: avant.consoTheoTotal,
    consoTheo_apres: apres.consoTheoTotal,
    consoReelle_avant: avant.consoReelle,
    consoReelle_apres: apres.consoReelle,
    ecart_avant: avant.ecartMatiere,
    ecart_apres: apres.ecartMatiere,
    ecartP_avant: avant.ecartMatiereP,
    ecartP_apres: apres.ecartMatiereP,
    ficheMatchees_avant: avant.ficheMatchees,
    ficheMatchees_apres: apres.ficheMatchees,
    compMatchees_avant: avant.complementMatchees,
    compMatchees_apres: apres.complementMatchees,
    consoTheoComp_avant: avant.consoTheoComplement,
    consoTheoComp_apres: apres.consoTheoComplement,
    anomalies_avant: avant.pluNonMatchés.length,
    anomalies_apres: apres.pluNonMatchés.length,
    horsMatiere_apres: apres.pluHorsMatiere.length,
    ecartVal_total_avant: somme(avant.articlesEcart, "ecartVal"),
    ecartVal_total_apres: somme(apres.articlesEcart, "ecartVal"),
    articles_avant: avant.articlesEcart.length,
    articles_apres: apres.articlesEcart.length,
    puPiece_cost_avant: avant.articlesEcart.filter((a) => a.puPieceSource === "cost").length,
    puPiece_cost_apres: apres.articlesEcart.filter((a) => a.puPieceSource === "cost").length,
    puPiece_aucun_avant: avant.articlesEcart.filter((a) => a.puPieceSource === "aucun").length,
    puPiece_aucun_apres: apres.articlesEcart.filter((a) => a.puPieceSource === "aucun").length,
    sans_prix_apres: apres.articlesEcart.filter((a) => !(a.puPiece > 0) && !(a.puPieceCost > 0)).length,
    diff_cout_plu: diffs,
    anomalies_liste_apres: apres.pluNonMatchés.map((p) => ({ plu: p.plu, nom: p.nom, qty: p.qty })),
  };

  console.log("═══ " + rid + " · " + data.site + " (" + data.dateLabel + ") ═══");
  console.log("label AVANT : " + lignes.label_avant);
  console.log("label APRÈS : " + lignes.label_apres + " [" + lignes.nb_plu_apres + " produits / " + lignes.nb_ingredients_apres + " ingrédients]");
  const f = (v) => (v == null ? "—" : Math.round(v * 100) / 100).toLocaleString("fr-FR");
  console.log("conso théo  : " + f(lignes.consoTheo_avant) + " → " + f(lignes.consoTheo_apres) + " F  (Δ " + f(lignes.consoTheo_apres - lignes.consoTheo_avant) + ")");
  console.log("conso réelle : " + f(lignes.consoReelle_avant) + " → " + f(lignes.consoReelle_apres) + " F");
  console.log("écart       : " + f(lignes.ecart_avant) + " → " + f(lignes.ecart_apres) + " F  (" + (lignes.ecartP_avant * 100).toFixed(2) + " % → " + (lignes.ecartP_apres * 100).toFixed(2) + " %)");
  console.log("fiches matchées : " + lignes.ficheMatchees_avant + " → " + lignes.ficheMatchees_apres + " ; complément " + lignes.compMatchees_avant + " → " + lignes.compMatchees_apres + " ; anomalies " + lignes.anomalies_avant + " → " + lignes.anomalies_apres + " ; hors matière " + lignes.horsMatiere_apres);
  console.log("Σ ecartVal articles : " + f(lignes.ecartVal_total_avant) + " → " + f(lignes.ecartVal_total_apres) + " ; puPiece 'cost' " + lignes.puPiece_cost_avant + " → " + lignes.puPiece_cost_apres + " ; 'aucun' " + lignes.puPiece_aucun_avant + " → " + lignes.puPiece_aucun_apres);
  console.log("PLU dont le coût unitaire change : " + diffs.length);
  diffs.slice(0, 40).forEach((d) =>
    console.log("  " + d.plu + " " + String(d.nom).slice(0, 26).padEnd(26) + " ×" + d.qty + "  " + f(d.avant) + " → " + f(d.apres) + " (Δ " + f((d.apres || 0) - (d.avant || 0)) + ") [" + d.source_avant + " → " + d.source_apres + "]")
  );
  console.log("— critères d'acceptation —");
  CIBLES.forEach(([plu, attendu, lib]) => {
    const a = theoApres.get(plu);
    if (!a) return console.log("  PLU " + plu + " (" + lib + ") : ABSENT du PMIX de ce rapport");
    const ok = Math.abs((a.coutUnit || 0) - attendu) <= 1;
    console.log("  PLU " + plu + " (" + lib + ") : " + f(a.coutUnit) + " F attendu " + f(attendu) + " ±1 → " + (ok ? "OK" : "KO") + " [source " + a.source + ", avant " + f((theoAvant.get(plu) || {}).coutUnit) + "]");
  });

  fs.writeFileSync(new URL(`dryrun_${rid}.json`, R), JSON.stringify(lignes, null, 1));
  fs.writeFileSync(new URL(`calc_apres_${rid}.json`, R), JSON.stringify(apres));
});
