// Fusionne les lignes identiques (même code article) que la synchronisation a pu créer sous
// deux refs : le ref est le nom normalisé, donc un renommage dans le fichier source insère une
// doublure au lieu de renommer la ligne existante.
// C'est la maintenance déjà jouée au démarrage du backend (db.js -> repairDuplicateArticles) ;
// ce script l'expose avec un journal des lignes supprimées, car la fonction ne journalise pas.
// Usage : node scripts/fusionner_doublons_code.mjs [--apply]   (dry-run sans --apply)
import { fileURLToPath } from "url";
import path from "path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { repairDuplicateArticles } from "../src/articles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APPLY = process.argv.includes("--apply");
const db = new Database(path.join(ROOT, "backend", "data.db"));

const avant = db.prepare("SELECT * FROM articles").all();
const parCode = new Map();
for (const r of avant) {
  const c = String(r.code ?? "").toUpperCase().replace(/\s+/g, "");
  if (!c) continue;
  (parCode.get(c) || parCode.set(c, []).get(c)).push(r);
}
const doubles = [...parCode.values()].filter((g) => g.length > 1);
console.log(`lignes : ${avant.length} | codes en doublon : ${doubles.length} | lignes concernées : ${doubles.reduce((s, g) => s + g.length, 0)}`);
for (const g of doubles.slice(0, 10)) console.log(`   ${g[0].code} :: ${g.map((r) => `${r.nom} (actif=${r.actif}, carton=${r.pu_carton ?? "-"}, cond=${r.conditionnement ?? "-"})`).join(" // ")}`);

if (!APPLY) { console.log("\nDRY-RUN — aucune écriture. Relancer avec --apply."); db.close(); process.exit(0); }

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const log = path.join(ROOT, "rapports", `doublons_codes_${stamp}.json`);
fs.mkdirSync(path.dirname(log), { recursive: true });
fs.writeFileSync(log, JSON.stringify({ applied_at: new Date().toISOString(), avant }, null, 1));
const supprimes = repairDuplicateArticles(db);
const apres = db.prepare("SELECT * FROM articles").all();
const restants = new Set(apres.map((r) => r.ref));
const journal = JSON.parse(fs.readFileSync(log, "utf-8")).avant.filter((r) => !restants.has(r.ref));
fs.writeFileSync(log, JSON.stringify({ applied_at: new Date().toISOString(), supprimees: journal, avant: JSON.parse(fs.readFileSync(log, "utf-8")).avant }, null, 1));
console.log(`\nAPPLIQUÉ — fusions : ${supprimes} | lignes : ${avant.length} → ${apres.length} | actifs : ${apres.filter((r) => r.actif === 1).length}`);
console.log(`Journal (lignes supprimées, restaurables par INSERT) : ${path.relative(ROOT, log)}`);
db.close();
