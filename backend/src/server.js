import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import db from './db.js';
import { login, requireAuth, requireRole } from './auth.js';
import { checkTransition, allowedActions } from './workflow.js';
import { computeDiff, applySync, listArticles, upsertOne } from './articles.js';

const app = express();
const corsOrigin = process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.trim();
app.use(cors({ origin: corsOrigin || false }));
app.use(express.json({ limit: '25mb' })); // les rapports (avec stockData) peuvent être volumineux

const safeJsonParse = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
};

// ─── Santé ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ─── Authentification ────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const r = login(username, password);
  if (!r) return res.status(401).json({ error: 'Identifiants incorrects' });
  res.json(r);
});

app.get('/api/auth/me', requireAuth, (req, res) =>
  res.json({ user: { username: req.user.sub, role: req.user.role, name: req.user.name } })
);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const rowToReport = (row) => row && ({
  id: row.id,
  titre: row.titre,
  status: row.status,
  site: row.site,
  data: safeJsonParse(row.data, {}),
  history: safeJsonParse(row.history, []),
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Version allégée (sans data/stockData) pour les listes paginées
const rowToReportLean = (row) => row && ({
  id: row.id,
  titre: row.titre,
  status: row.status,
  site: row.site,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  // On expose uniquement les champs de calcul synthétiques (pas le stockData brut)
  data: (() => {
    const d = safeJsonParse(row.data, null);
    if (!d) return null;
    return {
      site: d.site,
      isMulti: d.isMulti || false,
      dateLabel: d.dateLabel,
      calc: d.calc ? {
        ca: d.calc.ca,
        consoTheoTotal: d.calc.consoTheoTotal,
        consoReelle: d.calc.consoReelle,
        ecartMatiereP: d.calc.ecartMatiereP,
        ecartMatiere: d.calc.ecartMatiere,
        couverts: d.calc.couverts,
        ficheMatchees: d.calc.ficheMatchees,
      } : null,
    };
  })(),
  history: safeJsonParse(row.history, []),
});

const withActions = (rep, role) => ({ ...rep, _actions: allowedActions(rep.status, role) });
const getRow = (id) => db.prepare('SELECT * FROM reports WHERE id = ?').get(id);

// ─── Rapports : lecture partagée par tous les utilisateurs authentifiés ───────
// Supporte la pagination : ?page=1&limit=20&lean=1
// lean=1 (défaut pour les listes) → exclut le stockData volumineux
// lean=0 → retourne tout (pour la compatibilité ascendante)
app.get('/api/reports', requireAuth, (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
  const lean  = req.query.lean !== '0'; // lean=1 par défaut
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) AS n FROM reports').get().n;
  const rows  = db.prepare(
    'SELECT * FROM reports ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);

  const converter = lean ? rowToReportLean : rowToReport;
  res.json({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasMore: offset + rows.length < total,
    items: rows.map((r) => withActions(converter(r), req.user.role)),
  });
});

app.get('/api/reports/:id', requireAuth, (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Rapport introuvable' });
  res.json(withActions(rowToReport(row), req.user.role));
});

// Création — réservée au CDG (ou admin)
app.post('/api/reports', requireAuth, requireRole('cdg'), (req, res) => {
  const { titre, data, site } = req.body || {};
  if (!titre || !data) return res.status(400).json({ error: 'Champs « titre » et « data » requis' });
  const id = req.body.id ? String(req.body.id) : randomUUID();
  if (getRow(id)) return res.status(409).json({ error: 'Un rapport avec cet id existe déjà' });
  const history = [{ status: 'draft', actor: req.user.role, at: new Date().toISOString(), commentaire: 'Rapport créé' }];
  db.prepare('INSERT INTO reports (id,titre,status,site,data,history,created_by) VALUES (?,?,?,?,?,?,?)')
    .run(id, titre, 'draft', site || null, JSON.stringify(data), JSON.stringify(history), req.user.sub);
  res.status(201).json(withActions(rowToReport(getRow(id)), req.user.role));
});

// ─── Import (restauration) en masse depuis une sauvegarde JSON ─────────────
// POST /api/reports/import
// Body : { rapports: [...] }
// Comportement : INSERT OR IGNORE (ne remplace PAS les rapports existants)
//   → skipped : rapports dont l'id existait déjà
//   → imported : rapports effectivement insérés
app.post('/api/reports/import', requireAuth, requireRole('cdg'), (req, res) => {
  const { rapports } = req.body || {};
  if (!Array.isArray(rapports) || rapports.length === 0)
    return res.status(400).json({ error: 'Le champ « rapports » doit être un tableau non vide' });

  let imported = 0;
  let skipped  = 0;
  const errors = [];

  // Transaction atomique — tout passe ou rien
  const insertMany = db.transaction((list) => {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO reports (id,titre,status,site,data,history,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
    );
    for (const r of list) {
      try {
        if (!r.id || !r.titre || !r.data) { errors.push({ id: r.id, reason: 'Champs obligatoires manquants' }); continue; }
        const info = stmt.run(
          String(r.id),
          r.titre,
          r.status || 'draft',
          r.site || null,
          typeof r.data === 'string' ? r.data : JSON.stringify(r.data),
          Array.isArray(r.history) ? JSON.stringify(r.history) : JSON.stringify([]),
          r.createdBy || req.user.sub,
          r.createdAt || new Date().toISOString(),
          r.updatedAt || new Date().toISOString()
        );
        if (info.changes === 0) skipped++;
        else imported++;
      } catch (e) {
        errors.push({ id: r.id, reason: e.message });
      }
    }
  });

  try {
    insertMany(rapports);
    res.json({ imported, skipped, errors, total: rapports.length });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de l\'import : ' + e.message });
  }
});


