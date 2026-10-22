// Re-dérive les prix stockés après correction des sémantiques C1/C2 (base locale + correspondance).
// Usage: node backend/scripts/rederive_prix.mjs [--apply]   (dry-run sans --apply)
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import Database from "better-sqlite3";
const XLSX = createRequire(import.meta.url)("xlsx");
import { parseCorrespondance, parseBaseArticleLocal } from "../../frontend/src/utils/parsers.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APPLY = process.argv.includes("--apply");
const db = new Database(path.join(ROOT, "backend", "data.db"));
const getKv = (k) => JSON.parse(db.prepare("SELECT v FROM kv WHERE k=?").get(k).v);
const setKv = (k, v) => db.prepare("UPDATE kv SET v=? WHERE k=?").run(JSON.stringify(v), k);

// ── 1. Base locale : le « prix unitaire » du fichier source est le prix d'achat (carton/pack). ──
// Relu avec le parseur corrigé ; les entrées KV qui ne viennent pas de ce fichier (ajouts
// manuels 29/09, déjà cohérents) sont laissées telles quelles.
const LOCAL_FILE = path.join(ROOT, "sample_data", "Base article local 240926.xlsx");
const fromFile = Object.values(parseBaseArticleLocal(XLSX.readFile(LOCAL_FILE)));
const up = (s) => String(s || "").trim().toUpperCase();
const fByNom = {}, fByCode = {};
fromFile.forEach((a) => { fByNom[up(a.nom)] = a; if (a.code) fByCode[up(a.code)] = a; });

const loc = getKv("bk_sia_local_articles_v1");
let locFix = 0, locKeep = 0;
const locFixed = {};
const ex = [];
for (const [k, a] of Object.entries(loc)) {
  const nf = fByNom[up(a.nom)] || (a.code ? fByCode[up(a.code)] : null);
  if (nf) {
    locFixed[k] = { ...a, nom: nf.nom, cdt: nf.cdt, puPiece: nf.puPiece, pmpCarton: nf.pmpCarton };
    locFix++;
    if (a.cdt > 1 && a.puPiece > 20000 && ex.length < 3)
      ex.push(`  ${a.nom} cdt=${a.cdt}: piece ${a.puPiece}/carton ${a.pmpCarton} -> piece ${nf.puPiece}/carton ${nf.pmpCarton}`);
  } else { locFixed[k] = a; locKeep++; }
}
console.log(`BASE LOCALE KV: ${Object.keys(loc).length} entrées · ${locFix} re-dérivées du fichier · ${locKeep} hors fichier (inchangées)`);
ex.forEach((e) => console.log(e));

// ── 2. Correspondance : relue avec le parseur corrigé (poids kg ≠ prix). ──
const corrFile = process.env.RATIO_FILE ? path.resolve(process.env.RATIO_FILE) : path.join(ROOT, "sample_data", "RATIOS  Q2 2026.xlsx");
const corrNew = parseCorrespondance(XLSX.readFile(corrFile));
const corrOld = getKv("bk_sia_correspondance_map_v1");
const garbage = (m) => Object.values(m.map || m).filter((e) => (e.puPiece > 0 && e.puPiece < 1) || (e.pmpCarton > 0 && e.pmpCarton < 1)).length;
console.log(`CORRESPONDANCE: avant ${Object.keys(corrOld.map || corrOld).length} entrées (${garbage(corrOld)} prix<1F) -> après ${Object.keys(corrNew.map).length} entrées (${garbage(corrNew)} prix<1F)`);

// ── 3. Table articles : prix alignés sur la base locale corrigée, orres dus à la correspondance vide. ──
const byNom = {}, byCode = {};
for (const a of Object.values(locFixed)) {
  byNom[a.nom.trim().toUpperCase()] = a;
  if (a.code) byCode[a.code.trim().toUpperCase()] = a;
}
const rows = db.prepare("SELECT ref,nom,code,conditionnement,pu_carton,pu_piece,source FROM articles").all();
let artFix = 0, artNull = 0, artSkip = 0;
const detail = [];
for (const r of rows) {
  const K = (r.nom || "").trim().toUpperCase();
  const l = byNom[K] || (r.code ? byCode[String(r.code).trim().toUpperCase()] : null);
  if (r.source === "Base locale" && l && l.pmpCarton > 0) {
    if (Math.abs((r.pu_carton || 0) - l.pmpCarton) > 0.5 || Math.abs((r.pu_piece || 0) - l.puPiece) > 0.5) {
      artFix++;
      if (detail.length < 8) detail.push(`  ${r.nom} (cdt ${r.conditionnement}): ${r.pu_piece}/${r.pu_carton} -> ${l.puPiece}/${l.pmpCarton}`);
      if (APPLY) db.prepare("UPDATE articles SET pu_piece=?, pu_carton=?, updated_at=? WHERE ref=?").run(l.puPiece, l.pmpCarton, new Date().toISOString(), r.ref);
    } else artSkip++;
    continue;
  }
  // Prix issu d'un poids kg lu comme un prix (correspondance avant correction) : non monétaire.
  if (r.pu_piece > 0 && r.pu_piece < 1) {
    artNull++;
    if (detail.length < 16) detail.push(`  ${r.nom}: pu_piece ${r.pu_piece} -> NULL`);
    if (APPLY) db.prepare("UPDATE articles SET pu_piece=NULL, pu_carton=NULL, updated_at=? WHERE ref=?").run(new Date().toISOString(), r.ref);
  }
}
console.log(`ARTICLES: ${rows.length} lignes · ${artFix} prix re-calculés · ${artNull} prix aberrants (<1F) remis à NULL · ${artSkip} déjà justes`);
detail.forEach((d) => console.log(d));

const ctl = (q) => db.prepare(q).get().c;
console.log("Contrôle avant/après: pu_piece>20k avec cdt>1 = " + ctl("SELECT COUNT(*) c FROM articles WHERE conditionnement>1 AND pu_piece>20000") +
  " · pu_piece<1F = " + ctl("SELECT COUNT(*) c FROM articles WHERE pu_piece>0 AND pu_piece<1") +
  " · pu_carton>5M = " + ctl("SELECT COUNT(*) c FROM articles WHERE pu_carton>5000000"));

if (APPLY) {
  setKv("bk_sia_local_articles_v1", locFixed);
  setKv("bk_sia_correspondance_map_v1", corrNew);
  console.log("APPLIQUÉ: KV base locale + KV correspondance écrits, table articles mise à jour.");
} else {
  console.log("DRY-RUN (relancer avec --apply pour écrire).");
}
db.close();
