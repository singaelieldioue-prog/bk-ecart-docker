// Sonde lecture seule : ce que nos sources (base articles, Ratio, complément PMIX) disent des
// 5 lignes que la référence du CDG laisse à 0 dans Perte_Q1 2026 (colonnes B/C/D/E/G, L24, L137,
// L140, L143, L182). Exécution : node tests/tmp_exact_lignes_sans_prix.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { PERTES_REFERENTIEL_CDG } from "../src/utils/pertesReferentielCdg.js";
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (c) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(c); return r ? JSON.parse(r.v) : null; };
const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const arts = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif FROM articles").all();
const ratios = charge("bk_sia_ratios_parsed_v1") || {};
const produits = ratios.allProducts || [];
const comp = charge("bk_sia_pmix_complement_v1") || {};
const sansPrix = PERTES_REFERENTIEL_CDG.filter((t) => t.pu === undefined);
console.log(`articles en base : ${arts.length} | produits du Ratio : ${produits.length} | complément PMIX : ${Object.keys(comp).length}`);
sansPrix.forEach((t) => {
  const k = norm(t.nom);
  console.log(`\n── ${t.nom} [${t.cat}] — Cond. de la table ${t.cond} ──`);
  arts.filter((a) => norm(a.nom) === k)
    .forEach((a) => console.log(`  base, nom exact      : ${JSON.stringify({ code: a.code, cat: a.categorie, cond: a.conditionnement, pu_carton: a.pu_carton, pu_piece: a.pu_piece, unite: a.unite, actif: a.actif })}`));
  produits.filter((p) => norm(p.nom) === k)
    .forEach((p) => console.log(`  Ratio, nom exact     : ${JSON.stringify({ plu: p.plu, nom: p.nom, coutTheo: p.coutTheo, pvTtc: p.pvTtc })}`));
  Object.entries(comp).filter(([, c]) => norm(c && c.nom) === k)
    .forEach(([plu, c]) => console.log(`  complément, nom exact: ${JSON.stringify({ plu, nom: c.nom, cout: c.cout })}`));
  arts.filter((a) => a && a.nom && norm(a.nom) !== k && norm(a.nom).slice(0, 8) === k.slice(0, 8))
    .slice(0, 5)
    .forEach((a) => console.log(`  base, même début     : ${JSON.stringify({ nom: a.nom, code: a.code, cat: a.categorie, cond: a.conditionnement, pu_carton: a.pu_carton, pu_piece: a.pu_piece, actif: a.actif })}`));
  produits.filter((p) => comp[p.plu] && norm(comp[p.plu].nom) === k)
    .forEach((p) => console.log(`  complément ↔ Ratio : ${JSON.stringify({ plu: p.plu, ratio: p.nom, coutRatio: p.coutTheo, compNom: comp[p.plu].nom, coutComp: comp[p.plu].cout })}`));
});