// Mise à jour du contenu — CDG (ou admin), uniquement tant que le rapport est en brouillon
app.put('/api/reports/:id', requireAuth, requireRole('cdg'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Rapport introuvable' });
  if (row.status !== 'draft' && req.user.role !== 'admin')
    return res.status(409).json({ error: 'Modifiable uniquement à l’état brouillon' });
  const { titre, data, site } = req.body || {};
  db.prepare(
    "UPDATE reports SET titre = COALESCE(?,titre), site = COALESCE(?,site), data = COALESCE(?,data), updated_at = datetime('now') WHERE id = ?"
  ).run(titre ?? null, site ?? null, data ? JSON.stringify(data) : null, req.params.id);
  res.json(withActions(rowToReport(getRow(req.params.id)), req.user.role));
});

// Transition de workflow — le rôle et le statut de départ sont validés côté serveur
app.post('/api/reports/:id/transition', requireAuth, (req, res) => {
  const { action, commentaire } = req.body || {};
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Rapport introuvable' });
  const chk = checkTransition(action, row.status, req.user.role);
  if (!chk.ok) return res.status(chk.code).json({ error: chk.error });
  const history = JSON.parse(row.history);
  history.push({ status: chk.to, actor: req.user.role, at: new Date().toISOString(), commentaire: commentaire || '' });
  db.prepare("UPDATE reports SET status = ?, history = ?, updated_at = datetime('now') WHERE id = ?")
    .run(chk.to, JSON.stringify(history), req.params.id);
  res.json(withActions(rowToReport(getRow(req.params.id)), req.user.role));
});

// Suppression — admin, ou CDG tant que le rapport est en brouillon
app.delete('/api/reports/:id', requireAuth, (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Rapport introuvable' });
  const allowed = req.user.role === 'admin' || (req.user.role === 'cdg' && row.status === 'draft');
  if (!allowed) return res.status(403).json({ error: 'Suppression non autorisée pour ce statut/rôle' });
  db.prepare('DELETE FROM reports WHERE id = ?').run(req.params.id);
  res.json({ id: req.params.id, deleted: true });
});

