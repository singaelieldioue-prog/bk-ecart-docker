// Sonde lecture seule : algorithme de résolution des lignes transmises non publiées de la feuille
// Pertes, exactement celui qui sera implémenté dans excelExporter.js.
// Pour chaque nom transmis absent des lignes publiées : base complète (nom exact + garde anti-doublon
// sur le code déjà publié), puis référentiel PMIX / complément (nom exact ou troncature à un mot,
// coût du Ratio prioritaire, PLU déjà valorisé refusé).
// Les sources sont lues en base de données (lecture seule) : les dumps JSON de tmp_verif datent du
// 25/10 au matin, avant la revalorisation du conditionnement.
// Exécution : node tests/tmp_pertes_resolution.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { enrichirAvecBaseLocale } from "../src/utils/parsers.js";

// better-sqlite3 n'est installé que côté backend.
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (cle) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(cle); return r ? JSON.parse(r.v) : null; };

const SRC = fs.readFileSync(new URL("../src/utils/excelExporter.js", import.meta.url), "utf-8");
const PERTES_WHITELIST = new Function("return " + /const PERTES_WHITELIST = (\[[\s\S]*?\]);/.exec(SRC)[1])();

const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
// mots du libellé dans l'ordre (les espaces sont conservés, contrairement à norm)
const mots = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);

const baseComplete = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, unite, actif FROM articles").all();
const produitsRatio = (charge("bk_sia_ratios_parsed_v1") || {}).allProducts || [];
const localArticles = charge("bk_sia_local_articles_v1") || {};
const complement = charge("bk_sia_pmix_complement_v1") || {};

function ordonnerSelonExemple(articles) {
  const wb = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.inventaire, { header: 1, defval: null });
  const ref = rows.slice(6).filter((r) => r[3] && r[14]).map((r) => ({
    name: r[3], code: r[14], categorie: r[1] || "",
    conditionnement: typeof r[4] === "number" ? r[4] : 1,
    qteInner: typeof r[5] === "number" ? r[5] : 0,
    unite: r[10] || "",
  }));
  const byCode = new Map(), byName = new Map();
  articles.forEach((a) => { if (a.code) byCode.set(norm(a.code), a); if (a.nom) byName.set(norm(a.nom), a); });
  return ref.map((reference) => {
    const source = byCode.get(norm(reference.code)) || byName.get(norm(reference.name));
    return { ...(source || {}), nom: reference.name, code: reference.code, categorie: reference.categorie,
      conditionnement: reference.conditionnement, qteInner: reference.qteInner, unite: reference.unite || source?.unite || "" };
  });
}

const articles = enrichirAvecBaseLocale(ordonnerSelonExemple(baseComplete), localArticles);

// pmixProducts : comme excelExporter.js:289-300 (le Ratio a la priorité, le complément ne vaut que
// les PLU sans fiche Ratio).
const ratioPluSet = new Set(produitsRatio.map((p) => norm(p.plu)));
const pmixProducts = [
  ...produitsRatio,
  ...Object.entries(complement).filter(([plu]) => !ratioPluSet.has(norm(plu)))
    .map(([plu, c]) => ({ plu, nom: String(c?.nom || plu).trim(), coutTheo: Number(c?.cout) > 0 ? Number(c.cout) : 0 })),
];

const isExcludedCategory = (c) => { const v = String(c || "").trim().toLowerCase(); return v.includes("produits de nettoyage") || v.includes("produit de nettoyage"); };
const whitelistNorm = PERTES_WHITELIST.map(norm);
const isW = (n) => whitelistNorm.includes(norm(n));
const filteredPertes = articles.filter((a) => a && !isExcludedCategory(a.categorie) && !/packaging/i.test(String(a.categorie || "")) && isW(a.nom));
const nomsBase = new Set(filteredPertes.map((a) => norm(a.nom)));
const vusPmix = new Set();
const filteredPmix = pmixProducts.filter((p) => {
  if (!isW(p.nom)) return false;
  const k = norm(p.nom);
  if (nomsBase.has(k) || vusPmix.has(k)) return false;
  vusPmix.add(k); return true;
});
const nomsPublies = new Set([...filteredPertes.map((a) => norm(a.nom)), ...filteredPmix.map((p) => norm(p.nom))]);
// les codes publiés viennent du fichier d'inventaire de référence, les PLU des lignes produits finis
const codesPublies = new Set(filteredPertes.map((a) => norm(a.code)).filter(Boolean));
const pluPublies = new Set(filteredPmix.map((p) => norm(p.plu)).filter(Boolean));
const manquants = [];
const deja = new Set();
PERTES_WHITELIST.forEach((nom) => {
  const k = norm(nom);
  if (!k || nomsPublies.has(k) || deja.has(k)) return;
  if (articles.some((a) => a && norm(a.nom) === k)) return;
  deja.add(k); manquants.push(nom);
});

