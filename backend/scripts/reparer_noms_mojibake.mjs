// Répare les désignations encodées deux fois (UTF-8 relu en Latin-1) dans la base articles.
// Preuve : « Base article local 240926.xlsx » et « BASE ARTICLE SIA.xlsx » écrivent
// « CONE GLACE – MEHDI » et « BUN 5’’ NOUGATINE 48 » ; la base contient les octets
// E2 80 93 / E2 80 99 relus caractère par caractère. Le fichier source est propre : la
// correction porte sur la base, pas sur l'import.
// Réversible : sauvegarde de data.db + journal des avant/après dans rapports/.
// Usage: node backend/scripts/reparer_noms_mojibake.mjs [--apply]   (dry-run sans --apply)
import { fileURLToPath } from "url";
import path from "path";
import fs from "node:fs";
import Database from "better-sqlite3";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APPLY = process.argv.includes("--apply");
const db = new Database(path.join(ROOT, "backend", "data.db"));

const octets = (...codes) => codes.map((c) => String.fromCharCode(c)).join("");
// Œ = E2 80 93 (tiret demi-incise) ; ’ = E2 80 99 (apostrophe typographique) ;
// Â + NBSP = C2 A0 (espace insécable), et sa trace « Â » quand l'espace a été normalisé.
const TIRET = octets(0xe2, 0x80, 0x93);
const APOS = octets(0xe2, 0x80, 0x99);
const INSECABLE = octets(0xc2, 0xa0);
const A_ACCENTUE = octets(0xc2);

// Les apostrophes typographiques deviennent des apostrophes ASCII : c'est déjà l'écriture du
// fichier (« BUN 5'' NOUGATINE ») et de la liste d'articles de Pertes.
const SEQUENCES = [
  [APOS + APOS, "''"],
  [APOS, "'"],
  [TIRET, " - "],
  [INSECABLE, " "],
  [A_ACCENTUE + " ", " "],
];

// Le resserrement des espaces n'est appliqué qu'aux lignes effectivement réparées : un nom
// déjà propre (« WHOPPER PATTY  - Americana ») garde son écriture, l'ordre des lignes du
// classeur étant indexé sur la désignation.
const reparer = (v) => {
  const brut = String(v ?? "");
  const corrige = SEQUENCES.reduce((s, [de, a]) => s.split(de).join(a), brut);
  return corrige === brut ? brut : corrige.replace(/ {2,}/g, " ").trim();
};

const rows = db.prepare("SELECT ref, nom, code, unite, actif FROM articles").all();
const touches = rows.map((r) => ({ ...r, nouveau: reparer(r.nom) })).filter((r) => r.nouveau !== r.nom);

console.log(`articles : ${rows.length}, désignations à réparer : ${touches.length}`);
touches.forEach((r) => console.log(`   ${r.code} : ${JSON.stringify(r.nom)} → ${JSON.stringify(r.nouveau)}`));

const restants = rows.filter((r) => /[\u0080-\u009f\u00a0\u00c2]/.test(reparer(r.nom))).length;
console.log(`(contrôle) désignations contenant encore un caractère de contrôle C1 ou insécable : ${restants}`);

if (!APPLY) { console.log("\nDRY-RUN — aucune écriture. Relancer avec --apply."); db.close(); process.exit(0); }

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const DB_PATH = path.join(ROOT, "backend", "data.db");
fs.copyFileSync(DB_PATH, `${DB_PATH}.bak-mojibake-${stamp}`);
const setNom = db.prepare("UPDATE articles SET nom = ?, updated_at = datetime('now') WHERE ref = ?");
db.transaction(() => { for (const r of touches) setNom.run(r.nouveau, r.ref); })();
const log = path.join(ROOT, "rapports", `reparation_noms_mojibake_${stamp}.json`);
fs.writeFileSync(log, JSON.stringify({ applied_at: new Date().toISOString(), lignes: touches.map((r) => ({ ref: r.ref, de: r.nom, a: r.nouveau })) }, null, 2));
console.log(`\nAPPLIQUÉ — ${touches.length} désignations réparées. Journal : ${path.relative(ROOT, log)}`);
db.close();
