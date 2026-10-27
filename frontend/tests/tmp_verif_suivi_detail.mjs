// VÉRIF-SUIVI — dernières mesures (lecture seule) : écarts d'ordre, coûts PMIX, bloc bas des
// Transferts, textes d'aide complets.
// Exécution : node tests/tmp_verif_suivi_detail.mjs
import fs from "node:fs";

import * as XLSX from "xlsx";

const inv = JSON.parse(await fs.promises.readFile(new URL("../../tmp_verif/xml_inventory.json", import.meta.url), "utf8"));
const RACINE = new URL("../../", import.meta.url);

const wbEx = XLSX.read(fs.readFileSync(new URL("frontend/public/exemple inventaire.xlsx", RACINE)), { type: "buffer" });
const ex = XLSX.utils.sheet_to_json(wbEx.Sheets["inventaire"], { header: 1, defval: "" }).slice(6).filter((r) => r[3] && r[14]);
const gen = [];
for (let r = 7; r <= 324; r++) {
  const l = inv.feuilles["Inventaire Initial"].lignes[r] || {};
  gen.push({ r, code: String((l.N && l.N.v) || "").trim(), nom: String((l.C && l.C.v) || "").trim() });
}

console.log("═══ ÉCARTS D'ORDRE POSITION PAR POSITION ═══");
let diffs = 0;
for (let i = 0; i < 318; i++) {
  const e = ex[i], g = gen[i];
  const codeEx = String(e[14]).trim(), nomEx = String(e[3]).trim();
  if (codeEx.toLowerCase() !== g.code.toLowerCase()) {
    diffs++;
    if (diffs <= 20) console.log(`  ligne ${g.r} : exemple « ${codeEx} / ${nomEx} » → fichier « ${g.code || "(vide)"} / ${g.nom || "(vide)"} »`);
  }
}
console.log(`positions de code différentes : ${diffs}/318`);

console.log("\n═══ COÛTS PMIX ═══");
const pm = inv.feuilles["Référentiel PMIX"];
let couts = { zero: 0, un: 0, n: 0 }, cinqMille = [];
for (let r = 2; r <= 377; r++) {
  const l = pm.lignes[r];
  if (!l || !l.A) continue;
  couts.n++;
  const c = Number(l.C && l.C.v);
  if (c === 0) couts.zero++;
  if (c > 5000) cinqMille.push(`${l.A.v}:${l.B.v}=${c}`);
}
console.log(`PLU : ${couts.n} · coût nul : ${couts.zero} (${((couts.zero / couts.n) * 100).toFixed(1)} %) · coût > 5 000 F : ${couts.un}`);
console.log(`coûts > 5 000 F (PV TTC ?) : ${cinqMille.length} → ${cinqMille.slice(0, 10).join(", ")}`);
for (const plu of ["110", "706", "717", "400102"]) {
  let trouve = null;
  for (let r = 2; r <= 377; r++) {
    const l = pm.lignes[r];
    if (l && String(l.A.v).trim() === plu) trouve = `${l.B.v} = ${l.C.v} (ligne ${r})`;
  }
  console.log(`  PLU ${plu} : ${trouve || "ABSENT"}`);
}

console.log("\n═══ BLOC BAS DES TRANSFERTS (lignes 20005..20021) ═══");
const t = inv.feuilles.Transferts;
for (let r = 20004; r <= 20021; r++) {
  const l = t.lignes[r];
  if (!l) { console.log(`  ${r} : aucune cellule`); continue; }
  console.log(`  ${r} : ${Object.keys(l).sort().map((c) => `${c}=${JSON.stringify(String(l[c].v ?? "").slice(0, 34))}${l[c].f ? "{" + l[c].f.slice(0, 70) + "}" : ""}`).join(" | ").slice(0, 300)}`);
}

console.log("\n═══ TEXTES D'AIDE ═══");
for (const nom of ["Inventaire Initial", "Transferts", "Pertes", "P.Douane"]) {
  const f = inv.feuilles[nom];
  for (const [r, c] of [[3, "A"], [4, "A"], [2, "A"]]) {
    const l = f.lignes[r];
    if (l && l[c] && l[c].v) console.log(`  ${nom} ${c}${r} : « ${l[c].v} »`);
  }
}

console.log("\n═══ RÉPARTITION DES PRIX DANS LES INVENTAIRES ═══");
{
  const f = inv.feuilles["Inventaire Initial"];
  let nb = 0, somme = 0, max = 0, nonEntier = 0;
  for (let r = 7; r <= 324; r++) {
    const l = f.lignes[r] || {};
    const k = Number(l.K && l.K.v);
    if (l.K && String(l.K.v ?? "").trim() !== "") { nb++; somme += k; if (k > max) max = k; if (Math.abs(k - Math.round(k)) > 0.004) nonEntier++; }
  }
  console.log(`  prix carton écrits : ${nb} lignes (318) · somme ${somme.toFixed(0)} F · max ${max} F · non entiers ${nonEntier}`);
}
