// Applique à la base article les prix et colisages saisis dans
// tmp_verif/Articles_sans_prix_2026-10-27.xlsx (valeurs relues dans tmp_verif/_lecture_prix.json).
// Écrit la table `articles` ET la carte KV `bk_sia_local_articles_v1` — celle que lit
// resoudrePrix (calculators.js:18) — comme le fait l'import « Base article locale » de l'app.
// Sauvegarde cohérente (db.backup) avant écriture ; journal avant/après dans rapports/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(ICI, '..');
const RACINE = path.resolve(BACKEND, '..');
const CLE_LOCAL = 'bk_sia_local_articles_v1';
const SOURCE = 'Articles sans prix CDG 27/10/2026';

// Rejeu hors de l'arborescence de dev (production) : --db=<sqlite> --entree=<json> --journal=<json>.
// Sans --entree, on lit tmp_verif/_lecture_prix.json ; à défaut le journal committé, dont les
// lignes « apres » suffisent à rejouer. Sans --db/DB_PATH, on écrit backend/data.db comme avant.
const argVal = (nom) => process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
const JOUR = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const ENTREE_TMP = path.join(RACINE, 'tmp_verif', '_lecture_prix.json');
const JOURNAL_REF = path.join(RACINE, 'rapports', 'application_prix_2026-10-27.json');
const HORS_DEV = Boolean(argVal('db') || process.env.DB_PATH);
const ENTREE = path.resolve(argVal('entree') || (fs.existsSync(ENTREE_TMP) ? ENTREE_TMP : JOURNAL_REF));
const CHEMIN_DB = path.resolve(argVal('db') || process.env.DB_PATH || path.join(BACKEND, 'data.db'));
const SAUVEGARDE = path.resolve(argVal('sauvegarde') || (HORS_DEV
  ? `${CHEMIN_DB}.bak-prix-${JOUR}.db`
  : path.join(BACKEND, 'data.backup-prix-20261027.db')));
const JOURNAL = path.resolve(argVal('journal') || (HORS_DEV
  ? path.join(path.dirname(CHEMIN_DB), `rejeu_prix_${JOUR}.json`)
  : JOURNAL_REF));

