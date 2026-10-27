// VÉRIF-SUIVI — mesures complémentaires (lecture seule) : types de cellules Pertes, lignes
// incomplètes des inventaires, référentiels masqués, hauteurs/largeurs et géométrie du logo.
// Exécution : node tests/tmp_verif_suivi_mesures.mjs
import fs from "node:fs";

import JSZip from "jszip";

const V = new URL("../../tmp_verif/", import.meta.url);
const zip = await JSZip.loadAsync(fs.readFileSync(new URL("Suivi_BK1_Octobre_2026.xlsx", V)));
const xml = (p) => zip.file(p).async("string");
const inv = JSON.parse(await fs.promises.readFile(new URL("xml_inventory.json", V), "utf8"));
const norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

const mdw = 7;
const px = (wch) => Math.round(Number(wch) * mdw + 5);

console.log("═══ 1. LARGEURS DE COLONNES A (zone logo) ═══");
for (const [nom, f] of Object.entries(inv.feuilles)) {
  const a = f.cols.find((c) => c.min === "1");
  const img = f.dessin.images[0];
  console.log(
    `${nom.padEnd(20)} A=${a ? a.width : "-"} wch → ${a ? px(a.width) : "?"} px | logo ${img ? img.px + "px" : "absent"} | décalage droit ${img && a ? px(a.width) - img.colOffPx - img.px : "-"} px | hauteur ligne 1 : ${f.lignes[1] ? "—" : "—"}`
  );
}

console.log("\n═══ 2. HAUTEURS / PANES ═══");
for (const nom of ["Inventaire Initial", "Transferts", "Pertes", "P.Douane", "Offert", "PMIX"]) {
  const f = inv.feuilles[nom];
  const x = await xml(f.chemin);
  const r1 = /<row r="1"[^>]*>/.exec(x);
  const ht = r1 && /ht="([\d.]+)"/.exec(r1[0]);
  console.log(`${nom.padEnd(20)} ligne1 ht=${ht ? ht[1] + "pt" : "défaut"} | pane=${((f.pane || "").match(/xSplit="(\d+)" ySplit="(\d+)"/) || []).slice(1, 3).join("/") || "aucun"}`);
}

console.log("\n═══ 3. PERTES : lignes dont Cond. (C) n'est pas un nombre ═══");
{
  const f = inv.feuilles.Pertes;
  const horsNombres = [];
  const sansGarde = [];
  for (let r = 5; r <= 192; r++) {
    const l = f.lignes[r] || {};
    const c = l.C ? l.C.v : null;
    const e = l.E ? l.E.f : null;
    if (c == null || String(c).trim() === "") continue;
    if (!isFinite(Number(c))) horsNombres.push(`${r}:${JSON.stringify(c)} (${l.C.t})`);
    if (e && !/ISNUMBER/.test(e)) sansGarde.push(r);
  }
  console.log("Cond. non numérique :", horsNombres.length ? horsNombres.join(", ") : "aucune");
  console.log("formules E sans garde ISNUMBER :", sansGarde.length, "->", sansGarde.length ? `lignes ${sansGarde[0]}..${sansGarde[sansGarde.length - 1]}` : "-");
  const gardees = [];
  for (let r = 5; r <= 192; r++) {
    const l = f.lignes[r] || {};
    if (l.E && l.E.f && /ISNUMBER/.test(l.E.f)) gardees.push(r);
  }
  console.log("formules E AVEC garde ISNUMBER :", gardees.join(","));
}

console.log("\n═══ 4. INVENTAIRES : lignes incomplètes ═══");
for (const nom of ["Inventaire Initial", "Inventaire Final"]) {
  const f = inv.feuilles[nom];
  const sansNom = [], sansCode = [], prixZero = [], sansUnite = [], condVide = [];
  for (let r = 7; r <= 324; r++) {
    const l = f.lignes[r] || {};
    const n = (v) => (v == null ? "" : String(v).trim());
    if (!n(l.C && l.C.v)) sansNom.push(r);
    if (!n(l.N && l.N.v)) sansCode.push(`${r}:${n(l.C && l.C.v)}`);
    if (l.K && (n(l.K.v) === "" || Number(l.K.v) === 0)) prixZero.push(`${r}:${n(l.C && l.C.v)}=${n(l.K && l.K.v)}`);
    if (!n(l.J && l.J.v)) sansUnite.push(r);
    if (!n(l.D && l.D.v)) condVide.push(`${r}:${n(l.C && l.C.v)}`);
  }
  console.log(`── ${nom} (lignes 7..324 = 318)`);
  console.log(`   sans désignation (${sansNom.length}) : ${sansNom.join(",")}`);
  console.log(`   sans code (${sansCode.length}) : ${sansCode.join(" | ")}`);
  console.log(`   prix carton vide ou nul (${prixZero.length}) : ${prixZero.join(" | ")}`);
  console.log(`   sans unité (${sansUnite.length}) : ${sansUnite.join(",")} | sans colisage (${condVide.length}) : ${condVide.join(" | ")}`);
}

