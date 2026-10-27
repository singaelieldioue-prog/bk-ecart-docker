// VÉRIF-SUIVI — origine de l'ordre des lignes d'inventaire : CUSTOM_ARTICLES_ORDER
// (liste codée en dur) comparée à « exemple inventaire.xlsx » et au classeur écrit. Lecture seule.
// Exécution : node tests/tmp_verif_suivi_customorder.mjs
import fs from "node:fs";

import XLSX from "xlsx-js-style";

import { CUSTOM_ARTICLES_ORDER } from "../src/utils/customArticleOrder.js";

const V = new URL("../../tmp_verif/", import.meta.url);
const norm = (s) => String(s ?? "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");

console.log("CUSTOM_ARTICLES_ORDER :", CUSTOM_ARTICLES_ORDER.length, "entrées");
const vides = CUSTOM_ARTICLES_ORDER.map((n, i) => ({ n, i })).filter((x) => norm(x.n) === "");
console.log("entrées normalisées vides :", vides.length, JSON.stringify(vides.slice(0, 20)));
const parCle = new Map();
const dup = [];
CUSTOM_ARTICLES_ORDER.forEach((n, i) => {
  const k = norm(n);
  if (parCle.has(k)) dup.push({ nom: n, index: i, premier: parCle.get(k) });
  else parCle.set(k, i);
});
console.log("clés distinctes :", parCle.size, "| doublons :", dup.length, JSON.stringify(dup.slice(0, 20)));

// Exemple inventaire
const wb = XLSX.read(fs.readFileSync(new URL("../frontend/public/exemple inventaire.xlsx", V)), { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets.inventaire, { header: 1, defval: null });
const ref = rows.slice(6).filter((r) => r[3] && r[14]);
console.log("exemple inventaire retenu :", ref.length, "lignes");
const refKeys = ref.map((r) => norm(r[3]));
const missing = refKeys.filter((k) => !parCle.has(k));
console.log("noms de l'exemple absents de CUSTOM_ARTICLES_ORDER :", missing.length, JSON.stringify(missing.slice(0, 20)));

// Feuille écrite
const inv = JSON.parse(fs.readFileSync(new URL("xml_inventory.json", V), "utf8"));
const L = inv.feuilles["Inventaire Initial"].lignes;
const ecrites = [];
for (let r = 7; r <= 324; r++) ecrites.push({ r, nom: String(L[r]?.C?.v ?? ""), code: String(L[r]?.N?.v ?? "") });
console.log("lignes écrites :", ecrites.length,
  "| ARTICLE vide :", ecrites.filter((x) => norm(x.nom) === "").length,
  "| Code vide :", ecrites.filter((x) => norm(x.code) === "").length);

// Position d'une ligne écrite dans chaque référence
const indexExemple = new Map();
ref.forEach((r, i) => { const k = norm(r[3]) + "|" + norm(r[14]); if (!indexExemple.has(k)) indexExemple.set(k, i); });
const indexCustom = new Map();
CUSTOM_ARTICLES_ORDER.forEach((n, i) => { if (!indexCustom.has(norm(n))) indexCustom.set(norm(n), i); });
const ecarts = [];
ecrites.forEach((x, i) => {
  const parNomEx = ref.findIndex((r) => norm(r[3]) === norm(x.nom) && norm(r[14]) === norm(x.code));
  const parNomSeul = ref.findIndex((r) => norm(r[3]) === norm(x.nom));
  if (parNomEx !== i || parNomSeul !== i) {
    ecarts.push({ ligneExcel: x.r, posFichier: i, posExempleCode: parNomEx, posExempleNom: parNomSeul, posCustom: indexCustom.get(norm(x.nom)) ?? null, nom: x.nom, code: x.code });
  }
});
console.log("positions divergentes (fichier vs exemple) :", ecarts.length);
console.log(JSON.stringify(ecarts, null, 1).slice(0, 4000));
