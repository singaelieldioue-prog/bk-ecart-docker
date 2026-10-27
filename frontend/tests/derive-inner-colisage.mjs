// E-DERIVE — dérivation de la colonne E (« Nb articles / inner ») depuis le colisage D.
// La colonne I = F + IF(D>0;G*E/D;0) + IF(D>0;H/D;0) annule le « Inner » saisi en G
// quand E est vide : les lignes concernées sont recalées sur E = D (inner = carton).
// Exécution : node tests/derive-inner-colisage.mjs
// Sortie : une ligne PASS/FAIL par point, code de sortie 1 si une régression subsiste.
import * as XLSX from "xlsx";
import fs from "node:fs";

import { deriveInnerDepuisColisage, buildModelesWb, SEUIL_COLISAGE_ABSURDE } from "../src/utils/excelExporter.js";
import { INVENTAIRE_REFERENTIEL_CDG } from "../src/utils/inventaireReferentielCdg.js";

const normInv = (s) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const results = [];
const check = (name, fn) => {
  try {
    fn();
    results.push("PASS " + name);
  } catch (e) {
    results.push("FAIL " + name + " — " + (e && e.message ? e.message : e));
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

// ── Cas demandés ────────────────────────────────────────────────────────────────
check("Article avec D=12, E vide → E dérivé à 12", () => {
  const d = deriveInnerDepuisColisage({ conditionnement: 12, qteInner: null });
  assert(d.qteInner === 12, "qteInner = " + d.qteInner + " ≠ 12");
  assert(d.source === "derive_E", "conditionnement_source = " + d.source + " ≠ derive_E");
});

check("Article avec D=12, E=6 → E reste 6", () => {
  const d = deriveInnerDepuisColisage({ conditionnement: 12, qteInner: 6 });
  assert(d.qteInner === 6, "qteInner écrasé : " + d.qteInner + " ≠ 6");
  assert(d.source === null, "dérivation à tort : " + d.source);
});

check("Article avec D=1, E vide → E reste vide", () => {
  const d = deriveInnerDepuisColisage({ conditionnement: 1, qteInner: null });
  assert(d.qteInner == null, "qteInner = " + d.qteInner + " au lieu de rester vide");
  assert(d.source === "non_derive", "conditionnement_source = " + d.source + " ≠ non_derive");
});

// « E vide » dans le modèle s'écrit 0 (l'exporter remplace null par 0) : même traitement.
check("Article avec D=24, E=0 → E dérivé à 24", () => {
  const d = deriveInnerDepuisColisage({ conditionnement: 24, qteInner: 0 });
  assert(d.qteInner === 24, "qteInner = " + d.qteInner + " ≠ 24");
  assert(d.source === "derive_E", "conditionnement_source = " + d.source);
});

// ── Garde-fou E-DERIVE-GARDE-FOU : un colisage > 1000 est une valeur absurde ────
check("Garde-fou : seuil à 1000", () => {
  assert(SEUIL_COLISAGE_ABSURDE === 1000, "SEUIL_COLISAGE_ABSURDE = " + SEUIL_COLISAGE_ABSURDE);
});

check("D=12, E vide → E = 12, source 'derive_E'", () => {
  const d = deriveInnerDepuisColisage({ conditionnement: 12, qteInner: null });
  assert(d.qteInner === 12 && d.source === "derive_E", JSON.stringify(d));
});

check("D=4000, E vide → E vide, source 'derive_E_bloque_D_absurde'", () => {
  const d = deriveInnerDepuisColisage({ conditionnement: 4000, qteInner: null });
  assert(d.qteInner == null, "qteInner = " + d.qteInner + " : la ligne bloquée doit rester vide");
  assert(d.source === "derive_E_bloque_D_absurde", "conditionnement_source = " + d.source);
});

check("D=1000, E vide → E = 1000 (collé au seuil, toujours dérivable)", () => {
  const d = deriveInnerDepuisColisage({ conditionnement: 1000, qteInner: null });
  assert(d.qteInner === 1000 && d.source === "derive_E", JSON.stringify(d));
});

check("D=1, E vide → E vide, source 'non_derive'", () => {
  const d = deriveInnerDepuisColisage({ conditionnement: 1, qteInner: null });
  assert(d.qteInner == null && d.source === "non_derive", JSON.stringify(d));
});

check("D=12, E=6 → E = 6, source nulle (jamais écrasé)", () => {
  const d = deriveInnerDepuisColisage({ conditionnement: 12, qteInner: 6 });
  assert(d.qteInner === 6 && d.source === null, JSON.stringify(d));
});

// ── Critère d'acceptation sur le modèle réel (exemple inventaire du CDG) ───────
const exempleWb = XLSX.read(
  fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)),
  { type: "buffer" }
);
const exempleRows = XLSX.utils.sheet_to_json(exempleWb.Sheets["inventaire"], {
  header: 1,
  defval: null,
});
// Format exemplaire : A vide, catégorie en B, fournisseur en C, article en D (3),
// colisage en E (4), inner en F (5), code en O (14).
const referenceRows = exempleRows
  .slice(6)
  .filter((row) => row[3] && row[14])
  .map((row) => ({
    nom: row[3],
    code: row[14],
    categorie: row[1] || "",
    conditionnement: typeof row[4] === "number" ? row[4] : 1,
    qteInner: typeof row[5] === "number" ? row[5] : 0,
    unite: row[10] || "",
  }));