const arrondi = (x) => Math.round(Number(x) * 100) / 100;
console.log(`sources : base ${baseComplete.length} lignes | Ratio ${produitsRatio.length} produits | complément ${Object.keys(complement).length} PLU`);
console.log(`publiées : ${filteredPertes.length} matière + ${filteredPmix.length} produits finis | à résoudre : ${manquants.length}`);

// règle PMIX : même nombre de mots, un seul mot différent, et ce mot est un préfixe strict de l'autre
const prefixeStrict = (a, b) => a !== b && (a.startsWith(b) || b.startsWith(a));
const candidatsPmix = (nom) => {
  const cible = mots(nom);
  const vus = new Set();
  const out = [];
  const push = (sig, source, item, exact) => { if (!vus.has(sig)) { vus.add(sig); out.push({ source, item, exact }); } };
  for (const source of ["ratio", "complement"]) {
    const liste = source === "ratio" ? produitsRatio : Object.entries(complement).map(([plu, c]) => ({ plu, nom: c?.nom, cout: Number(c?.cout) }));
    for (const item of liste) {
      if (!item?.nom) continue;
      const c2 = mots(item.nom);
      if (c2.length !== cible.length) continue;
      const idx = c2.map((w, i) => (w === cible[i] ? -1 : i)).filter((i) => i >= 0);
      if (idx.length === 0) push(source + "|" + norm(item.nom) + "|" + item.plu, source, item, true);
      else if (idx.length === 1 && prefixeStrict(c2[idx[0]], cible[idx[0]])) push(source + "|" + norm(item.nom) + "|" + item.plu, source, item, false);
    }
  }
  return out;
};

const parNomBase = new Map();
baseComplete.forEach((a) => { if (a?.nom && !parNomBase.has(norm(a.nom))) parNomBase.set(norm(a.nom), a); });

let resolus = 0;
for (const nom of manquants) {
  const b = parNomBase.get(norm(nom));
  const cands = candidatsPmix(nom);
  console.log(`\n« ${nom} »`);
  if (b) {
    const prixOK = Number(b.pu_carton) > 0 && Number(b.conditionnement) > 0;
    const codeDejaPublie = codesPublies.has(norm(b.code));
    const autres = codeDejaPublie ? filteredPertes.filter((a) => norm(a.code) === norm(b.code)).map((a) => a.nom).join(" / ") : "";
    console.log(`  base     : cond=${b.conditionnement} pu_carton=${arrondi(b.pu_carton)} unite=${b.unite} cat=${b.categorie} actif=${b.actif} code=${b.code}`);
    if (!prixOK) console.log("  → REFUSÉ (pas de colisage/prix en base)");
    else if (codeDejaPublie) console.log(`  → REFUSÉ (code « ${b.code} » déjà publié sous « ${autres} »)`);
    else { console.log("  → RÉSOLU par la base"); resolus++; }
    continue;
  }
  if (!cands.length) { console.log("  base     : (aucun nom exact)\n  → RESTE VIDE (aucune source)"); continue; }
  cands.forEach((c) => {
    const ratioMemePlu = produitsRatio.find((p) => norm(p.plu) === norm(c.item.plu));
    const cout = c.source === "ratio" ? c.item.coutTheo : (ratioMemePlu ? ratioMemePlu.coutTheo : c.item.cout);
    console.log(`  ${c.source === "ratio" ? "Ratio    " : "complém. "}: « ${c.item.nom} » plu=${c.item.plu} coût=${arrondi(cout)}`
      + `${c.exact ? " (nom exact)" : " (troncature)"}${ratioMemePlu && c.source !== "ratio" ? `, coût du Ratio « ${ratioMemePlu.nom} »` : ""}`
      + `${pluPublies.has(norm(c.item.plu)) ? " — PLU DÉJÀ PUBLIÉ" : ""}`);
  });
  if (cands.length > 1) console.log(`  → REFUSÉ (${cands.length} candidats, appariement ambigu)`);
  else if (pluPublies.has(norm(cands[0].item.plu))) console.log("  → REFUSÉ (PLU déjà valorisé dans une ligne publiée)");
  else { console.log("  → RÉSOLU par le PMIX"); resolus++; }
}
console.log(`\nrésolues : ${resolus}/${manquants.length} — restent vides : ${manquants.length - resolus}`);
