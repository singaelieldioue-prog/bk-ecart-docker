// Sonde lecture seule : où vit le prix de chaque article du bloc « ARTICLES TRANSMIS NON TROUVÉS
// DANS LA BASE » de la feuille Pertes ? Base SQLite (actifs et inactifs), référentiel PMIX,
// complément PMIX, base locale, liste de référence des 318.
// better-sqlite3 n'est installé que côté backend.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
import fs from "node:fs";
import XLSX from "xlsx-js-style";

const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });

const NOMS = ["MIRINDA ORANGE PET 30CL", "BOUTEILLE 7UP 30CL", "BOUTEILLE PEPSI ZERO 1,5L", "EAU KIRENE 50 CL 16",
  "FROMAGE MEDHI NEW", "HUILE AYA 5 L", "BUN 7'' NOUGATINE", "BUN 5'' Nougatine", "MOZZARELLA STICKS",
  "BBQ TENDERCRISP", "CHICKEN BURGER PETIT PRIX", "SALADE POULET CROUSTILLANT", "SALADE POULET GRILLE"];

// 1) Base articles, actifs comme inactifs
const base = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, unite, actif, source FROM articles").all();
const parNom = new Map();
base.forEach((r) => { const k = norm(r.nom); if (!parNom.has(k)) parNom.set(k, r); });

// 2) Référentiels stockés en KV : produits finis du Ratio, complément PMIX, base locale
const ligne = (cle) => db.prepare("SELECT v FROM kv WHERE k = ?").get(cle);
const charge = (cle) => { const r = ligne(cle); return r ? JSON.parse(r.v) : null; };
const ratiosParsed = charge("bk_sia_ratios_parsed_v1") || {};
const produits = ratiosParsed.allProducts || [];
const complement = charge("bk_sia_pmix_complement_v1") || {};
const local = charge("bk_sia_local_articles_v1") || {};

// 3) Liste de référence des 318 (exemple inventaire.xlsx)
const wb = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
const refRows = XLSX.utils.sheet_to_json(wb.Sheets.inventaire, { header: 1, defval: null }).slice(6).filter((r) => r[3] && r[14]);
const refNoms = new Set(refRows.map((r) => norm(r[3])));
const refCodes = new Set(refRows.map((r) => norm(r[14])));

const trouve = (index, n) => index.get(norm(n));
const pmixNoms = new Map(produits.map((p) => [norm(p.nom), p]));
const compNoms = new Map(Object.values(complement).map((c) => [norm(c.nom || ""), c]));
const localNoms = new Map(Object.values(local).map((a) => [norm(a.nom || ""), a]));

console.log(`\nbase : ${base.length} lignes (${base.filter((b) => b.actif == 1).length} actives) | PMIX produits : ${produits.length || "?"} | complément : ${compNoms.size} | base locale : ${localNoms.size} | liste de référence : ${refNoms.size}`);
console.log("\n═══ les 13 lignes du bloc « non trouvés » ═══");
for (const n of NOMS) {
  const b = trouve(parNom, n), p = pmixNoms.get(norm(n)), c = compNoms.get(norm(n)), l = localNoms.get(norm(n));
  const dansRef = refNoms.has(norm(n));
  console.log(`\n« ${n} »  — liste de référence 318 : ${dansRef ? "OUI" : "NON"}`);
  if (b) console.log(`  base     : actif=${b.actif} cond=${b.conditionnement} pu_carton=${Math.round(b.pu_carton * 100) / 100} cat=${b.categorie} code=${b.code} source=${b.source}`);
  if (l) console.log(`  locale   : cdt=${l.cdt} pmpCarton=${l.pmpCarton} puPiece=${l.puPiece} unite=${l.unite} cat=${l.categorie}`);
  if (p) console.log(`  PMIX     : plu=${p.plu} coutTheo=${Math.round(p.coutTheo * 100) / 100} pvTtc=${p.pvTtc} cat=${p.categorie}`);
  if (c) console.log(`  complém. : cout=${Math.round((c.cout ?? c.coutTheo) * 100) / 100}`);
  if (!b && !p && !c && !l) console.log("  (absent de toutes les sources)");
  if (b && !dansRef) console.log(`  code ${b.code} dans la liste de référence : ${refCodes.has(norm(b.code)) ? "OUI" : "NON"}`);
  if (!b && !p && !c && !l) {
    // même mot de 4 lettres ou plus qu'ailleurs : le prix existe peut-être sous une autre orthographe
    const mots = (norm(n).match(/[a-z]{4,}/g) || []);
    const vues = new Set();
    const candidats = [];
    const scan = (src, indexeur, fmt) => {
      for (const [k, v] of indexeur) {
        if (mots.some((m) => k.includes(m))) { const sig = src + norm(v.nom || ""); if (!vues.has(sig)) { vues.add(sig); candidats.push(`  ~${src} « ${v.nom || k} » ${fmt(v)}`); } }
      }
    };
    scan("base", parNom, (v) => `actif=${v.actif} cond=${v.conditionnement} pu_carton=${Math.round(v.pu_carton * 100) / 100} code=${v.code}`);
    scan("PMIX", pmixNoms, (v) => `plu=${v.plu} coutTheo=${Math.round(v.coutTheo * 100) / 100}`);
    scan("complém.", compNoms, (v) => `cout=${Math.round((v.cout ?? v.coutTheo) * 100) / 100}`);
    scan("locale", localNoms, (v) => `cdt=${v.cdt} pmpCarton=${v.pmpCarton}`);
    candidats.slice(0, 8).forEach((x) => console.log(x));
    if (!candidats.length) console.log("  aucun candidat par mot-clé");
  }
}
