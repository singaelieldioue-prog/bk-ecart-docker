// Harmonise la colonne Unité de la base articles (demande CDG du 25/10 : « L'unité de mesure
// de chaque article doit être ajoutée à la base »).
//   1) les valeurs écrites sont ramenées à une orthographe unique (carton/CARTON → Carton,
//      piece/Pi?ce → Pièce, PACK/Pack → Pack, « 1 inner de 4 » → Inner…) ;
//   2) les unités absentes sont prises dans les fichiers de référence quand ils en portent une,
//      sinon déduites du colisage (conditionnement > 1 → Carton, sinon Pièce).
// Réversible : sauvegarde de data.db + journal des lignes touchées dans rapports/.
// Usage: node backend/scripts/harmoniser_unites.mjs [--apply]   (dry-run sans --apply)
import { fileURLToPath } from "url";
import path from "path";
import fs from "node:fs";
import * as XLSX from "xlsx";
import Database from "better-sqlite3";
import { canonUnite, uniteConnue } from "../src/articles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APPLY = process.argv.includes("--apply");
const DB_PATH = path.join(ROOT, "backend", "data.db");
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-']/g, " ").replace(/[^A-Za-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
const key = (s) => norm(s).replace(/\s+/g, "");

// ── Fichiers de référence qui portent une colonne « Unité » ──────────────────
// (nom, code) → unité, par ordre de préférence : le premier qui répond gagne.
const SOURCES = [
  { f: "sample_data/Base article local 240926.xlsx", sheet: "Articles", header: 4, nom: 1, code: 2, unite: 3 },
  { f: "sample_data/BASE ARTICLE SIA.xlsx", sheet: "base article ", header: 1, nom: 2, code: 5, unite: 6 },
  { f: "frontend/public/exemple inventaire.xlsx", sheet: "inventaire", header: 6, nom: 1, code: 14, unite: 10 },
];
const indexFrom = (src) => {
  const file = path.join(ROOT, src.f);
  if (!fs.existsSync(file)) return { map: new Map(), missing: true };
  const rows = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(file), { type: "array" }).Sheets[src.sheet], { header: 1, defval: null });
  const map = new Map();
  for (const r of rows.slice(src.header)) {
    if (!r) continue;
    const u = uniteConnue(r[src.unite]);
    if (!u) continue;
    for (const v of [r[src.nom], r[src.code]]) { const k = key(v); if (k && !map.has(k)) map.set(k, u); }
  }
  return { map, missing: false };
};
const indexes = SOURCES.map((s) => ({ ...s, ...indexFrom(s) }));

const db = new Database(DB_PATH);
const rows = db.prepare("SELECT ref, nom, code, unite, conditionnement, actif FROM articles ORDER BY nom").all();

const changed = [], filled = [];
for (const r of rows) {
  const actuelle = String(r.unite ?? "").trim();
  const canon = canonUnite(actuelle);
  if (canon && canon !== actuelle) { changed.push({ ...r, de: actuelle, a: canon, motif: "orthographe" }); continue; }
  if (canon) continue;
  let proposition = null, motif = null;
  for (const ix of indexes) {
    const hit = ix.map.get(key(r.code)) || ix.map.get(key(r.nom));
    if (hit) { proposition = hit; motif = ix.f; break; }
  }
  if (!proposition) { proposition = Number(r.conditionnement) > 1 ? "Carton" : "Pièce"; motif = "colisage"; }
  filled.push({ ...r, de: actuelle || null, a: proposition, motif });
}

const actifs = rows.filter((r) => r.actif === 1);
console.log(`articles : ${rows.length} (${actifs.length} actifs)`);
console.log(`unités absentes : ${actifs.filter((r) => !String(r.unite ?? "").trim()).length} actifs / ${rows.filter((r) => !String(r.unite ?? "").trim()).length} au total`);
indexes.forEach((ix) => console.log(`  source ${ix.f} : ${ix.missing ? "ABSENTE (forfait colisage)" : `${ix.map.size} clés`}`));
console.log(`\nà normaliser : ${changed.length}`);
changed.forEach((r) => console.log(`   ${r.nom} : ${JSON.stringify(r.de)} → ${r.a}`));
console.log(`\nà renseigner : ${filled.length}`);
filled.forEach((r) => console.log(`   ${r.nom} : ${r.a}  (colisage ${r.conditionnement}, source ${r.motif})`));

if (!APPLY) { console.log("\nDRY-RUN — aucune écriture. Relancer avec --apply."); db.close(); process.exit(0); }

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
fs.copyFileSync(DB_PATH, `${DB_PATH}.bak-unites-${stamp}`);
const log = path.join(ROOT, "rapports", `harmonisation_unites_${stamp}.json`);
const setUnite = db.prepare("UPDATE articles SET unite = ?, updated_at = datetime('now') WHERE ref = ?");
const touches = [...changed, ...filled];
db.transaction(() => { for (const r of touches) setUnite.run(r.a, r.ref); })();
fs.mkdirSync(path.dirname(log), { recursive: true });
fs.writeFileSync(log, JSON.stringify({ applied_at: new Date().toISOString(), sauvegarde: `${path.basename(DB_PATH)}.bak-unites-${stamp}`, lignes: touches }, null, 2));
const restants = db.prepare("SELECT COUNT(*) c FROM articles WHERE actif=1 AND (unite IS NULL OR TRIM(unite)='')").get().c;
console.log(`\nAPPLIQUÉ — ${touches.length} lignes écrites, unité encore absente chez ${restants} actifs. Journal : ${path.relative(ROOT, log)}`);
db.close();
