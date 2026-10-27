// VÉRIF-SUIVI — stats de la colonne E (deriveInnerDepuisColisage) telle qu'ÉCRITE dans le classeur,
// recoupée avec le champ qteInner de la base fournie au générateur. Lecture seule.
// Exécution : node tests/tmp_verif_suivi_edrive_stats.mjs
import fs from "node:fs";

const V = new URL("../../tmp_verif/", import.meta.url);
const inv = JSON.parse(fs.readFileSync(new URL("xml_inventory.json", V), "utf8"));
const base = JSON.parse(fs.readFileSync(new URL("articles.json", V), "utf8"));
const arr = Array.isArray(base) ? base : base.articles || [];
const parCode = new Map(arr.map((a) => [String(a.code ?? "").trim(), a]));
const parNom = new Map(arr.map((a) => [String(a.nom ?? "").trim().toUpperCase(), a]));

const lignes = inv.feuilles["Inventaire Initial"].lignes;
const cls = { derive_E: 0, source_conserve: 0, bloque_D_absurde: 0, D_inferieur_2: 0, autre: 0 };
const details = { bloque: [], source_conserve: [] };
let n = 0;
for (let r = 7; r <= 324; r++) {
  const c = lignes[r] || {};
  const D = Number(c.D?.v ?? 0), E = Number(c.E?.v ?? 0);
  const nom = String(c.C?.v ?? "").trim();
  const code = String(c.N?.v ?? "").trim();
  const src = parCode.get(code) || parNom.get(nom.toUpperCase());
  const innerSource = src ? Number(src.qteInner) : null;
  const cdtSource = src ? Number(src.conditionnement) : null;
  n++;
  if (E === D && D > 1 && D <= 1000) cls.derive_E++;
  else if (E > 0 && E !== D) { cls.source_conserve++; details.source_conserve.push({ r, nom, code, D, E, innerSource }); }
  else if (E === 0 && D > 1000) { cls.bloque_D_absurde++; details.bloque.push({ r, nom, D, cdtSource }); }
  else if (D <= 1) cls.D_inferieur_2++;
  else cls.autre++;
}
console.log("lignes Inventaire:", n);
console.log(JSON.stringify(cls, null, 1));
console.log("bloquées:", JSON.stringify(details.bloque));
console.log("source conservée (échantillon 12):", JSON.stringify(details.source_conserve.slice(0, 12)));
console.log("total conservées:", details.source_conserve.length);
// Combien de lignes de la base ont un qteInner > 0 (donc jamais écrasé)
console.log("base 621 : qteInner>0 =", arr.filter((a) => Number(a.qteInner) > 0).length);
