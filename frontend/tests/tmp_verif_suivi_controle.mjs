// VÉRIF-SUIVI — contrôle final des chiffres cités dans verif_suivi_stock.md (lecture seule).
// Exécution : node tests/tmp_verif_suivi_controle.mjs — même convention d'URL que les autres sondes VÉRIF-SUIVI
import fs from "node:fs";

import JSZip from "jszip";

const V = new URL("../../tmp_verif/", import.meta.url);
const inv = JSON.parse(fs.readFileSync(new URL("xml_inventory.json", V), "utf8"));

// 1. Pertes : en-têtes journaliers J4..AN4
const P = inv.feuilles["Pertes"].lignes;
const jours = ["J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","AA","AB","AC","AD","AE","AF","AG","AH","AI","AJ","AK","AL","AM","AN"];
const entetes4 = jours.map((c) => P[4]?.[c]?.v);
console.log("Pertes J4..AN4 :", JSON.stringify(entetes4), "→ 1..31 :", entetes4.every((v, i) => Number(v) === i + 1));

// 2. Pertes : THÉ / LAIT / catégories hors périmètre
const matiere = [];
for (let r = 5; r <= 192; r++) {
  const a = String(P[r]?.A?.v ?? ""), b = String(P[r]?.B?.v ?? "");
  if (!b && !a) continue;
  matiere.push({ r, a, b });
}
const theLait = matiere.filter((x) => /TH[ÉE]|LAIT/i.test(x.b));
const horsPerim = matiere.filter((x) => /NETTOYAGE|PACKAGING|GLOVO|JOUET|NO SAUCE/i.test(x.a + " " + x.b));
console.log("lignes nommées Pertes :", matiere.length, "| THÉ/LAIT :", theLait.length, JSON.stringify(theLait),
  "| catégories Nettoyage/Packaging/jouet :", horsPerim.length, JSON.stringify(horsPerim.slice(0, 12)));

// 3. Inventaire : prix non entiers vs prix nuls
const I = inv.feuilles["Inventaire Initial"].lignes;
let nuls = 0, nonEntiers = 0, somme = 0, max = 0;
for (let r = 7; r <= 324; r++) {
  const k = Number(I[r]?.K?.v ?? 0);
  somme += k; if (k > max) max = k;
  if (k === 0) nuls++;
  if (Math.abs(k - Math.round(k)) > 1e-9) nonEntiers++;
}
console.log("Inventaire K : lignes 318 · Σ =", Math.round(somme), "· max =", max, "· nuls =", nuls, "· non entiers =", nonEntiers);

// 4. Cache de calcul : total des cellules de formule (regex tolérante)
const buf = fs.readFileSync(new URL("Suivi_BK1_Octobre_2026.xlsx", V));
const zip = await JSZip.loadAsync(buf);
let formules = 0, caches = 0;
for (const f of Object.values(inv.feuilles)) {
  const xml = await zip.file(f.chemin).async("string");
  let nf = 0, nc = 0;
  for (const m of xml.matchAll(/<c\b[^>]*>([\s\S]*?)<\/c>/g)) {
    if (!/<f[\s>]/.test(m[1])) continue;
    nf++;
    if (/<v[^>]*>[\s\S]*?<\/v>/.test(m[1])) nc++;
  }
  formules += nf; caches += nc;
  console.log("  ", f.nom.padEnd(20), "formules", nf, "· avec <v>", nc);
}
console.log("TOTAL formules :", formules, "· valeurs en cache :", caches);

// 5. Total des lignes écrites Pertes / Transferts / Douane / PMIX (contrôle des compteurs cités)
console.log("Pertes dimension :", inv.feuilles["Pertes"].dimension,
  "| Transferts :", inv.feuilles["Transferts"].dimension,
  "| P.Douane :", inv.feuilles["P.Douane"].dimension,
  "| PMIX :", inv.feuilles["PMIX"].dimension,
  "| Offert :", inv.feuilles["Offert"].dimension);
console.log("calcPr :", inv.calcPr);
