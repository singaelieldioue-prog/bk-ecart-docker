// REGEN-Q3 — préparation du nouveau `data` des 2 rapports (aucune écriture en base).
// Reproduit App.jsx:541-573 avec les référentiels Q3 actifs en KV et écrit, pour chaque
// rapport, l'objet data complet dans tmp_regen/data_apres_<id>.json.
// Exécution : node tests/tmp_regen_q3_emit.mjs
import fs from "node:fs";

import { calculer } from "../src/utils/calculators.js";

const R = new URL("../../tmp_regen/", import.meta.url);
const lire = (f) => JSON.parse(fs.readFileSync(new URL(f, R), "utf-8"));

const ratios = lire("bk_sia_ratios_parsed_v1.json");
const baseArticle = lire("bk_sia_base_article_map_v1.json");
const pmixComplement = lire("bk_sia_pmix_complement_v1.json");
const ratiosMemo = lire("bk_sia_ratios_v1.json");

["60198f93", "76b8d757"].forEach((rid) => {
  const data = lire(`report_${rid}.json`);
  if (!/Q2/.test(data.ratiosMeta?.label || "")) throw new Error(rid + " : label non Q2 (" + data.ratiosMeta?.label + ")");
  const calc = calculer(data.stockData, data.pmixList, ratios, baseArticle, pmixComplement);
  const nouveau = {
    ...data,
    calc,
    ficheMatchees: calc.ficheMatchees,
    ratiosMeta: {
      nbProduits: ratios.allProducts.length,
      nbIngredients: Object.keys(ratios.pmpByIng).length,
      allProducts: ratios.allProducts,
      label: `${ratiosMemo.label} · Chargés le ${ratiosMemo.date}`,
    },
  };
  fs.writeFileSync(new URL(`data_apres_${rid}.json`, R), JSON.stringify(nouveau));
  console.log(
    rid,
    "->",
    nouveau.ratiosMeta.label,
    "| consoTheo",
    Math.round(calc.consoTheoTotal * 100) / 100,
    "| ecart",
    Math.round(calc.ecartMatiere * 100) / 100,
    "| octets",
    fs.statSync(new URL(`data_apres_${rid}.json`, R)).size,
    "(avant",
    JSON.stringify(data).length + ")"
  );
});