const articles = referenceRows.map((r) => ({ ...r, fournisseur: "SIA", pu_carton: 0 }));
const wb = buildModelesWb(articles, [], "BK1", "Octobre 2026", "", [], {});
const grille = XLSX.utils.sheet_to_json(wb.Sheets["Inventaire Initial"], {
  header: 1,
  defval: null,
});

// Lignes générées : article en C (2), COLISAGE en D (3), inner en E (4), à partir de la ligne 7.
const gen = grille.slice(6).filter((r) => typeof r[2] === "string" && r[2].trim());
// Deux articles de l'exemplaire partagent le même libellé (« SANITIZER TABLETTE ») : l'appariement
// se fait occurrence par occurrence, l'exporter conservant l'ordre d'entrée à nom égal.
const genParNom = new Map();
gen.forEach((r) => {
  const cle = r[2].trim();
  if (!genParNom.has(cle)) genParNom.set(cle, []);
  genParNom.get(cle).push(r);
});
const appaireur = () => {
  const vues = new Map();
  return (nom) => {
    const cle = String(nom).trim();
    const i = vues.get(cle) || 0;
    vues.set(cle, i + 1);
    const lignes = genParNom.get(cle);
    return lignes ? lignes[i] : undefined;
  };
};

// Depuis le 26/10/2026, la feuille publie le référentiel « Inventaire initial » du CDG : ses
// 316 articles y prennent SON colisage et SON inner, sans passer par E-DERIVE (voir
// tests/inventaire-referentiel-cdg.mjs). E-DERIVE ne couvre donc plus que les articles que le
// CDG ne liste pas — c'est ce périmètre qui est vérifié ici, sur le modèle réel.
const REF_CDG = new Map();
INVENTAIRE_REFERENTIEL_CDG.forEach((t) => { const k = normInv(t.nom); if (!REF_CDG.has(k)) REF_CDG.set(k, t); });
const horsRef = referenceRows.filter((r) => !REF_CDG.has(normInv(r.nom)));
const coteesCdg = referenceRows.filter((r) => REF_CDG.has(normInv(r.nom)));

const lignesExemplaire = new Set(referenceRows.map((r) => String(r.nom).trim())).size;
const empties = horsRef.filter((r) => !(r.qteInner > 0));
const filled = horsRef.filter((r) => r.qteInner > 0);
const deriveables = empties.filter((r) => r.conditionnement > 1);
const nonDeriveables = empties.filter((r) => !(r.conditionnement > 1));
const aDeriver = deriveables.filter((r) => r.conditionnement <= SEUIL_COLISAGE_ABSURDE);
const bloquees = deriveables.filter((r) => r.conditionnement > SEUIL_COLISAGE_ABSURDE);

const nb = (v) => (typeof v === "number" ? v : 0);

// Appaire occurrence par occurrence : chaque ligne de l'exemplaire est associée à la
// ligne générée du même nom, dans l'ordre de parcours.
const prochaine = appaireur();
const attendus = referenceRows.map((a) => ({ src: a, gen: prochaine(a.nom) }));
const ligneManquante = attendus.filter((p) => !p.gen).map((p) => p.src.nom);
const genDe = (a) => attendus.find((p) => p.src === a).gen;

check("Le modèle contient bien les lignes E vide et les lignes E renseigné", () => {
  assert(gen.length > 0, "aucune ligne générée dans Inventaire Initial");
  assert(empties.length > 0 && filled.length > 0, "répartition E vide / E renseigné inattendue");
});

check("Aucune ligne de l'exemplaire n'est perdue à la génération", () => {
  assert(ligneManquante.length === 0, ligneManquante.join(" ; "));
});

check("Toutes les lignes hors référentiel CDG à E vide et 1 < D ≤ 1000 sont dérivées (E = D)", () => {
  const ko = [];
  aDeriver.forEach((a) => {
    const r = genDe(a);
    if (!r) return ko.push(a.nom + " absente");
    if (nb(r[4]) !== nb(r[3])) ko.push(a.nom + " : E=" + r[4] + " ≠ D=" + r[3]);
  });
  assert(ko.length === 0, ko.slice(0, 5).join(" ; ") + (ko.length > 5 ? " (+" + (ko.length - 5) + ")" : ""));
});

check("Les lignes hors référentiel CDG à D > 1000 ne sont pas dérivées (E reste vide)", () => {
  const ko = [];
  bloquees.forEach((a) => {
    const r = genDe(a);
    if (!r) return ko.push(a.nom + " absente");
    if (nb(r[4]) !== 0) ko.push(a.nom + " (D=" + a.conditionnement + ") : E=" + r[4] + " au lieu du vide");
  });
  assert(ko.length === 0, ko.slice(0, 5).join(" ; ") + (ko.length > 5 ? " (+" + (ko.length - 5) + ")" : ""));
});

