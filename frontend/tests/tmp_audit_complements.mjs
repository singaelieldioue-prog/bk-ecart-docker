// COMPLÉMENTS D'AUDIT — chiffres A-04/A-05/A-06 et répartition des catégories du fichier.
// Lecture seule. Exécution : node tests/tmp_audit_complements.mjs
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { createRequire } from "node:module";

const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(path.resolve("../backend/data.db"), { readonly: true, fileMustExist: true });
const charge = (k) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(k); return r ? JSON.parse(r.v) : null; };
const ratios = charge("bk_sia_ratios_parsed_v1") || {};
db.close();

const n = (v) => Number(v) || 0;
const byPlu = ratios.byPlu || {};
const plus = Object.entries(byPlu);
const avecCout = plus.filter(([, f]) => n(f.coutTheo) > 0);
const sansCout = plus.filter(([, f]) => !(n(f.coutTheo) > 0));
console.log(`Ratio byPlu : ${plus.length} | coût > 0 : ${avecCout.length} | coût 0/absent : ${sansCout.length}`);
console.log("coût 0 (5) : " + sansCout.slice(0, 5).map(([p, f]) => `${p} ${f.nom}`).join(" | "));

const w = byPlu["110"];
console.log(`PLU 110 : ${w ? `${w.nom} | coût ${Math.round(n(w.coutTheo))} | PV ${Math.round(n(w.price))} | marge ${Math.round(n(w.price) - n(w.coutTheo))}` : "absent"}`);

const wb = XLSX.read(fs.readFileSync(path.resolve("../tmp_verif/Suivi_BK1_Octobre_2026.xlsx")), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Inventaire Initial"], { header: 1, defval: null });
const ini = rows.slice(6).filter((r) => r[2] && String(r[2]).trim());
const articles = ini.filter((r) => r[0] && String(r[0]).trim());
const byCat = {};
for (const r of articles) { const c = String(r[0]).trim(); byCat[c] = (byCat[c] || 0) + 1; }
console.log("catégories : " + JSON.stringify(byCat));
const horsEcart = articles.filter((r) => /^(pmc|ifb|packaging)$/i.test(String(r[0]).trim()));
console.log(`articles PMC/IFB/PACKAGING dans le fichier : ${horsEcart.length}`);
const absurde = articles.filter((r) => n(r[3]) > 1000);
console.log(`colisage > 1000 : ${absurde.length} → ` + absurde.slice(0, 6).map((r) => `${r[2]} (${Math.round(n(r[3]))})`).join(" | "));

// A-06 : structure du Ratio actif — pourquoi 104 produits et 87 byPlu ?
console.log("clés du Ratio : " + Object.keys(ratios).join(", "));
for (const k of ["products", "produits", "menus", "pluList", "byNom"]) {
  if (Array.isArray(ratios[k])) console.log(`   ${k} : ${ratios[k].length}`);
}
const sansCoutListe = (ratios.produits || ratios.products || []).filter((p) => !(n(p.coutTheo) > 0));
if (sansCoutListe.length) console.log(`produits sans coût dans le Ratio : ${sansCoutListe.length} → ` + sansCoutListe.slice(0, 6).map((p) => `${p.plu || p.code || "?"} ${p.nom || ""}`).join(" | "));

console.log(`allProducts : ${(ratios.allProducts || []).length} | byNom : ${Object.keys(ratios.byNom || {}).length}`);
const ap = ratios.allProducts || [];
const apSansCout = ap.filter((p) => !(n(p.coutTheo) > 0));
console.log(`allProducts sans coût : ${apSansCout.length}`);
console.log("sans coût (8) : " + apSansCout.slice(0, 8).map((p) => `${p.plu != null ? p.plu : p.code} ${p.nom}`).join(" | "));
const apSansPlu = ap.filter((p) => p.plu == null || String(p.plu).trim() === "");
console.log(`allProducts sans PLU : ${apSansPlu.length}`);

const apPlu = ap.filter((p) => p.plu != null && String(p.plu).trim() !== "").map((p) => String(p.plu).trim());
const manquants = apPlu.filter((p) => !byPlu[p]);
const doublons = apPlu.filter((p, i) => apPlu.indexOf(p) !== i);
console.log(`allProducts avec PLU : ${apPlu.length} | PLU absents de byPlu : ${manquants.length} (${[...new Set(manquants)].join(",")}) | PLU en doublon : ${[...new Set(doublons)].join(",")}`);

const absCat = {};
for (const r of absurde) { const c = String(r[0]).trim(); absCat[c] = (absCat[c] || 0) + 1; }
console.log("colisage > 1000 par catégorie : " + JSON.stringify(absCat));
const avecPv = plus.filter(([, f]) => n(f.price) > 0);
console.log(`PLU avec PV > 0 : ${avecPv.length}/${plus.length}`);
