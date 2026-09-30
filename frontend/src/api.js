// ─────────────────────────────────────────────────────────────────────────────
//  Client API pour l'application BK Écart Matières.
//  À copier dans le projet front sous src/api.js
//  L'URL de base se règle via la variable d'environnement Vite VITE_API_URL
//  (par défaut "/api", à servir derrière le même nginx que le front).
// ─────────────────────────────────────────────────────────────────────────────

const BASE = (import.meta.env && import.meta.env.VITE_API_URL) || '/api';

let token = localStorage.getItem('bk_token') || null;
let currentUser = JSON.parse(localStorage.getItem('bk_user') || 'null');

export function getUser() { return currentUser; }
export function isLogged() { return !!token; }

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) { logout(); throw new Error('Session expirée, reconnectez-vous.'); }
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || 'Erreur serveur');
  }
  return res.status === 204 ? null : res.json();
}

export async function login(username, password) {
  const d = await req('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  token = d.token; currentUser = d.user;
  localStorage.setItem('bk_token', token);
  localStorage.setItem('bk_user', JSON.stringify(currentUser));
  return currentUser;
}

export function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('bk_token');
  localStorage.removeItem('bk_user');
}

// Rapports
// listReports({ page, limit }) → renvoie { items, total, totalPages, hasMore }
// lean=1 par défaut (pas de stockData dans la liste, très rapide)
export const listReports  = (params = {}) => {
  const q = new URLSearchParams({ page: 1, limit: 50, lean: 1, ...params }).toString();
  return req('/reports?' + q);
};
export const getReport    = (id)        => req('/reports/' + id); // rapport complet (avec data/stockData)
export const createReport = (rep)       => req('/reports', { method: 'POST', body: JSON.stringify(rep) });
export const updateReport = (id, rep)   => req('/reports/' + id, { method: 'PUT', body: JSON.stringify(rep) });
export const deleteReport = (id)        => req('/reports/' + id, { method: 'DELETE' });
// Import en masse depuis une sauvegarde JSON (restauration persistante en BDD)
export const importReports = (rapports) => req('/reports/import', { method: 'POST', body: JSON.stringify({ rapports }) });

// Workflow : action ∈ submit_daf | daf_approve | daf_reject | submit_dg | dg_approve | dg_reject | reopen
export const transition   = (id, action, commentaire) =>
  req('/reports/' + id + '/transition', { method: 'POST', body: JSON.stringify({ action, commentaire }) });

// Correspondance « statut d'arrivée » -> « action », pour brancher facilement
// les boutons existants du client (qui envoient un next status).
export const STATUS_TO_ACTION = {
  submitted_to_daf: 'submit_daf',
  daf_approved:     'daf_approve',
  daf_rejected:     'daf_reject',
  submitted_to_dg:  'submit_dg',
  dg_approved:      'dg_approve',
  dg_rejected:      'dg_reject',
  draft:            'reopen',
};

// Référentiels partagés (Ratios / LTO) via l'espace clé/valeur du serveur.
export const kvGet = (key)        => req('/kv/' + encodeURIComponent(key));
export const kvSet = (key, value) => req('/kv/' + encodeURIComponent(key), { method: 'PUT', body: JSON.stringify({ value }) });

// Référentiel ARTICLES (base unique partagée)
export const articlesList = (q = {}) => {
  const qs = new URLSearchParams(q).toString();
  return req('/articles' + (qs ? '?' + qs : ''));
};
export async function articlesListAll(q = {}) {
  const data = await articlesList(q);
  return Array.isArray(data) ? data : data?.items || [];
}
// dryRun=true → aperçu du diff ; dryRun=false → applique et renvoie le récapitulatif
export const articlesSync = (articles, source, dryRun = false) =>
  req('/articles/sync', { method: 'POST', body: JSON.stringify({ articles, source, dryRun }) });
export const articlesUpsert = (article) =>
  req('/articles/upsert', { method: 'POST', body: JSON.stringify({ article }) });

// Restaurants (liste des BK)
export const restaurantsList  = (q = {}) => { const qs = new URLSearchParams(q).toString(); return req('/restaurants' + (qs ? '?' + qs : '')); };
export const restaurantCreate = (code, nom) => req('/restaurants', { method: 'POST', body: JSON.stringify({ code, nom }) });
export const restaurantUpdate = (id, patch)  => req('/restaurants/' + id, { method: 'PUT', body: JSON.stringify(patch) });
