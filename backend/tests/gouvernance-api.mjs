// SUITE DURABLE — Gouvernance de l'API (P2).
//  1. L'import d'une sauvegarde ne peut pas injecter un rapport déjà validé : le statut
//     d'entrée est forcé à « draft » et le circuit de validation reprend la main.
//  2. L'espace clé/valeur partagé n'est modifiable que par le CDG (ou l'admin).
//  3. La pagination refuse page/limit non entiers ou ≤ 0 avec un 400 JSON.
//  4. Une route inconnue répond 404 JSON, jamais du HTML.
// La suite travaille sur une base SQLite JETABLE (DB_PATH) : backend/data.db n'est jamais ouverte.
// Exécution : node tests/gouvernance-api.mjs
import path from 'path';
import fs from 'fs';
import os from 'os';
import { once } from 'events';
import jwt from 'jsonwebtoken';

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bk-api-"));
const dbPath = path.join(tmpDir, "test.db");
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "bk-api-test-secret";
process.env.BK_NO_LISTEN = "1";

const { app } = await import("../src/server.js");
const db = (await import("../src/db.js")).default;

const server = app.listen(0);
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
const token = (role) => jwt.sign({ sub: role, role, name: role.toUpperCase() }, "bk-api-test-secret", { expiresIn: "1h" });
const api = async (method, url, { role = "cdg", body } = {}) => {
  const r = await fetch(base + url, {
    method,
    headers: { Authorization: `Bearer ${token(role)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* laissé null : le test vérifie le JSON */ }
  return { status: r.status, type: r.headers.get("content-type") || "", json, text };
};

try {
  // ── 1. Import : statut forcé à brouillon ────────────────────────────────────
  const rapportValide = {
    id: "R-IMPORT-DG", titre: "Rapport validé DG", status: "dg_approved",
    data: { calc: { ca: 1 } }, history: [{ status: "dg_approved", actor: "dg", at: "2026-10-01T00:00:00.000Z" }],
  };
  const imp = await api("POST", "/api/reports/import", { body: { rapports: [rapportValide] } });
  check(imp.status === 200 && imp.json?.imported === 1, `import accepté (statut ${imp.status}, imported ${imp.json?.imported})`, imp.text);
  const back = await api("GET", "/api/reports/R-IMPORT-DG");
  check(back.status === 200 && back.json?.status === "draft",
    `un rapport importé « dg_approved » revient en brouillon (lu ${back.json?.status})`);
  const trace = Array.isArray(back.json?.history) ? back.json.history : [];
  check(trace.some((h) => /statut forcé à brouillon/i.test(h.commentaire || "")),
    "l'historique garde la trace du statut d'origine", JSON.stringify(trace));

  // ── 2. KV : écriture réservée au CDG / admin ────────────────────────────────
  const kvDaf = await api("PUT", "/api/kv/ratios", { role: "daf", body: { value: "{}" } });
  check(kvDaf.status === 403 && kvDaf.json?.error,
    `écriture KV refusée au DAF (statut ${kvDaf.status})`, kvDaf.text);
  const kvDg = await api("PUT", "/api/kv/ratios", { role: "dg", body: { value: "{}" } });
  check(kvDg.status === 403, `écriture KV refusée au DG (statut ${kvDg.status})`, kvDg.text);
  const kvCdg = await api("PUT", "/api/kv/ratios", { role: "cdg", body: { value: "{\"q\":3}" } });
  check(kvCdg.status === 200 && kvCdg.json?.value === "{\"q\":3}",
    `écriture KV acceptée au CDG (statut ${kvCdg.status})`, kvCdg.text);
  const kvAdmin = await api("PUT", "/api/kv/ratios", { role: "admin", body: { value: "{\"q\":4}" } });
  check(kvAdmin.status === 200, `écriture KV acceptée à l'admin (statut ${kvAdmin.status})`, kvAdmin.text);
  const kvGet = await api("GET", "/api/kv/ratios", { role: "daf" });
  check(kvGet.status === 200 && kvGet.json?.value === "{\"q\":4}", "lecture KV toujours partagée", kvGet.text);

  // ── 3. Pagination : entiers strictement positifs, sinon 400 JSON ────────────
  const bad = [
    ["page=abc", "page non numérique"],
    ["page=0", "page à zéro"],
    ["page=-1", "page négative"],
    ["limit=1.5", "limit décimale"],
    ["limit=0", "limit à zéro"],
    ["limit=-3", "limit négative"],
  ];
  for (const [qs, label] of bad) {
    const r = await api("GET", `/api/reports?${qs}`);
    check(r.status === 400 && r.type.includes("application/json") && r.json?.error,
      `GET /api/reports?${qs} → 400 JSON (${label}) : statut ${r.status}, type ${r.type}`, r.text);
  }
  const good = await api("GET", "/api/reports?page=1&limit=2");
  check(good.status === 200 && good.json?.page === 1 && good.json?.limit === 2,
    `pagination valide acceptée (statut ${good.status}, page ${good.json?.page}, limit ${good.json?.limit})`, good.text);
  const artBad = await api("GET", "/api/articles?page=abc");
  check(artBad.status === 400 && artBad.json?.error,
    `GET /api/articles?page=abc → 400 JSON (statut ${artBad.status})`, artBad.text);

  // ── 4. Route inconnue : 404 JSON ────────────────────────────────────────────
  const unknown = await api("GET", "/api/route-inconnue");
  check(unknown.status === 404 && unknown.type.includes("application/json") && unknown.json?.error,
    `route inconnue → 404 JSON (statut ${unknown.status}, type ${unknown.type})`, unknown.text);
} finally {
  server.close();
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`\n${ok} PASS / ${ko} FAIL`);
process.exit(ko ? 1 : 0);