console.log("\n═══ 5. RÉFÉRENTIELS MASQUÉS ═══");
{
  const f = inv.feuilles["Référentiel Articles"];
  const cles = new Map();
  let sansPrixA = 0;
  for (let r = 2; r <= 634; r++) {
    const l = f.lignes[r] || {};
    const k = norm(l.A && l.A.v);
    if (!k) continue;
    cles.set(k, (cles.get(k) || 0) + 1);
    if (!l.F || String(l.F.v ?? "").trim() === "" || Number(l.F.v) === 0) sansPrixA++;
  }
  const doublons = [...cles.entries()].filter(([, n]) => n > 1);
  console.log(`Référentiel Articles : lignes 2..634 = 633 | clés distinctes ${cles.size} | doublons ${doublons.length} | sans prix ${sansPrixA}`);
  console.log(`  doublons : ${doublons.slice(0, 12).map(([k, n]) => `${k}×${n}`).join(", ")}`);

  const p = inv.feuilles["Référentiel PMIX"];
  let coutZero = 0, tot = 0;
  const zeros = [];
  for (let r = 2; r <= 377; r++) {
    const l = p.lignes[r] || {};
    if (!l.A) continue;
    tot++;
    if (Number(l.C && l.C.v) === 0) { coutZero++; zeros.push(`${l.A.v}:${l.B.v}`); }
  }
  console.log(`Référentiel PMIX : ${tot} PLU | coût = 0 : ${coutZero}`);
  console.log(`  exemples : ${zeros.slice(0, 12).join(", ")}`);
  const whopper = p.lignes[2];
  console.log(`  ligne 2 (contrôle Whopper) : ${JSON.stringify(Object.values(whopper).map((c) => c.v))}`);
}

console.log("\n═══ 6. TITRES ET PÉRIODE ═══");
for (const [nom, f] of Object.entries(inv.feuilles)) {
  if (f.etat !== "visible") continue;
  const t = f.lignes[1] && f.lignes[1].B ? f.lignes[1].B.v : null;
  console.log(`${nom.padEnd(20)} titre B1 = ${JSON.stringify(t)} | BK1: ${/BK1/.test(t || "")} | période: ${/Octobre 2026/.test(t || "")}`);
}

console.log("\n═══ 7. CELLULES DE SAISIE J1..AN1 (CA HT du jour) ═══");
{
  const f = inv.feuilles.Pertes;
  const cols = ["J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN"];
  const presentes = cols.filter((c) => f.lignes[1] && f.lignes[1][c]);
  const avecValeur = cols.filter((c) => f.lignes[1] && f.lignes[1][c] && String(f.lignes[1][c].v ?? "").trim() !== "");
  console.log(`colonnes de jours : ${cols.length} | cellules existantes en ligne 1 : ${presentes.length} | non vides : ${avecValeur.length}`);
  console.log(`J1 : ${f.lignes[1] && f.lignes[1].J ? JSON.stringify(f.lignes[1].J) : "AUCUNE CELLULE"}`);
  console.log(`I1 : ${JSON.stringify(f.lignes[1] && f.lignes[1].I)}`);
}

console.log("\n═══ 8. VIDEURS DE LA FEUILLE Offert ═══");
{
  const f = inv.feuilles.Offert;
  console.log("ligne 3 :", JSON.stringify(f.lignes[3]));
  console.log("formule en H3 (Total) :", f.lignes[3] && f.lignes[3].H ? f.lignes[3].H.f : "cellule absente");
}
