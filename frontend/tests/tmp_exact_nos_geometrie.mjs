// SONDE lecture seule — géométrie détaillée (en-têtes + premières lignes) du classeur généré
// par le code courant, sur données réelles. Exécution : node tests/tmp_exact_nos_geometrie.mjs
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildModelesWb } from "../src/utils/excelExporter.js";
import { enrichirAvecBaseLocale } from "../src/utils/parsers.js";

const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(fileURLToPath(new URL("../../backend/data.db", import.meta.url)), { readonly: true });
const charge = (c) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(c); return r ? JSON.parse(r.v) : null; };
const norm = (s) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const wbx = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
const rows0 = XLSX.utils.sheet_to_json(wbx.Sheets.inventaire, { header: 1, defval: null });
const modele = rows0.slice(6).filter((r) => r[3] && r[14]).map((r) => ({ name: r[3], code: r[14], categorie: r[1] || "", conditionnement: typeof r[4] === "number" ? r[4] : 1, qteInner: typeof r[5] === "number" ? r[5] : 0, unite: r[10] || "" }));
const arts = db.prepare("SELECT nom, code, categorie, conditionnement, pu_carton, pu_piece, unite, actif, corresp FROM articles").all();
const byCode = new Map(), byName = new Map();
arts.forEach((a) => { if (a.code) byCode.set(norm(a.code), a); if (a.nom) byName.set(norm(a.nom), a); });
const ordered = enrichirAvecBaseLocale(modele.map((m) => {
  const s = byCode.get(norm(m.code)) || byName.get(norm(m.name));
  return { ...(s || {}), nom: m.name, code: m.code, categorie: m.categorie, conditionnement: m.conditionnement, qteInner: m.qteInner, unite: m.unite || s?.unite || "" };
}), charge("bk_sia_local_articles_v1") || {});

const wb = buildModelesWb(ordered, (charge("bk_sia_ratios_parsed_v1") || {}).allProducts || [], "BK1", "Octobre 2026", "", ["BK1"], charge("bk_sia_pmix_complement_v1") || {}, arts);
const MAXR = Number(process.argv[2] || 8);
wb.SheetNames.forEach((n) => {
  const ws = wb.Sheets[n];
  if (!ws["!ref"]) { console.log(`\n=== ${n} (vide)`); return; }
  const r = XLSX.utils.decode_range(ws["!ref"]);
  console.log(`\n=== ${n}  dimension=${ws["!ref"]}`);
  for (let rr = r.s.r; rr <= Math.min(r.s.r + MAXR - 1, r.e.r); rr++) {
    const cells = [];
    for (let c = r.s.c; c <= r.e.c; c++) {
      const a = XLSX.utils.encode_col(c) + (rr + 1);
      const x = ws[a];
      if (!x) continue;
      let v = x.f ? `=${x.f}` : x.v;
      if (typeof v === "string") v = v.replace(/\r?\n/g, " ").slice(0, 24);
      if (typeof v === "number") v = Math.round(v * 100) / 100;
      cells.push(`${a}:${v}`);
    }
    if (cells.length) console.log(`   L${rr + 1} | ${cells.join(" | ")}`.slice(0, 1400));
  }
});
