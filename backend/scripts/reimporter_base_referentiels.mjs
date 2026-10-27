// Ré-derive la base articles depuis les fichiers faisant foi (Ratio + BASE ARTICLE SIA +
// complément PMIX) avec LE MEME code que la plateforme, puis la synchronise.
// Pourquoi : la base courante a été chargée à la main depuis « Base articles finale » dont la
// colonne Conditionnement est du texte aplati (« 3100 (14.4 kg) » -> 310 014,4) et dont les prix
// ne portent pas la dérivation kg. D'ou le reproche CDG du 25/10 : « le conditionnement des
// articles n'est toujours pas correctement pris en compte, entraînant des erreurs de
// valorisation ».
// Usage : node scripts/reimporter_base_referentiels.mjs [--apply]   (dry-run sans --apply)
import { fileURLToPath } from "url";
import path from "path";
import fs from "node:fs";
import Database from "better-sqlite3";
import * as XLSX from "../../frontend/node_modules/xlsx/xlsx.mjs";
import {
  parseRatios, parseBaseArticle, parseCorrespondance, parseBaseComplementairePmix,
  buildArtListFromReferentiel,
} from "../../frontend/src/utils/parsers.js";
import { applySync, computeDiff } from "../src/articles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APPLY = process.argv.includes("--apply");
const read = (rel) => XLSX.read(fs.readFileSync(path.join(ROOT, rel)), { type: "buffer" });

const ratioRel = process.argv.find((a) => a.startsWith("--ratio="))?.slice(8) || "sample_data/RATIOS BURGER KING ABJ Q3 2026.xlsx";
const baseRel = process.argv.find((a) => a.startsWith("--base="))?.slice(7) || "sample_data/BASE ARTICLE SIA.xlsx";
const label = path.basename(ratioRel);

const ratios = parseRatios(read(ratioRel));
const baseArt = parseBaseArticle(read(baseRel));
const corr = parseCorrespondance(read(ratioRel));
const pmix = parseBaseComplementairePmix(read("sample_data/Base complementaire PMIX.xlsx"));
const db = new Database(path.join(ROOT, "backend", "data.db"));
const localArticles = JSON.parse(db.prepare("SELECT v FROM kv WHERE k='bk_sia_local_articles_v1'").get()?.v || "null");

const { artList, nbPrix, nbCondDerives } = buildArtListFromReferentiel(baseArt, corr, ratios.waLandedCost, ratios.waByCode, localArticles);

