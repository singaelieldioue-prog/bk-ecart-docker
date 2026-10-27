// VALIDATION DE LA COPIE CORRIGÉE — Suivi_BK1_Octobre_2026_corrige.xlsx
// Vérifie la correction elle-même (2 lignes × 2 feuilles), la structure du classeur,
// le rejeu de la chaîne métier, et le comportement quand le CDG saisit une quantité.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import XLSX from "xlsx-js-style";
import JSZip from "jszip";
import { parseSuivisStock, extractPmixFromWorkbook } from "../src/utils/parsers.js";
import { calculer } from "../src/utils/calculators.js";
import { norm } from "../src/utils/formatters.js";

let ok = 0, ko = 0;
const check = (cond, msg, detail = "") => {
  if (cond) { ok++; console.log("PASS - " + msg); }
  else { ko++; console.log("FAIL - " + msg + (detail ? "\n         " + detail : "")); }
};
const ORIG = path.resolve("../tmp_verif/Suivi_BK1_Octobre_2026.xlsx");
const CORR = path.resolve("../tmp_verif/Suivi_BK1_Octobre_2026_corrige.xlsx");

const Database = createRequire(new URL("../../backend/package.json", import.meta.url))("better-sqlite3");
const db = new Database(path.resolve("../backend/data.db"), { readonly: true, fileMustExist: true });
const charge = (k) => { const r = db.prepare("SELECT v FROM kv WHERE k = ?").get(k); return r ? JSON.parse(r.v) : null; };
const baseArticle = charge("bk_sia_base_article_map_v1") || {};
const ratios = charge("bk_sia_ratios_parsed_v1") || {};
const localArticles = charge("bk_sia_local_articles_v1") || {};
const pmixComplement = charge("bk_sia_pmix_complement_v1") || {};
db.close();

const wbCorr = XLSX.read(fs.readFileSync(CORR), { type: "buffer" });
const wbOrig = XLSX.read(fs.readFileSync(ORIG), { type: "buffer" });

// ── 1. Structure du classeur ────────────────────────────────────────────────────────────────
const FEUILLES = ["Inventaire Initial", "Inventaire Final", "Transferts", "Référentiel Articles", "Pertes", "P.Douane", "Offert", "Référentiel PMIX", "PMIX"];
check(JSON.stringify(wbCorr.SheetNames) === JSON.stringify(FEUILLES), `les 9 feuilles sont présentes et dans l ordre (${wbCorr.SheetNames.length})`, wbCorr.SheetNames.join(" | "));

const zip = await JSZip.loadAsync(fs.readFileSync(CORR));
const s1 = await zip.file("xl/worksheets/sheet1.xml").async("string");
check((s1.match(/<f>/g) || []).length === 964, `964 formules conservées dans Inventaire Initial (${(s1.match(/<f>/g) || []).length})`);
check((s1.match(/<row /g) || []).length === 333, `333 lignes conservées (${(s1.match(/<row /g) || []).length})`);
check(/<dimension ref="A1:O333"\/>/.test(s1), "dimension A1:O333 inchangée");
check(!!zip.file("xl/media/logo_bk_servair.png"), "logo toujours embarqué");

// ── 2. Correction n° 1 : code de la ligne 227 ───────────────────────────────────────────────
for (const f of ["Inventaire Initial", "Inventaire Final"]) {
  const ws = wbCorr.Sheets[f];
  check(ws["C227"].v === "SACHET SNACK MOYEN 4000", `${f} : ligne 227 = SACHET SNACK MOYEN 4000`, String(ws["C227"].v));
  check(ws["N227"].v === "SSM4000", `${f} : ligne 227 porte SSM4000 (${ws["N227"].v})`);
  check(wbOrig.Sheets[f]["N227"].v === "SSM30700", `${f} : l original portait bien SSM30700 (témoin)`);
  check(ws["N226"].v === "SSM30700" && ws["C226"].v === "SACHET SNACK MOYEN 2000", `${f} : ligne 226 garde SSM30700 et son article 2 000`);
}

// ── 3. Correction n° 2 : ligne 312 vidée, ligne 311 intacte ─────────────────────────────────
for (const f of ["Inventaire Initial", "Inventaire Final"]) {
  const ws = wbCorr.Sheets[f];
  const vides = ["A312", "B312", "C312", "D312", "E312", "J312", "K312", "N312"].every((c) => !ws[c] || ws[c].v == null || ws[c].v === "");
  check(vides, `${f} : ligne 312 ne porte plus aucune donnée article`);
  check(ws["C311"].v === "SANITIZER TABLETTE " && ws["D311"].v === 1380 && ws["E311"].v === 230 && ws["K311"].v === 62935,
    `${f} : ligne 311 conservée (1 380 / 230 / 62 935 F)`);
}
check(s1.includes('<c r="C312" s="45"/>'), "ligne 312 : cellule de style conservée (bordures intactes)");