check("Aucune ligne hors référentiel CDG à E renseigné n'est modifiée", () => {
  const ko = [];
  filled.forEach((a) => {
    const r = genDe(a);
    if (!r) return;
    if (nb(r[4]) !== nb(a.qteInner)) ko.push(a.nom + " : E généré " + r[4] + " ≠ E d'origine " + a.qteInner);
  });
  assert(ko.length === 0, ko.slice(0, 5).join(" ; ") + (ko.length > 5 ? " (+" + (ko.length - 5) + ")" : ""));
});

check("Aucune ligne hors référentiel CDG à D=1 n'est dérivée (E reste vide)", () => {
  const ko = [];
  nonDeriveables.forEach((a) => {
    const r = genDe(a);
    if (!r) return;
    if (nb(r[4]) !== 0) ko.push(a.nom + " : E=" + r[4] + " pour D=" + r[3]);
  });
  assert(ko.length === 0, ko.slice(0, 5).join(" ; ") + (ko.length > 5 ? " (+" + (ko.length - 5) + ")" : ""));
});

check("Aucun colisage D hors référentiel CDG n'est modifié", () => {
  const ko = [];
  horsRef.forEach((a) => {
    const r = genDe(a);
    if (!r) return;
    if (nb(r[3]) !== nb(a.conditionnement)) ko.push(a.nom + " : D généré " + r[3] + " ≠ D d'origine " + a.conditionnement);
  });
  assert(ko.length === 0, ko.slice(0, 5).join(" ; ") + (ko.length > 5 ? " (+" + (ko.length - 5) + ")" : ""));
});

check("Les lignes cotées par le CDG ne passent plus par E-DERIVE (E = inner du CDG, pas D)", () => {
  const ko = [];
  coteesCdg.forEach((a) => {
    const t = REF_CDG.get(normInv(a.nom));
    const r = genDe(a);
    if (!r) return;
    if (nb(r[3]) !== nb(t.cond)) ko.push(a.nom + " : colisage publié " + r[3] + " ≠ " + t.cond + " du CDG");
    if (nb(r[4]) !== nb(t.inner)) ko.push(a.nom + " : inner publié " + r[4] + " ≠ " + t.inner + " du CDG");
  });
  assert(ko.length === 0, ko.slice(0, 5).join(" ; ") + (ko.length > 5 ? " (+" + (ko.length - 5) + ")" : ""));
  assert(coteesCdg.length > 0, "aucune ligne cotée par le CDG dans le modèle : périmètre non exercé");
});

check("Traces : derive_E sur les dérivées hors référentiel, aucune sur les lignes cotées", () => {
  const parSource = (s) => articles.filter((a) => a.conditionnement_source === s);
  const horsRefNoms = new Set(horsRef.map((a) => String(a.nom).trim()));
  const tracees = parSource("derive_E");
  assert(tracees.every((a) => horsRefNoms.has(String(a.nom).trim())),
    "trace derive_E sur une ligne cotée par le CDG : " + tracees.filter((a) => !horsRefNoms.has(String(a.nom).trim())).slice(0, 3).map((a) => a.nom).join(" ; "));
  assert(tracees.length === aDeriver.length, tracees.length + " traces derive_E ≠ " + aDeriver.length + " lignes dérivables hors référentiel");
  assert(parSource("derive_E_bloque_D_absurde").every((a) => horsRefNoms.has(String(a.nom).trim())),
    "trace de blocage sur une ligne cotée par le CDG");
});

const lignesDeriveesReelles = gen.filter((r) => nb(r[4]) === nb(r[3]) && nb(r[3]) > 1).length;

console.log(
  [
    "— preuves —",
    "lignes de l'exemplaire retenues = " + referenceRows.length + " (noms distincts : " + lignesExemplaire + ")",
    "lignes générées dans Inventaire Initial = " + gen.length,
    "lignes cotées par le CDG = " + coteesCdg.length + " ; hors référentiel = " + horsRef.length,
    "E vide dans l'exemplaire (hors référentiel) = " + empties.length + " ; E renseigné = " + filled.length,
    "E vide et D > 1 (dérivables) = " + deriveables.length + " ; E vide et D ≤ 1 (non dérivables) = " + nonDeriveables.length,
    "seuil garde-fou = " + SEUIL_COLISAGE_ABSURDE + " ; dérivables ≤ seuil = " + aDeriver.length + " ; bloquées (D > seuil) = " + bloquees.length,
    "lignes du classeur avec E = D et D > 1 = " + lignesDeriveesReelles,
    "traces conditionnement_source = derive_E = " + articles.filter((a) => a.conditionnement_source === "derive_E").length,
    "lignes bloquées D absurde = " + bloquees.map((b) => b.nom + " [" + b.code + "] D=" + b.conditionnement).join(" | "),
  ].join("\n")
);
console.log(results.join("\n"));
process.exit(results.some((l) => l.startsWith("FAIL")) ? 1 : 0);
