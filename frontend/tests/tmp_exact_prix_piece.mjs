// Sonde lecture seule : cohérence entre les prix de la référence du CDG (Perte_Q1 2026,
// Prix carton ÷ Cond. = prix de l'unité de perte) et le prix pièce de notre base articles
// (backend/data.db, nom normalisé exact). Mesure l'écart pour 186 lignes prix-à-prix.
// Exécution : node tests/tmp_exact_prix_piece.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { PERTES_REFERENTIEL_CDG } from "../src/utils/pertesReferentielCdg.js";
const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const arts = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif FROM articles").all();
const parNom = new Map();
arts.forEach((a) => { const k = norm(a.nom); if (k && !parNom.has(k)) parNom.set(k, a); });
const rows = PERTES_REFERENTIEL_CDG.filter((t) => t.pu !== undefined);
let dansBase = 0, idem = 0, ecart = [];
rows.forEach((t) => {
  const a = parNom.get(norm(t.nom));
  if (!a) return;
  dansBase++;
  const cdg = t.pu / t.cond;
  const notre = Number(a.pu_piece) > 0 ? Number(a.pu_piece) : (Number(a.conditionnement) > 0 ? a.pu_carton / a.conditionnement : 0);
  if (!(notre > 0)) { ecart.push([t.nom, cdg, notre, "sans prix pièce"]); return; }
  const rel = Math.abs(cdg - notre) / cdg;
  if (rel < 0.005) idem++;
  else ecart.push([t.nom, +cdg.toFixed(2), +notre.toFixed(2), +((rel) * 100).toFixed(1), a.conditionnement, t.cond]);
});
console.log(`lignes de la référence avec prix : ${rows.length} | retrouvées en base (nom exact) : ${dansBase} | prix pièce d accord (±0,5 %) : ${idem}`);
console.log(`\n── écarts de prix pièce (${ecart.length}) ──`);
ecart.forEach((e) => console.log(`  ${String(e[0]).padEnd(34)} CDG ${String(e[1]).padStart(10)} | base ${String(e[2]).padStart(10)} | ${String(e[3]).padStart(6)} % | cond. base ${String(e[4] ?? "-")} vs table ${String(e[5] ?? "-")}`));
const absents = rows.filter((t) => !parNom.has(norm(t.nom)));
console.log(`\n── lignes de la référence absentes de la base (nom exact) : ${absents.length} ──`);
absents.forEach((t) => console.log(`  [${t.cat}] ${t.nom} — cond. ${t.cond}, pu ${t.pu}`));
