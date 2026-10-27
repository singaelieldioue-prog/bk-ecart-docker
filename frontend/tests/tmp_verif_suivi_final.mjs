// VÉRIF-SUIVI — preuve de la permutation de fin de liste : noms de CUSTOM_ARTICLES_ORDER absents
// de l'exemple, doublons de l'exemple, et contenu réel des lignes Pertes (bandeaux, « à renseigner »,
// produits finis, cellule de la ligne 1 = CA HT du jour). Lecture seule.
// Exécution : node tests/tmp_verif_suivi_final.mjs
import fs from "node:fs";

import XLSX from "xlsx-js-style";

import { CUSTOM_ARTICLES_ORDER } from "../src/utils/customArticleOrder.js";

const V = new URL("../../tmp_verif/", import.meta.url);
const inv = JSON.parse(fs.readFileSync(new URL("xml_inventory.json", V), "utf8"));
const norm = (s) => String(s ?? "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");

// ── 1. ordre : qui est en plus dans la liste codée ? ────────────────────────────
const ewb = XLSX.read(fs.readFileSync(new URL("../frontend/public/exemple inventaire.xlsx", V)), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(ewb.Sheets.inventaire, { header: 1, defval: null });
const ref = rows.slice(6).filter((r) => r[3] && r[14]);
const clesExemple = ref.map((r) => norm(r[3]));
const enPlus = CUSTOM_ARTICLES_ORDER.filter((n) => !clesExemple.includes(norm(n)));
const compteur = new Map();
clesExemple.forEach((k) => compteur.set(k, (compteur.get(k) || 0) + 1));
const doublons = [...compteur.entries()].filter(([, c]) => c > 1);
console.log("exemple :", ref.length, "| CUSTOM_ARTICLES_ORDER :", CUSTOM_ARTICLES_ORDER.length);
console.log("noms de CUSTOM absents de l'exemple :", enPlus.length, JSON.stringify(enPlus));
console.log("noms doublés dans l'exemple :", doublons.length, JSON.stringify(doublons.map(([k, c]) => ({ k, c }))));

// ── 2. Pertes : structure réelle ────────────────────────────────────────────────
const P = inv.feuilles["Pertes"].lignes;
// Depuis le correctif du 26/10 : plus aucun bandeau (les deux lignes « ARTICLES TRANSMIS… » et
// « PRODUITS FINIS — valorisation au coût théorique » sont retirées), les lignes transmises sont
// résolues sur la base complète et le référentiel PMIX, et les produits finis se reconnaissent à
// leur catégorie en colonne A.
const blocs = { matiere: [], separateur: [], renseigner: [], finis: [] };
for (let r = 5; r <= 200; r++) {
  const c = P[r] || {};
  const a = String(c.A?.v ?? ""), b = String(c.B?.v ?? "");
  if (/^ARTICLES TRANSMIS|^PRODUITS FINIS/.test(a)) { blocs.separateur.push({ r, texte: a }); continue; }
  if (!b) continue;
  const vide = c.C?.v == null || String(c.C?.v).trim() === "" || c.D?.v == null || String(c.D?.v).trim() === "";
  if (a === "Produits finis") blocs.finis.push({ r, a, b, prix: c.D?.v });
  else if (vide) blocs.renseigner.push({ r, a, b, cond: c.C?.v, prix: c.D?.v });
  else blocs.matiere.push({ r, a, b });
}
console.log("\nPertes → matière :", blocs.matiere.length, "| bandeaux :", JSON.stringify(blocs.separateur),
  "| à renseigner :", blocs.renseigner.length, "| produits finis :", blocs.finis.length);
console.log("lignes matière au nom vide :", blocs.matiere.filter((x) => String(x.b).trim() === "").length);
console.log("à renseigner (détail) :", JSON.stringify(blocs.renseigner));
console.log("produits finis (5 premières) :", JSON.stringify(blocs.finis.slice(0, 5)));

// ligne 1 = CA HT du jour : quelles cellules écrites ?
const l1 = P[1] || {};
const jours = ["J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","AA","AB","AC","AD","AE","AF","AG","AH","AI","AJ","AK","AL","AM","AN"];
console.log("\nPertes ligne 1 : I1 =", JSON.stringify(l1.I?.v), "| cellules J1..AN1 écrites :", jours.filter((c) => l1[c]).length, "/ 31");
console.log("Pertes ligne 1 : autres cellules présentes :", JSON.stringify(Object.keys(l1)));
const l2 = P[2] || {}, l3 = P[3] || {};
console.log("Pertes ligne 2 : cellules présentes :", Object.keys(l2).length, "| J2 =", JSON.stringify(l2.J?.f), "fmt", l2.J?.z);
console.log("Pertes ligne 3 : cellules présentes :", Object.keys(l3).length, "| J3 =", JSON.stringify(l3.J?.f), "fmt", l3.J?.z);

// ── 3. Offert : contenu intégral ────────────────────────────────────────────────
const O = inv.feuilles["Offert"].lignes;
console.log("\nOffert :", JSON.stringify(inv.feuilles["Offert"].dimension), "| merges", JSON.stringify(inv.feuilles["Offert"].mergeCells ?? null));
[1, 2, 3].forEach((r) => console.log(`  ligne ${r} :`, JSON.stringify(Object.entries(O[r] || {}).map(([c, x]) => `${c}=${JSON.stringify(x.v ?? (x.f ? "{" + x.f + "}" : ""))}[${x.z ?? "-"}]`))));

// ── 4. Transferts : en-têtes ligne 4 et colonnes journalières ────────────────────
const T = inv.feuilles["Transferts"].lignes;
console.log("\nTransferts ligne 4 :", JSON.stringify(Object.entries(T[4] || {}).map(([c, x]) => `${c}=${JSON.stringify(x.v)}`)));
const avecJour = [4, 3].map((r) => ({ r, jours: Object.keys(T[r] || {}).filter((c) => /^\d+$/.test(String(T[r][c].v))) }));
console.log("cellules d'en-tête valant 1..31 :", JSON.stringify(avecJour));
console.log("dernière ligne de saisie :", JSON.stringify(Object.keys(T[20004] || {})), "| ligne 20005 :", JSON.stringify(Object.entries(T[20005] || {}).map(([c, x]) => `${c}=${JSON.stringify(x.v ?? x.f)}`)));
