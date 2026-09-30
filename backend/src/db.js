import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { repairDuplicateArticles, repairZeroPriceArticles } from './articles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('cdg','daf','dg','admin')),
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id         TEXT PRIMARY KEY,
  titre      TEXT NOT NULL,
  status     TEXT NOT NULL,
  site       TEXT,
  data       TEXT NOT NULL,   -- JSON : calc, stockData, ratiosMeta, pmixList...
  history    TEXT NOT NULL,   -- JSON : tableau d'événements de workflow
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

CREATE TABLE IF NOT EXISTS articles (
  ref             TEXT PRIMARY KEY,   -- clé normalisée (désignation stock)
  nom             TEXT NOT NULL,
  code            TEXT,               -- Code article (Code Bolloré, colonne G du base article)
  unite           TEXT,               -- Unité (Carton, kg…) depuis le base article
  categorie       TEXT,
  conditionnement REAL,
  pu_carton       REAL,
  pu_piece        REAL,
  corresp         TEXT,               -- correspondance ratio/ingrédient
  statut          TEXT,               -- statut d'origine (fichier Ratio)
  actif           INTEGER NOT NULL DEFAULT 1,
  ordre_affichage REAL DEFAULT 0,
  source          TEXT,               -- label du Ratio de la dernière MAJ
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_articles_actif ON articles(actif);

CREATE TABLE IF NOT EXISTS restaurants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT UNIQUE NOT NULL,   -- code BK (ex. BK Cocody)
  nom        TEXT NOT NULL,
  actif      INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Migration douce : ajoute la colonne "code" si la base existait déjà sans elle.
try { db.exec('ALTER TABLE articles ADD COLUMN code TEXT'); } catch (e) { /* déjà présente */ }
try { db.exec('ALTER TABLE articles ADD COLUMN unite TEXT'); } catch (e) { /* déjà présente */ }
try { db.exec('ALTER TABLE articles ADD COLUMN ordre_affichage REAL DEFAULT 0'); } catch (e) { /* déjà présente */ }

// Crée les comptes par défaut si la table est vide.
export function seedUsers({ force = false } = {}) {
  if (force) db.exec('DELETE FROM users');
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return false;
  const seed = [
    ['cdg',   'Contrôleur de gestion',         'cdg',   process.env.SEED_CDG_PW   || 'cdg123'],
    ['daf',   'Directeur Administratif & Fin.', 'daf',   process.env.SEED_DAF_PW   || 'daf123'],
    ['dg',    'Directeur Général',             'dg',    process.env.SEED_DG_PW    || 'dg123'],
    ['admin', 'Administrateur',                'admin', process.env.SEED_ADMIN_PW || 'admin123'],
  ];
  const ins = db.prepare('INSERT INTO users (username,name,role,password_hash) VALUES (?,?,?,?)');
  const tx = db.transaction(() => { for (const [u, n, r, pw] of seed) ins.run(u, n, r, bcrypt.hashSync(pw, 10)); });
  tx();
  return true;
}

// Seed automatique au premier démarrage.
if (seedUsers()) {
  console.log('[db] Comptes par défaut créés : cdg / daf / dg / admin (mots de passe à changer).');
}

const duplicatesRemoved = repairDuplicateArticles(db);
if (duplicatesRemoved > 0) {
  console.log(`[db] Doublons articles fusionnés et supprimés : ${duplicatesRemoved} ligne(s).`);
}

const repaired = repairZeroPriceArticles(db);
if (repaired > 0) {
  console.log(`[db] Prix à 0 convertis en NULL : ${repaired} ligne(s). Aucune suppression.`);
}

export default db;
