// RECHERCHE — que dit le Ratio Q3 actif sur SANITIZER TABLETTE (2600320ST) et
// SACHET SNACK MOYEN / SSM30700 ? Lecture seule (base en readonly), aucune écriture.
// Exécution : node tests/tmp_check_ratio_q3.mjs
import path from "node:path";
import { createRequire } from "node:module";

const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(path.resolve("../backend/data.db"), { readonly: true, fileMustExist: true });
const charge = (k) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(k); return r ? JSON.parse(r.v) : null; };
const ratios = charge("bk_sia_ratios_parsed_v1") || {};
const meta = charge("bk_sia_ratios_v1") || {};
const base = charge("bk_sia_base_article_map_v1") || {};
const local = charge("bk_sia_local_articles_v1") || {};
const comp = charge("bk_sia_pmix_complement_v1") || {};
db.close();

console.log("Ratio :", JSON.stringify(meta));
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const CODES = ["2600320ST", "SSM30700"];
const MOTS = [/SANITIZER/, /SACHET SNACK/];

const dump = (label, src) => {
  const arr = Array.isArray(src) ? src
    : (src && typeof src === "object" ? Object.entries(src).map(([k, v]) => ({ cle: k, ...(v && typeof v === "object" ? v : { v }) })) : []);
  const hits = arr.filter((e) => e && (
    CODES.some((c) => norm(e.code) === norm(c)) ||
    MOTS.some((re) => re.test(norm(e.nom || e.designation || e.article || e.cle || "")))
  ));
  console.log(`\n── ${label} : ${hits.length} correspondance(s) / ${arr.length} entrées`);
  hits.forEach((e) => console.log("   " + JSON.stringify(e)));
};

dump("allProducts", ratios.allProducts);
dump("waLandedCost", ratios.waLandedCost);
dump("byPlu (produits + coût)", Object.entries(ratios.byPlu || {}).map(([plu, f]) => ({ plu, ...f })));
dump("pmpByIng (ingrédients)", Object.entries(ratios.pmpByIng || {}).map(([ing, v]) => ({ ing, ...(typeof v === "object" ? v : { pmp: v }) })));
dump("base article (KV)", Object.entries(base || {}).map(([k, v]) => ({ cle: k, ...(typeof v === "object" ? v : { v }) })));
dump("base locale (KV)", Object.entries(local || {}).map(([k, v]) => ({ cle: k, ...(typeof v === "object" ? v : { v }) })));
dump("complément PMIX (KV)", Object.entries(comp || {}).map(([k, v]) => ({ plu: k, ...(typeof v === "object" ? v : { v }) })));

console.log("\n── index par code du Ratio");
for (const c of CODES) console.log(`   ${c} → waByCode : ${JSON.stringify((ratios.waByCode || {})[c] ?? null)}`);
