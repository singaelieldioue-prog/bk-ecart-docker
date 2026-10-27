// Sonde lecture seule : pourquoi des articles transmis tombent-ils dans le bloc
// « ARTICLES TRANSMIS NON TROUVÉS DANS LA BASE » de la feuille Pertes, alors qu'ils ont un prix ?
// Reproduit exactement la chaîne de l'export (BaseArticlesTab.jsx:146) et cherche chaque nom
// manquant dans TOUTES les sources : liste de référence (318), base BDD (621), base locale, PMIX.
// Exécution : node tests/tmp_pertes_manquants.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";

import { enrichirAvecBaseLocale } from "../src/utils/parsers.js";

// La liste transmise est une constante locale à buildModelesWb : relue dans le source pour que
// la sonde ne puisse pas diverger d'elle.
const SRC = fs.readFileSync(new URL("../src/utils/excelExporter.js", import.meta.url), "utf-8");
const PERTES_WHITELIST = new Function("return " + /const PERTES_WHITELIST = (\[[\s\S]*?\]);/.exec(SRC)[1])();

const V = new URL("../../tmp_verif/", import.meta.url);
const lire = (f) => JSON.parse(fs.readFileSync(new URL(f, V), "utf-8"));
const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

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
  articles.forEach((a) => { if (a.code) byCode.set(norm(a.code), a); if (a.nom) byName.set(norm(a.nom), a); });
  return ref.map((reference) => {
    const source = byCode.get(norm(reference.code)) || byName.get(norm(reference.name));
    return { ...(source || {}), nom: reference.name, code: reference.code, categorie: reference.categorie,
      conditionnement: reference.conditionnement, qteInner: reference.qteInner, unite: reference.unite || source?.unite || "" };
  });
}

const articlesBdd = lire("articles.json");
const produits = lire("produits.json");
const localArticles = lire("local_articles.json");
const complement = lire("pmix_complement.json");
const ordered = enrichirAvecBaseLocale(ordonnerSelonExemple(articlesBdd), localArticles);

// ── Le calcul du bloc « manquants », tel que excelExporter.js:704-764 ──────────────────────
const whitelistNorm = PERTES_WHITELIST.map(norm);
const isW = (n) => whitelistNorm.includes(norm(n));
const isExcludedCategory = (c) => { const v = String(c || "").trim().toLowerCase(); return v.includes("produits de nettoyage") || v.includes("produit de nettoyage"); };
const filteredPertes = ordered.filter((a) => a && !isExcludedCategory(a.categorie) && !/packaging/i.test(String(a.categorie || "")) && isW(a.nom));
const nomsBase = new Set(filteredPertes.map((a) => norm(a.nom)));
const vusPmix = new Set();
const filteredPmix = produits.filter((p) => {
  if (!isW(p.nom)) return false;
  const k = norm(p.nom);
  if (nomsBase.has(k) || vusPmix.has(k)) return false;
  vusPmix.add(k); return true;
});
const publies = new Set([...filteredPertes.map((a) => norm(a.nom)), ...filteredPmix.map((p) => norm(p.nom))]);
const manquants = [];
const deja = new Set();
PERTES_WHITELIST.forEach((nom) => {
  const k = norm(nom);
  if (!k || publies.has(k) || deja.has(k)) return;
  if (ordered.some((a) => a && norm(a.nom) === k)) return;
  deja.add(k); manquants.push(nom);
});

// ── Où le prix existe-t-il réellement ? ───────────────────────────────────────────────────
const localParNom = new Map(Object.entries(localArticles).map(([k, v]) => [norm(v.nom || k), { k, ...v }]));
const bddParNom = new Map();
articlesBdd.forEach((a) => { if (!bddParNom.has(norm(a.nom))) bddParNom.set(norm(a.nom), a); });
const pmixParNom = new Map();
produits.forEach((p) => { if (!pmixParNom.has(norm(p.nom))) pmixParNom.set(norm(p.nom), p); });
const compParNom = new Map(Object.entries(complement).map(([k, v]) => [norm(v.nom || k), v]));

// approximateurs : le nom transmis n'est pas toujours écrit pareil
const tokens = (s) => norm(s).replace(/(\d+)(cl|l|g|kg|ml)/g, "$1 $2").match(/[a-z0-9]{2,}/g) || [];
const proche = (nom, indexeur) => {
  const t = tokens(nom).filter((x) => !/^\d+$/.test(x));
  let best = null;
  for (const [cle, val] of indexeur) {
    const v = tokens(cle).filter((x) => !/^\d+$/.test(x));
    const commun = t.filter((x) => v.includes(x)).length;
    if (commun >= Math.max(2, t.length - 1) && (!best || commun > best.score)) best = { score: commun, cle, val };
  }
  return best;
};

console.log(`liste de référence (exemple inventaire.xlsx) : ${ordered.length} lignes | base BDD : ${articlesBdd.length} | base locale : ${Object.keys(localArticles).length} | PMIX : ${produits.length} | complément : ${Object.keys(complement).length}`);
console.log(`Pertes publiées : ${filteredPertes.length} matière + ${filteredPmix.length} produits finis | bloc « non trouvés » : ${manquants.length}`);
console.log(`\n═══ ${manquants.length} lignes du bloc « ARTICLES TRANSMIS NON TROUVÉS DANS LA BASE » ═══`);
for (const nom of manquants) {
  const k = norm(nom);
  const bdd = bddParNom.get(k), local = localParNom.get(k), pmix = pmixParNom.get(k), comp = compParNom.get(k);
  const dansRef = ordered.some((a) => norm(a.nom) === k);
  const lignes = [];
  if (bdd) lignes.push(`BDD: cond=${bdd.conditionnement} pu_carton=${bdd.pu_carton} unite=${bdd.unite} cat=${bdd.categorie} actif=${bdd.actif} code=${bdd.code}`);
  if (local) lignes.push(`locale: cdt=${local.cdt} pmpCarton=${local.pmpCarton} puPiece=${local.puPiece} unite=${local.unite} cat=${local.categorie}`);
  if (pmix) lignes.push(`PMIX: coutTheo=${pmix.coutTheo} pvTtc=${pmix.pvTtc}`);
  if (comp) lignes.push(`complément: cout=${comp.cout}`);
  console.log(`\n« ${nom} » — dans la liste de référence : ${dansRef ? "OUI" : "NON"}`);
  console.log(lignes.length ? "  " + lignes.join("\n  ") : "  (aucune source exacte)");
  if (!lignes.length) {
    for (const [src, idx] of [["BDD", bddParNom], ["locale", localParNom], ["PMIX", pmixParNom]]) {
      const p = proche(nom, idx);
      if (p) console.log(`  ~${src} « ${p.val.nom || p.cle} » ${src === "BDD" ? `cond=${p.val.conditionnement} pu_carton=${p.val.pu_carton}` : src === "locale" ? `cdt=${p.val.cdt} pmpCarton=${p.val.pmpCarton}` : `coutTheo=${p.val.coutTheo}`}`);
    }
  }
}