// ── 4. Rejeu de la chaîne métier ────────────────────────────────────────────────────────────
const rejeu = (wb) => {
  const sd = parseSuivisStock(wb, baseArticle, ratios, localArticles);
  const items = extractPmixFromWorkbook(wb, sd.site);
  const pmixList = items.length ? [{ restaurant: sd.site, periode: "", items }] : [];
  return { sd, calc: calculer(sd, pmixList, ratios, baseArticle, pmixComplement) };
};
const A = rejeu(wbOrig);
const B = rejeu(wbCorr);
check(Object.keys(B.sd.invIni).length === 317, `corrigé : 317 articles relus en initial (${Object.keys(B.sd.invIni).length})`);
check(Object.keys(B.sd.invFin).length === 317, `corrigé : 317 articles relus en final (${Object.keys(B.sd.invFin).length})`);
check(Object.keys(A.sd.invIni).length === 318, `original : 318 articles relus (témoin : le doublon disparaît)`);
check((B.calc.doublonsInventaire || []).length === 0, `corrigé : 0 doublon signalé (${(B.calc.doublonsInventaire || []).length} ; original : ${(A.calc.doublonsInventaire || []).length})`);

const integ = B.calc.anomaliesIntegrite || [];
check(integ.length === 1 && integ[0].type === "Unité incohérente" && /GANTS/.test(integ[0].nom),
  `corrigé : 1 seul défaut d intégrité, GANTS SACHET PACK DE 500 (${integ.length})`, integ.map((a) => a.type).join(" ; "));
check(!integ.some((a) => /Colisage vide|Prix absent|Prix nul/.test(a.type) && /SANITIZER|SACHET SNACK/.test(a.nom)),
  "aucune anomalie de colisage/prix introduite sur SANITIZER ou SACHET SNACK");

const g = B.calc;
const financier = [g.ca, g.consoTheoTotal, g.consoReelle, g.ecartMatiere, g.totalValIni, g.totalValFin];
check(financier.every((v) => (Number(v) || 0) === 0), `totaux inchangés (modèle vierge) : ${financier.map((v) => Number(v) || 0).join(" / ")}`);
check(JSON.stringify([A.calc.ca, A.calc.consoTheoTotal, A.calc.consoReelle, A.calc.ecartMatiere]) ===
      JSON.stringify([g.ca, g.consoTheoTotal, g.consoReelle, g.ecartMatiere]), "totaux identiques à l original (aucune valeur métier déplacée)");

// ── 5. Comportement quand le CDG saisit une quantité ────────────────────────────────────────
const wbSaisie = XLSX.read(fs.readFileSync(CORR), { type: "buffer" });
const ws = wbSaisie.Sheets["Inventaire Initial"];
ws["F311"] = { t: "n", v: 1 };   // 1 carton de SANITIZER TABLETTE
ws["F227"] = { t: "n", v: 1 };   // 1 carton de SACHET SNACK MOYEN 4000
ws["F226"] = { t: "n", v: 1 };   // 1 carton de SACHET SNACK MOYEN 2000
const S = rejeu(wbSaisie);
const parNom = Object.values(S.sd.invIni);
const san = parNom.filter((it) => norm(it.nom) === norm("SANITIZER TABLETTE"));
const m4 = parNom.find((it) => norm(it.nom) === norm("SACHET SNACK MOYEN 4000"));
const m2 = parNom.find((it) => norm(it.nom) === norm("SACHET SNACK MOYEN 2000"));
check(san.length === 1, `1 seule ligne SANITIZER après correction (${san.length})`);
check(san[0] && san[0].qtePieces === 1380 && san[0].valeur === 62935,
  `1 carton de SANITIZER = 1 380 pièces / 62 935 F (${san[0] ? san[0].qtePieces + " / " + san[0].valeur : "?"})`);
check(m4 && m4.qtePieces === 4000 && m4.valeur === 42266, `1 carton de SACHET 4 000 = 4 000 pièces / 42 266 F (${m4 ? m4.qtePieces + " / " + m4.valeur : "?"})`);
check(m2 && m2.qtePieces === 2000 && Math.abs(m2.valeur - 16712.256073114164) < 1e-6,
  `1 carton de SACHET 2 000 = 2 000 pièces / 16 712,256 F (${m2 ? m2.qtePieces + " / " + m2.valeur : "?"})`);
check(m2 && m2.codeArticle === "SSM30700" && m4 && m4.codeArticle === "SSM4000", "les deux formats portent désormais deux codes distincts");

// ── 6. Stabilité : réécriture XLSX puis réimport ────────────────────────────────────────────
const buf = XLSX.write(wbCorr, { bookType: "xlsx", type: "buffer" });
const relu = rejeu(XLSX.read(buf, { type: "buffer" }));
check(Object.keys(relu.sd.invIni).length === 317 && (relu.calc.doublonsInventaire || []).length === 0,
  "après réécriture XLSX puis réimport : toujours 317 articles et 0 doublon");

console.log(`\nRésultat : ${ok} PASS / ${ko} FAIL`);
process.exit(ko ? 1 : 0);