// ─── Restaurants (liste des BK, gérée par le CDG) ────────────────────────────
app.get('/api/restaurants', requireAuth, (req, res) => {
  const all = req.query.actif === 'all';
  res.json(db.prepare(`SELECT * FROM restaurants ${all ? '' : 'WHERE actif=1'} ORDER BY nom`).all());
});
app.post('/api/restaurants', requireAuth, requireRole('cdg'), (req, res) => {
  const { code, nom } = req.body || {};
  if (!code || !nom) return res.status(400).json({ error: 'code et nom requis' });
  try {
    const info = db.prepare('INSERT INTO restaurants (code,nom) VALUES (?,?)').run(String(code).trim(), String(nom).trim());
    res.status(201).json(db.prepare('SELECT * FROM restaurants WHERE id=?').get(info.lastInsertRowid));
  } catch (e) {
    res.status(409).json({ error: 'Un restaurant avec ce code existe déjà' });
  }
});
app.put('/api/restaurants/:id', requireAuth, requireRole('cdg'), (req, res) => {
  const row = db.prepare('SELECT * FROM restaurants WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Restaurant introuvable' });
  const { nom, actif } = req.body || {};
  db.prepare('UPDATE restaurants SET nom=COALESCE(?,nom), actif=COALESCE(?,actif) WHERE id=?')
    .run(nom ?? null, (actif === 0 || actif === 1) ? actif : null, req.params.id);
  res.json(db.prepare('SELECT * FROM restaurants WHERE id=?').get(req.params.id));
});

// ─── Référentiel ARTICLES (base unique, partagée) ────────────────────────────
app.get('/api/articles', requireAuth, (req, res) => {
  try {
    const page = req.query.page !== undefined ? Number(req.query.page) : null;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : null;
    const result = listArticles(db, {
      actif: req.query.actif ?? 'all',
      search: req.query.search ?? '',
      categorie: req.query.categorie ?? '',
      page,
      limit,
    });

    if (page !== null || limit !== null) {
      return res.json(result);
    }

    return res.json(result.items);
  } catch (e) {
    console.error('[articles list error]', e);
    res.status(500).json({ error: 'Erreur récupération articles : ' + e.message });
  }
});

// Synchronisation depuis un nouveau Ratio.
//   dryRun=true  → renvoie le diff (aperçu) sans rien modifier
//   dryRun=false → applique et renvoie le récapitulatif
app.post('/api/articles/sync', requireAuth, requireRole('cdg'), (req, res) => {
  try {
    const { articles = [], source = null, dryRun = false } = req.body || {};
    if (!Array.isArray(articles)) return res.status(400).json({ error: '« articles » doit être un tableau' });
    if (dryRun) return res.json(computeDiff(db, articles));
    res.json({ applied: true, counts: applySync(db, articles, source) });
  } catch (e) {
    console.error('[articles/sync error]', e);
    res.status(500).json({ error: 'Erreur synchronisation articles : ' + e.message });
  }
});

// Ajout / modification manuelle d'UN article, sans toucher au reste du référentiel
// (utilisé par l'écran de gestion du base article).
app.post('/api/articles/upsert', requireAuth, requireRole('cdg'), (req, res) => {
  const { article } = req.body || {};
  if (!article || !article.ref) return res.status(400).json({ error: 'article.ref requis' });
  try {
    res.json({ applied: true, article: upsertOne(db, article, article.source || 'manuel') });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── (Optionnel) petit espace clé/valeur partagé pour Ratios & fiches LTO ─────
// Permet de partager aussi les référentiels entre postes, sans toucher au workflow.
db.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));`);
app.get('/api/kv/:key', requireAuth, (req, res) => {
  const row = db.prepare('SELECT v FROM kv WHERE k = ?').get(req.params.key);
  res.json(row ? { key: req.params.key, value: row.v } : null);
});
app.put('/api/kv/:key', requireAuth, (req, res) => {
  const b = req.body;
  const value = typeof b === 'string' ? b
    : (b && typeof b.value === 'string') ? b.value      // {value:"<json>"} → stocker tel quel
    : JSON.stringify(b?.value ?? b);
  db.prepare("INSERT INTO kv (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = datetime('now')")
    .run(req.params.key, value);
  res.json({ key: req.params.key, value });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`[bk-ecart-backend] écoute sur http://127.0.0.1:${PORT}`));