const norm = (s) => String(s ?? '').trim().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[\u2019'’]/g, '')
  .replace(/[^A-Z0-9\s]/gi, ' ').replace(/\s+/g, ' ').toUpperCase();
const arrondi = (v, d = 4) => { const p = 10 ** d; return Math.round(v * p) / p; };
const num = (v) => (Number.isFinite(Number(v)) && Number(v) !== 0 ? Number(v) : null);

if (!fs.existsSync(CHEMIN_DB)) {
  console.error('Base introuvable :', CHEMIN_DB);
  process.exit(1);
}
const brut = JSON.parse(fs.readFileSync(ENTREE, 'utf8'));
const lignes = Array.isArray(brut)
  ? brut
  : brut.lignes.map((l, i) => ({
      ligne: l.ligne_fichier ?? i + 1,
      code: l.code,
      nom: l.nom,
      cond: l.apres?.conditionnement ?? null,
      pu_carton_cell: l.apres?.pu_carton ?? null,
      pu_piece_cell: l.apres?.pu_piece ?? null,
      source: l.origine_fichier ?? null,
      colisage_maj: l.colisage_fichier ?? null,
    }));
console.log('Base   :', CHEMIN_DB);
console.log('Entrée :', ENTREE, `(${lignes.length} lignes)`);
const db = new Database(CHEMIN_DB);

if (!fs.existsSync(SAUVEGARDE)) await db.backup(SAUVEGARDE);
else console.log('Sauvegarde déjà présente, non écrasée :', SAUVEGARDE);

const kvLire = (k) => { const r = db.prepare('SELECT v FROM kv WHERE k = ?').get(k); return r ? JSON.parse(r.v) : null; };
const kv = {
  local: kvLire(CLE_LOCAL) || {},
  base: kvLire('bk_sia_base_article_map_v1') || {},
  ratios: kvLire('bk_sia_ratios_parsed_v1') || {},
};
// calculators.js vit dans le dépôt complet ; l'image backend ne le contient pas. Son absence
// n'empêche pas l'écriture, elle prive seulement le journal de la résolution avant/après.
let resoudrePrix = null;
try {
  ({ resoudrePrix } = await import(pathToFileURL(path.join(RACINE, 'frontend/src/utils/calculators.js')).href));
} catch {
  console.log('calculators.js absent — résolution avant/après non calculée');
}
const resoudre = (nom) => {
  if (!resoudrePrix) return null;
  const p = resoudrePrix(nom, kv.base, kv.ratios, kv.local);
  return { source: p.source, puPiece: p.puPiece ?? null, pmpCarton: p.pmpCarton ?? null, qteCdt: p.qteCdt ?? null };
};

// ── Appariement par code article, refus si ambigu ou absent ───────────────────────────
const parCode = db.prepare('SELECT * FROM articles WHERE code = ?');
const plan = [];
const problemes = [];
for (const l of lignes) {
  const arts = parCode.all(l.code);
  if (arts.length !== 1) { problemes.push({ code: l.code, nom: l.nom, trouve: arts.length }); continue; }
  const art = arts[0];
  const cond = Number(l.cond) > 0 ? Number(l.cond) : null;
  const carton = num(l.pu_carton_cell)
    ?? (num(l.pu_piece_cell) && cond ? arrondi(num(l.pu_piece_cell) * cond) : null);
  const piece = num(l.pu_piece_cell)
    ?? (carton && cond ? arrondi(carton / cond) : null);
  plan.push({
    ligne: l.ligne, art, cond, carton, piece,
    derive: !num(l.pu_carton_cell),
    origine: l.source || null,
    colisage_maj: l.colisage_maj || null,
    resolution_avant: resoudre(art.nom),
  });
}
if (problemes.length) {
  console.error('Appariement incomplet, aucune écriture :', problemes);
  process.exit(1);
}

// ── Écriture ─────────────────────────────────────────────────────────────────────────
const majArticle = db.prepare(`
  UPDATE articles
  SET conditionnement = ?, pu_carton = ?, pu_piece = ?, source = ?, updated_at = datetime('now')
  WHERE code = ?
`);
const majKv = db.prepare(`
  INSERT INTO kv (k, v, updated_at) VALUES (?, ?, datetime('now'))
  ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at
`);
const local = { ...kv.local };
const entreesKv = [];
const journal = [];

const tx = db.transaction(() => {
  for (const p of plan) {
    const a = p.art;
    const avant = { conditionnement: a.conditionnement, pu_carton: a.pu_carton, pu_piece: a.pu_piece, source: a.source };
    majArticle.run(p.cond, p.carton, p.piece, SOURCE, a.code);
    const cle = norm(a.nom);
    const av = kv.local[cle] || null;
    local[cle] = { nom: a.nom, code: a.code, unite: a.unite, cdt: p.cond, puPiece: p.piece, pmpCarton: p.carton, categorie: a.categorie };
    entreesKv.push({ cle, avant: av, apres: local[cle] });
    journal.push({
      ligne_fichier: p.ligne, code: a.code, ref: a.ref, nom: a.nom, categorie: a.categorie,
      avant, apres: { conditionnement: p.cond, pu_carton: p.carton, pu_piece: p.piece, source: SOURCE },
      prix_carton_derive: p.derive, origine_fichier: p.origine, colisage_fichier: p.colisage_maj,
      resolution_avant: p.resolution_avant,
    });
  }
  majKv.run(CLE_LOCAL, JSON.stringify(local));
});
tx();

// ── Contrôle après écriture ─────────────────────────────────────────────────────────
const kvApres = kvLire(CLE_LOCAL);
const apresResoudre = (nom) => {
  if (!resoudrePrix) return null;
  const p = resoudrePrix(nom, kv.base, kv.ratios, kvApres);
  return { source: p.source, puPiece: p.puPiece ?? null, pmpCarton: p.pmpCarton ?? null, qteCdt: p.qteCdt ?? null };
};
const sansCarton = (actifSeulement) => (actifSeulement
  ? db.prepare('SELECT COUNT(*) n FROM articles WHERE actif = 1 AND (pu_carton IS NULL OR pu_carton <= 0)').get().n
  : db.prepare('SELECT COUNT(*) n FROM articles WHERE pu_carton IS NULL OR pu_carton <= 0').get().n);

const controle = journal.map((j) => ({ ...j, resolution_apres: apresResoudre(j.nom) }));
const sortie = {
  date: new Date().toISOString(),
  fichier_source: path.join('tmp_verif', 'Articles_sans_prix_2026-10-27.xlsx'),
  sauvegarde: SAUVEGARDE,
  base: CHEMIN_DB,
  carte_kv: CLE_LOCAL,
  lignes_appliquees: journal.length,
  articles_actifs_sans_prix_carton: sansCarton(true),
  entrees_kv: entreesKv,
  lignes: controle,
};
fs.mkdirSync(path.dirname(JOURNAL), { recursive: true });
fs.writeFileSync(JOURNAL, JSON.stringify(sortie, null, 2), 'utf8');

console.log(`Sauvegarde     : ${SAUVEGARDE}`);
console.log(`Journal        : ${JOURNAL}`);
console.log(`Lignes écrites : ${journal.length}  (${journal.filter((j) => j.prix_carton_derive).length} prix carton dérivés du colisage)`);
console.log(`KV ${CLE_LOCAL} : ${Object.keys(kv.local).length} → ${Object.keys(kvApres).length} entrées`);
console.log('');
console.log('code'.padEnd(16), 'désignation'.padEnd(34), 'cond'.padStart(6), 'carton avant → après'.padStart(28), 'pièce'.padStart(12), 'résolution');
for (const j of controle) {
  const av = j.avant.pu_carton == null ? 'null' : j.avant.pu_carton.toFixed(2);
  const ap = j.apres.pu_carton == null ? 'null' : j.apres.pu_carton.toFixed(2);
  console.log(
    String(j.code).padEnd(16),
    String(j.nom).slice(0, 34).padEnd(34),
    String(j.avant.conditionnement ?? 'null') + '→' + String(j.apres.conditionnement),
    `${av} → ${ap}`.padStart(28),
    (j.apres.pu_piece == null ? 'null' : j.apres.pu_piece.toFixed(2)).padStart(12),
    `${j.resolution_avant?.source ?? 'n/d'} → ${j.resolution_apres?.source ?? 'n/d'}`
  );
}
console.log('');
console.log('Articles actifs sans prix carton après opération :', sansCarton(true));
db.close();