const canon = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[\u2019'’]/g, '').replace(/-/g, ' ').replace(/[^A-Z0-9\s]/gi, ' ')
  .replace(/\s+/g, ' ').trim().toUpperCase();
const avant = new Map(db.prepare("SELECT ref,conditionnement,unite,pu_carton,pu_piece,actif FROM articles").all().map((r) => [canon(r.ref), r]));
const diff = computeDiff(db, artList);
const r0 = (v) => (v == null ? "-" : String(Math.round(Number(v) * 100) / 100));

const changements = [];
for (const it of artList) {
  const cur = avant.get(canon(it.ref));
  if (!cur) continue;
  const colonnes = [];
  if (Math.abs((cur.conditionnement || 0) - (it.conditionnement || 0)) > 0.01) colonnes.push(`cond ${r0(cur.conditionnement)} -> ${r0(it.conditionnement)}`);
  if (Math.abs((cur.pu_carton || 0) - (it.puCarton || 0)) > 0.5) colonnes.push(`carton ${r0(cur.pu_carton)} -> ${r0(it.puCarton)}`);
  if (Math.abs((cur.pu_piece || 0) - (it.puPiece || 0)) > 0.5) colonnes.push(`piece ${r0(cur.pu_piece)} -> ${r0(it.puPiece)}`);
  if (colonnes.length) changements.push({ ref: canon(it.ref), nom: it.nom, code: it.code, colonnes, avant: cur, apres: it });
}

// Une insertion n'est légitime que si elle n'est pas la même ligne déjà connue sous un autre
// ref : le ref est le nom normalisé, donc un renommage dans le fichier recrée une doublure.
// Le ref comparé est canoniqué comme applySync (accents, tirets, espaces), sinon le dry-run
// annoncerait des insertions qui sont en fait des mises à jour.
const refsCanon = new Set(avant.keys());
const codesBase = new Map(db.prepare("SELECT code, ref, nom, actif FROM articles WHERE code IS NOT NULL AND TRIM(code)<>''").all()
  .map((r) => [String(r.code).toUpperCase().replace(/\s+/g, ''), r]));
const ajoutees = artList.filter((a) => !refsCanon.has(canon(a.ref)));
const doublons = ajoutees.filter((a) => a.code && codesBase.has(String(a.code).toUpperCase().replace(/\s+/g, '')));
const sansPrixDerives = ajoutees.filter((a) => !(a.puCarton > 0) && !(a.puPiece > 0));

console.log(`reférentiel lu   : ${label} + ${path.basename(baseRel)}`);
console.log(`articles derives : ${artList.length} (dont ${nbPrix} avec prix, ${nbCondDerives} colisages dérivés des deux prix)`);
console.log(`lignes en base   : ${avant.size} | nouvelles refs: ${ajoutees.length} (dont ${doublons.length} déjà connues sous ce code, ${sansPrixDerives.length} sans prix) | désactivées par la règle: ${diff.counts.deactivated}`);
for (const a of doublons.slice(0, 12)) {
  const d = codesBase.get(String(a.code).toUpperCase().replace(/\s+/g, ''));
  console.log(`   MEME CODE code=${a.code} : ref entrant=${JSON.stringify(canon(a.ref))} / ref en base=${JSON.stringify(d.ref)} actif=${d.actif}`);
}
console.log(`lignes dont le colisage ou un prix change : ${changements.length}`);
const cond = changements.filter((c) => c.colonnes.some((x) => x.startsWith("cond")));
console.log(`  dont colisage modifié : ${cond.length}`);
for (const c of changements.slice(0, 25)) console.log(`   ${String(c.code || "-").padEnd(12)} ${String(c.nom).slice(0, 30).padEnd(30)} ${c.colonnes.join(" | ")}`);
console.log("\ncontrôle des lignes citées par le CDG :");
for (const cle of ["SALADICE", "FRITES", "99262", "Pepsi", "SFL500"]) {
  const trouve = artList.find((a) => String(a.code || "").toUpperCase() === cle.toUpperCase() || String(a.nom).toUpperCase().includes(cle.toUpperCase()));
  if (!trouve) { console.log(`   ${cle} : absent du référentiel dérivé`); continue; }
  const cur = avant.get(canon(trouve.ref));
  console.log(`   ${String(trouve.code).padEnd(10)} ${String(trouve.nom).slice(0, 28).padEnd(28)} base: cond=${r0(cur?.conditionnement)} carton=${r0(cur?.pu_carton)} piece=${r0(cur?.pu_piece)} | dérivé: cond=${r0(trouve.conditionnement)} carton=${r0(trouve.puCarton)} piece=${r0(trouve.puPiece)}`);
}

if (!APPLY) { console.log("\nDRY-RUN — aucune écriture. Relancer avec --apply."); db.close(); process.exit(0); }

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const log = path.join(ROOT, "rapports", `reimport_base_${stamp}.json`);
// Instantané complet AVANT écriture : la synchronisation insère, met à jour et inactive.
// Sans ce snapshot, seules les lignes « changées » seraient restaurables.
const snapshot = path.join(ROOT, "rapports", `base_avant_reimport_${stamp}.json`);
fs.mkdirSync(path.dirname(snapshot), { recursive: true });
fs.writeFileSync(snapshot, JSON.stringify(db.prepare("SELECT * FROM articles").all(), null, 1));
const res = applySync(db, artList, label);
fs.mkdirSync(path.dirname(log), { recursive: true });
fs.writeFileSync(log, JSON.stringify({
  applied_at: new Date().toISOString(), ratio: label, base: path.basename(baseRel),
  counts: res?.counts ?? diff.counts,
  changements: changements.map((c) => ({ ref: c.ref, nom: c.nom, code: c.code, colonnes: c.colonnes, avant: c.avant })),
}, null, 2));
console.log(`\nAPPLIQUÉ — journal : ${path.relative(ROOT, log)}`);
console.log(`articles actifs après : ${db.prepare("SELECT COUNT(*) c FROM articles WHERE actif=1").get().c}`);
db.close();
