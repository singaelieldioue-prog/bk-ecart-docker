// VÉRIF-SUIVI — ordre du modèle vs « exemple inventaire », récap Transferts, et cache de
// calcul (aucune valeur écrite dans les cellules de formule). Lecture seule.
// Exécution : node tests/tmp_verif_suivi_ordre.mjs
import fs from "node:fs";

import * as XLSX from "xlsx";
import JSZip from "jszip";

const RACINE = new URL("../../", import.meta.url);
const inv = JSON.parse(await fs.promises.readFile(new URL("../../tmp_verif/xml_inventory.json", import.meta.url), "utf8"));

// ── 1. ordre des lignes d'inventaire vs fichier d'exemple ───────────────────────
const wbEx = XLSX.read(fs.readFileSync(new URL("frontend/public/exemple inventaire.xlsx", RACINE)), { type: "buffer" });
const rowsEx = XLSX.utils.sheet_to_json(wbEx.Sheets["inventaire"], { header: 1, defval: "" });
const ex = rowsEx.slice(6).filter((r) => r[3] && r[14]).map((r) => ({ nom: String(r[3]).trim(), code: String(r[14]).trim() }));
const gen = [];
for (let r = 7; r <= 324; r++) {
  const l = inv.feuilles["Inventaire Initial"].lignes[r] || {};
  gen.push({ nom: String((l.C && l.C.v) || "").trim(), code: String((l.N && l.N.v) || "").trim() });
}
console.log("═══ ORDRE ═══");
console.log(`exemple : ${ex.length} lignes | généré : ${gen.length} lignes`);
let memeCode = 0, memeNom = 0, codeManquant = [];
const codesEx = new Set(ex.map((x) => x.code.toLowerCase()));
const codesGen = new Set(gen.map((g) => g.code.toLowerCase()).filter(Boolean));
for (let i = 0; i < Math.max(ex.length, gen.length); i++) {
  if (ex[i] && gen[i] && ex[i].code.toLowerCase() === gen[i].code.toLowerCase()) memeCode++;
  if (ex[i] && gen[i] && ex[i].nom === gen[i].nom) memeNom++;
}
codeManquant = [...ex].filter((x) => !codesGen.has(x.code.toLowerCase())).map((x) => `${x.code} (${x.nom})`);
const enTrop = [...gen].filter((g) => g.code && !codesEx.has(g.code.toLowerCase())).map((g) => `${g.code} (${g.nom})`);
console.log(`position par position : codes identiques ${memeCode}/${Math.min(ex.length, gen.length)} · noms identiques ${memeNom}`);
console.log(`codes de l'exemple absents du fichier généré : ${codeManquant.length} → ${codeManquant.slice(0, 20).join(", ")}`);
console.log(`codes présents dans le fichier et pas dans l'exemple : ${enTrop.length} → ${enTrop.slice(0, 20).join(", ")}`);

// ── 2. récap Transferts (N/O) : catégories et variantes BK ──────────────────────
console.log("\n═══ RÉCAP TRANSFERTS ═══");
const t = inv.feuilles.Transferts;
for (let r = 6; r <= 40; r++) {
  const l = t.lignes[r];
  if (!l || !l.N) continue;
  console.log(`  ${r} · N=${JSON.stringify(String(l.N.v ?? "").slice(0, 46))} · O=${JSON.stringify(String(l.O?.v ?? "").slice(0, 20))}${l.O?.f ? " {" + l.O.f.slice(0, 120) + "}" : ""}`);
}

// ── 3. valeurs en cache dans les cellules de formule ────────────────────────────
console.log("\n═══ CACHE DE CALCUL ═══");
const zip = await JSZip.loadAsync(fs.readFileSync(new URL("tmp_verif/Suivi_BK1_Octobre_2026.xlsx", RACINE)));
let total = 0;
for (const [nom, f] of Object.entries(inv.feuilles)) {
  const xml = await zip.file(f.chemin).async("string");
  let formules = 0, avecV = 0;
  for (const m of xml.matchAll(/<c\b[^>]*>([\s\S]*?)<\/c>/g)) {
    if (!/<f[\s>]/.test(m[1])) continue;
    formules++;
    if (/<v[^>]*>/.test(m[1])) avecV++;
  }
  total += avecV;
  console.log(`  ${nom.padEnd(20)} cellules de formule : ${formules} · avec valeur en cache : ${avecV}`);
}
console.log(`TOTAL valeurs figées dans tout le classeur : ${total}`);
