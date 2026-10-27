// Désactive les lignes sans désignation réelle ET sans prix (capture CDG du 25/10
// « ELEMENT A SUPRIMER » : CHEDBRI360, CHEDBRI12, TOMAREH00… nom = code, prix 0).
// La règle est celle de la synchronisation (isLigneSansValeur) : nom et code comparés
// après normalisation, donc « BKCI-PMC124 » / code « BKCI PMC124 » compte aussi sans nom.
// Réversible : la liste est journalisée dans rapports/ et chaque ligne garde son contenu.
// Usage: node backend/scripts/desactiver_lignes_sans_prix.mjs [--apply]   (dry-run sans --apply)
import { fileURLToPath } from "url";
import path from "path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { isLigneSansValeur } from "../src/articles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APPLY = process.argv.includes("--apply");
const db = new Database(path.join(ROOT, "backend", "data.db"));

const candidats = db.prepare(`
  SELECT ref, nom, code, categorie, unite, conditionnement, pu_carton, pu_piece, source
  FROM articles WHERE actif = 1 ORDER BY categorie, code
`).all();
const aUnPrix = (r) => [r.pu_carton, r.pu_piece].some((v) => Number(v) > 0);
// Règle 2 : ligne d'essai créée à la main (catégorie « Test » ou code « TEST… ») et jamais
// tarifée. Elle n'a rien à faire dans un référentiel livré au DAF — capture « ELEMENT A SUPRIMER ».
const estLigneTest = (r) => !aUnPrix(r) &&
  (/^test/i.test(String(r.code ?? "").trim()) || /^test$/i.test(String(r.categorie ?? "").trim()));
const rows = candidats.filter((r) => isLigneSansValeur(null, r) || estLigneTest(r));
const tests = candidats.filter(estLigneTest);

const actifs = db.prepare("SELECT COUNT(*) c FROM articles WHERE actif=1").get().c;
console.log(`articles actifs avant : ${actifs}`);
console.log(`lignes sans désignation et sans prix : ${rows.length - tests.length}`);
console.log(`lignes de test sans prix : ${tests.length}`);
rows.forEach((r) => console.log(`   ${String(r.categorie || "-").padEnd(22)} ${r.code.padEnd(14)} nom=${JSON.stringify(r.nom)} unite=${JSON.stringify(r.unite)} cond=${r.conditionnement} source=${r.source}`));

const sansNomAvecPrix = candidats.filter((r) => {
  const cle = (v) => [...String(v ?? "").normalize("NFD")].filter((c) => /[A-Za-z0-9]/.test(c)).join("").toUpperCase();
  return aUnPrix(r) && (!cle(r.nom) || cle(r.nom) === cle(r.code));
}).length;
console.log(`(contrôle) lignes sans désignation réelle MAIS avec un prix, conservées : ${sansNomAvecPrix}`);

if (!APPLY) { console.log("\nDRY-RUN — aucune écriture. Relancer avec --apply."); db.close(); process.exit(0); }

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const log = path.join(ROOT, "rapports", `desactivation_sans_prix_${stamp}.json`);
const deactivate = db.prepare("UPDATE articles SET actif = 0, updated_at = datetime('now') WHERE ref = ?");
const tx = db.transaction(() => { for (const r of rows) deactivate.run(r.ref); });
tx();
fs.mkdirSync(path.dirname(log), { recursive: true });
fs.writeFileSync(log, JSON.stringify({ applied_at: new Date().toISOString(), refs: rows.map((r) => r.ref), lignes: rows }, null, 2));
const apres = db.prepare("SELECT COUNT(*) c FROM articles WHERE actif=1").get().c;
console.log(`\nAPPLIQUÉ — actifs : ${actifs} → ${apres}. Journal : ${path.relative(ROOT, log)}`);
console.log("Pour rétablir : UPDATE articles SET actif=1 WHERE ref IN (…) depuis le journal.");
db.close();
